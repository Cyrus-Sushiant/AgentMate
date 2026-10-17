import type {
  DevDetection,
  DevItem,
  DevJobEvent,
  DevSetupEnvironment,
  InstallMode,
} from '@agentmat/core';
import { describe, expect, it, vi } from 'vitest';
import type { CancelToken } from '../process/spawnStreaming';
import { createDevSetupInstaller, type InstallerDeps } from './installer';
import type { RunHooks, RunResult } from './runners/packageManagerRunner';

/**
 * The installer decides what runs, in what order, and whether it worked. The machine is faked: a
 * set of "installed" tools that a successful run adds to, so every path can be driven without
 * installing anything. What matters is that success is decided by looking again, that one failure
 * does not take down unrelated steps, and that cancelling really stops the rest.
 */

const WIN: DevSetupEnvironment = { os: 'win32', arch: 'x64', packageManagers: ['winget'] };

interface Step {
  item: DevItem;
  mode: Extract<InstallMode, { mode: 'in-app' }>;
}
type Behavior = (step: Step, hooks: RunHooks) => Promise<RunResult>;

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const OK: RunResult = { ok: true, code: 0, cancelled: false };

function world(
  options: {
    installed?: Record<string, string>;
    stacks?: string[];
    behavior?: Record<string, Behavior>;
    afterInstall?: () => Promise<void>;
  } = {},
) {
  const installed = new Map(Object.entries(options.installed ?? {}));
  const runs: Array<{ id: string; intent: string }> = [];
  const events: DevJobEvent[] = [];
  const calls: string[] = [];
  let jobCounter = 0;

  const deps: InstallerDeps = {
    environment: async () => WIN,
    stacks: async () => options.stacks ?? ['essentials', 'flutter'],
    detect: vi.fn(async (id: string): Promise<DevDetection> => {
      calls.push(`detect:${id}`);
      const version = installed.get(id);
      return version ? { state: 'found', version, path: null, onPath: true } : { state: 'absent' };
    }),
    run: vi.fn(async (step: Step, hooks: RunHooks) => {
      calls.push(`run:${step.item.id}`);
      runs.push({ id: step.item.id, intent: step.mode.intent });
      const custom = options.behavior?.[step.item.id];
      if (custom) return custom(step, hooks);
      installed.set(step.item.id, '99.0.0');
      return OK;
    }),
    afterInstall: async () => {
      calls.push('afterInstall');
      await options.afterInstall?.();
    },
    cancelRun: (token: CancelToken) => {
      token.cancelled = true;
    },
    emit: (event) => events.push(event),
    newJobId: () => `job-${++jobCounter}`,
  };

  return { deps, installed, runs, events, calls, installer: createDevSetupInstaller(deps) };
}

const kinds = (events: DevJobEvent[]) => events.map((event) => event.type);
const finished = (events: DevJobEvent[]) =>
  events.filter(
    (event): event is Extract<DevJobEvent, { type: 'finished' }> => event.type === 'finished',
  );

describe('installing one thing', () => {
  it('queues it, runs it, checks the result and finishes', async () => {
    const w = world();

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(kinds(w.events).filter((type) => type !== 'progress' && type !== 'log')).toEqual([
      'plan',
      'started',
      'finished',
      'done',
    ]);
    expect(finished(w.events)).toEqual([
      expect.objectContaining({ itemId: 'gh', result: 'installed' }),
    ]);
    expect(w.installer.jobState()).toMatchObject({ running: false, completed: ['gh'], items: {} });
  });

  it('plans before it returns, so the caller sees the queue straight away', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { gh: () => gate.promise } });

    const state = await w.installer.install({ ids: ['gh'] });

    expect(state).toMatchObject({ running: true, order: ['gh'] });
    expect(state.items.gh).toBeDefined();
    gate.resolve(OK);
    await w.installer.whenIdle();
  });

  it('does nothing for a tool that is already installed', async () => {
    const w = world({ installed: { gh: '2.62.0' } });

    const state = await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(w.runs).toEqual([]);
    expect(w.events).toEqual([]);
    expect(state.running).toBe(false);
  });

  it('updates a tool that is too old, rather than installing it again', async () => {
    const w = world({ installed: { node: '20.0.0' } });

    await w.installer.install({ ids: ['node'] });
    await w.installer.whenIdle();

    expect(w.runs).toEqual([{ id: 'node', intent: 'update' }]);
  });

  it('refuses an id that is not in the catalog', async () => {
    const w = world();

    await expect(w.installer.install({ ids: ['rm -rf'] })).rejects.toThrow(
      'Unknown dev setup item.',
    );
    expect(w.runs).toEqual([]);
  });

  it('refuses something that is not a list of ids', async () => {
    const w = world();

    await expect(w.installer.install({ ids: 'gh' as unknown as string[] })).rejects.toThrow(
      'Unknown dev setup item.',
    );
  });

  it('leaves a step that needs a terminal for the person, and plans nothing', async () => {
    const w = world({ stacks: ['essentials', 'docker'] });

    const state = await w.installer.install({ ids: ['wsl2'] });
    await w.installer.whenIdle();

    expect(w.runs).toEqual([]);
    expect(w.events).toEqual([]);
    expect(state.running).toBe(false);
  });

  it('works for an item whose stack was not switched on, as long as it is in the catalog', async () => {
    const w = world({ stacks: ['essentials'] });
    w.installed.set('git', '2.55.0');

    await w.installer.install({ ids: ['flutter'] });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['flutter']);
  });
});

describe('ordering', () => {
  it('installs what a tool needs first', async () => {
    const w = world();

    await w.installer.install({ ids: ['flutter'] });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['git', 'flutter']);
  });

  it('installs a whole chain in dependency order', async () => {
    const w = world();

    // This chain passes through the Android licenses, which need the agreement accepted first.
    await w.installer.install({ ids: ['android-system-image'], consented: true });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual([
      'jdk17',
      'android-cmdline-tools',
      'android-licenses',
      'android-emulator',
      'android-platform',
      'android-system-image',
    ]);
  }, 15_000);

  it('runs one step at a time', async () => {
    let active = 0;
    let peak = 0;
    const slow: Behavior = async (step) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      w.installed.set(step.item.id, '99.0.0');
      return OK;
    };
    const w = world({ behavior: { git: slow, node: slow, gh: slow } });

    await w.installer.install({ ids: ['git', 'node', 'gh'] });
    await w.installer.whenIdle();

    expect(peak).toBe(1);
  });
});

describe('deciding whether it worked', () => {
  it('looks again after the run, and only then calls it installed', async () => {
    const w = world();

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    // The look that decides comes after the run and after the environment was refreshed.
    const afterRun = w.calls.slice(w.calls.indexOf('run:gh'));
    expect(afterRun.slice(0, 3)).toEqual(['run:gh', 'afterInstall', 'detect:gh']);
  });

  it('does not take an exit code of zero on trust when the tool still is not there', async () => {
    const w = world({ behavior: { gh: async () => OK } });

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(finished(w.events)).toEqual([
      expect.objectContaining({
        itemId: 'gh',
        result: 'failed',
        message:
          'The installer finished but GitHub CLI was not found. Open a new terminal or restart AgentMate.',
      }),
    ]);
    expect(w.installer.jobState().items.gh).toMatchObject({ status: 'failed' });
  });

  it('counts it as installed when the command complained but the tool is there', async () => {
    const w = world({
      behavior: {
        gh: async (step) => {
          w.installed.set(step.item.id, '2.62.0');
          return { ok: false, code: 1, cancelled: false, message: 'something odd' };
        },
      },
    });

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(finished(w.events)[0]).toMatchObject({ result: 'installed' });
  });

  it('counts a tool that is there but too old as a failure', async () => {
    const w = world({
      behavior: {
        node: async (step) => {
          w.installed.set(step.item.id, '20.1.0');
          return OK;
        },
      },
    });

    await w.installer.install({ ids: ['node'] });
    await w.installer.whenIdle();

    expect(finished(w.events)[0]).toMatchObject({ result: 'failed' });
  });

  it('reports why a run failed, with the exit code', async () => {
    const w = world({
      behavior: {
        gh: async () => ({
          ok: false,
          code: 1603,
          cancelled: false,
          message: 'winget could not finish (code 1603).',
        }),
      },
    });

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(finished(w.events)[0]).toMatchObject({
      result: 'failed',
      message: 'winget could not finish (code 1603).',
      exitCode: 1603,
    });
  });

  it('turns a run that throws into a failure and carries on', async () => {
    const w = world({
      behavior: {
        git: async () => {
          throw new Error('disk on fire');
        },
      },
    });

    await w.installer.install({ ids: ['git', 'gh'] });
    await w.installer.whenIdle();

    expect(finished(w.events).map((event) => [event.itemId, event.result])).toEqual([
      ['git', 'failed'],
      ['gh', 'installed'],
    ]);
    expect(finished(w.events)[0]?.message).toBe('disk on fire');
  });

  it('passes on that a restart is advised', async () => {
    const w = world({
      behavior: {
        gh: async (step) => {
          w.installed.set(step.item.id, '2.62.0');
          return { ok: true, code: 0, cancelled: false, restartAdvised: true };
        },
      },
    });

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(finished(w.events)[0]).toMatchObject({ result: 'installed', restartAdvised: true });
    expect(w.installer.jobState().restartAdvised).toBe(true);
  });
});

describe('when a step fails', () => {
  it('skips what depends on it, but still runs what does not', async () => {
    const w = world({
      behavior: { git: async () => ({ ok: false, code: 1, cancelled: false, message: 'No.' }) },
    });

    await w.installer.install({ ids: ['flutter', 'gh'] });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['git', 'gh']);
    expect(finished(w.events).map((event) => [event.itemId, event.result])).toEqual([
      ['git', 'failed'],
      ['flutter', 'cancelled'],
      ['gh', 'installed'],
    ]);
  });

  it('keeps the failure for the row to show, and drops the skipped step', async () => {
    const w = world({
      behavior: { git: async () => ({ ok: false, code: 1, cancelled: false, message: 'No.' }) },
    });

    await w.installer.install({ ids: ['flutter'] });
    await w.installer.whenIdle();

    const { items } = w.installer.jobState();
    expect(items.git).toMatchObject({ status: 'failed', message: 'No.' });
    expect(items.flutter).toBeUndefined();
  });

  it('lets a retry run the failed step again', async () => {
    let attempts = 0;
    const w = world({
      behavior: {
        gh: async (step) => {
          attempts += 1;
          if (attempts === 1) return { ok: false, code: 1, cancelled: false, message: 'No.' };
          w.installed.set(step.item.id, '2.62.0');
          return OK;
        },
      },
    });

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();
    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['gh', 'gh']);
    expect(w.installer.jobState().items.gh).toBeUndefined();
    expect(w.installer.jobState().completed).toEqual(['gh']);
  });
});

describe('cancelling', () => {
  it('stops the step that is running and drops the rest', async () => {
    const gate = deferred<RunResult>();
    const w = world({
      behavior: {
        git: async (_step, hooks) => {
          hooks.token.child = null;
          return gate.promise;
        },
      },
    });
    await w.installer.install({ ids: ['git', 'node', 'gh'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));

    w.installer.cancel();
    gate.resolve({ ok: false, code: null, cancelled: true });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['git']);
    expect(finished(w.events).map((event) => [event.itemId, event.result])).toEqual([
      ['git', 'cancelled'],
      ['node', 'cancelled'],
      ['gh', 'cancelled'],
    ]);
    expect(w.events.at(-1)).toMatchObject({ type: 'done', cancelled: true });
    expect(w.installer.jobState()).toMatchObject({ running: false, items: {} });
  });

  it("marks the running step's token cancelled so the process gets killed", async () => {
    let token: CancelToken | null = null;
    const gate = deferred<RunResult>();
    const w = world({
      behavior: {
        git: async (_step, hooks) => {
          token = hooks.token;
          return gate.promise;
        },
      },
    });
    await w.installer.install({ ids: ['git'] });
    await vi.waitFor(() => expect(token).not.toBeNull());

    w.installer.cancel();

    expect((token as CancelToken | null)?.cancelled).toBe(true);
    gate.resolve({ ok: false, code: null, cancelled: true });
    await w.installer.whenIdle();
  });

  it('takes one waiting step out of the queue without touching the rest', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { git: () => gate.promise } });
    await w.installer.install({ ids: ['git', 'node', 'gh'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));

    w.installer.cancel('node');
    w.installed.set('git', '2.55.0');
    gate.resolve(OK);
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['git', 'gh']);
    expect(finished(w.events).find((event) => event.itemId === 'node')).toMatchObject({
      result: 'cancelled',
    });
  });

  it('cancels the whole run when asked to cancel the step that is running', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { git: () => gate.promise } });
    await w.installer.install({ ids: ['git', 'node'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));

    w.installer.cancel('git');
    gate.resolve({ ok: false, code: null, cancelled: true });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['git']);
    expect(w.events.at(-1)).toMatchObject({ type: 'done', cancelled: true });
  });

  it('does nothing when nothing is running', () => {
    const w = world();

    expect(() => w.installer.cancel()).not.toThrow();
    expect(w.events).toEqual([]);
  });

  it('can start a clean run afterwards', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { git: () => gate.promise } });
    await w.installer.install({ ids: ['git'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));
    w.installer.cancel();
    gate.resolve({ ok: false, code: null, cancelled: true });
    await w.installer.whenIdle();

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(w.installer.jobState().completed).toEqual(['gh']);
  });
});

describe('a second request while one is running', () => {
  it('adds to the same run instead of starting another', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { git: () => gate.promise } });
    const first = await w.installer.install({ ids: ['git'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));

    const second = await w.installer.install({ ids: ['gh'] });
    w.installed.set('git', '2.55.0');
    gate.resolve(OK);
    await w.installer.whenIdle();

    expect(second.jobId).toBe(first.jobId);
    expect(w.runs.map((run) => run.id)).toEqual(['git', 'gh']);
    expect(w.events.filter((event) => event.type === 'done')).toHaveLength(1);
  });

  it('does not queue what is already waiting', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { git: () => gate.promise } });
    await w.installer.install({ ids: ['git', 'gh'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));

    await w.installer.install({ ids: ['gh', 'git'] });
    w.installed.set('git', '2.55.0');
    gate.resolve(OK);
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['git', 'gh']);
  });
});

describe('agreements', () => {
  it('will not install something with an agreement until it has been accepted', async () => {
    const w = world();

    await expect(w.installer.install({ ids: ['android-licenses'] })).rejects.toThrow(
      'consent-required',
    );
    expect(w.runs).toEqual([]);
    expect(w.events).toEqual([]);
  });

  it('goes ahead once the agreement is accepted', async () => {
    const w = world();

    await w.installer.install({ ids: ['android-licenses'], consented: true });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toContain('android-licenses');
  }, 15_000);

  it('does not ask about an agreement that belongs to a step that will not run', async () => {
    const w = world({ installed: { 'android-licenses': '1' } });

    await expect(w.installer.install({ ids: ['android-licenses'] })).resolves.toMatchObject({
      running: false,
    });
  });
});

describe('what the page is told', () => {
  it('forwards progress and log lines tagged with the run and the item', async () => {
    const w = world({
      behavior: {
        gh: async (step, hooks) => {
          hooks.onProgress({ phase: 'downloading', fraction: 0.5 });
          hooks.onLine('Downloading gh');
          w.installed.set(step.item.id, '2.62.0');
          return OK;
        },
      },
    });

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(w.events).toContainEqual({
      type: 'progress',
      jobId: 'job-1',
      itemId: 'gh',
      phase: 'downloading',
      fraction: 0.5,
    });
    expect(w.events).toContainEqual({
      type: 'log',
      jobId: 'job-1',
      itemId: 'gh',
      line: 'Downloading gh',
    });
  });

  it('says it is checking the result before it decides', async () => {
    const w = world();

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();

    expect(w.events).toContainEqual({
      type: 'progress',
      jobId: 'job-1',
      itemId: 'gh',
      phase: 'checking',
      fraction: null,
    });
  });

  it('gives each run its own id', async () => {
    const w = world();

    await w.installer.install({ ids: ['gh'] });
    await w.installer.whenIdle();
    await w.installer.install({ ids: ['pnpm'] });
    await w.installer.whenIdle();

    const ids = new Set(w.events.map((event) => event.jobId));
    expect(ids).toEqual(new Set(['job-1', 'job-2']));
  });

  it('lets a window that opens late read the current state', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { git: () => gate.promise } });
    await w.installer.install({ ids: ['git', 'gh'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));

    expect(w.installer.jobState()).toMatchObject({
      running: true,
      current: 'git',
      order: ['git', 'gh'],
    });
    w.installed.set('git', '2.55.0');
    gate.resolve(OK);
    await w.installer.whenIdle();
  });

  it('stops on dispose, like a cancel', async () => {
    const gate = deferred<RunResult>();
    const w = world({ behavior: { git: () => gate.promise } });
    await w.installer.install({ ids: ['git', 'gh'] });
    await vi.waitFor(() => expect(w.runs).toHaveLength(1));

    w.installer.dispose();
    gate.resolve({ ok: false, code: null, cancelled: true });
    await w.installer.whenIdle();

    expect(w.runs.map((run) => run.id)).toEqual(['git']);
  });
});
