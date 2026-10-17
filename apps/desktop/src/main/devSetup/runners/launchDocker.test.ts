import { describe, expect, it, vi } from 'vitest';
import type { CancelToken } from '../../process/spawnStreaming';
import { createDockerLauncher, type DockerLauncherDeps } from './launchDocker';
import type { RunHooks } from './packageManagerRunner';

/**
 * "Docker is running" is the one checklist item that is a state rather than a program. Starting
 * Docker Desktop is easy; the work is waiting for its engine to actually answer, without hanging
 * forever and without starting a second copy of something already running.
 */

function world(options: { running?: boolean[]; launch?: { ok: boolean; message?: string } } = {}) {
  let clock = 0;
  const calls: string[] = [];
  const answers = [...(options.running ?? [false, false, true])];
  const token: CancelToken = { cancelled: false, child: null };
  const progress: Array<Record<string, unknown>> = [];

  const deps: DockerLauncherDeps = {
    launch: vi.fn(async () => {
      calls.push('launch');
      return options.launch ?? { ok: true };
    }),
    ping: vi.fn(async () => {
      calls.push('ping');
      // Once the list runs out the last answer sticks.
      return answers.length > 1 ? (answers.shift() as boolean) : (answers[0] ?? false);
    }),
    sleep: vi.fn(async (ms: number) => {
      calls.push(`sleep:${ms}`);
      clock += ms;
    }),
    now: () => clock,
  };
  const hooks: RunHooks = {
    token,
    onProgress: (update) => progress.push(update as Record<string, unknown>),
    onLine: vi.fn(),
  };
  return { deps, hooks, calls, token, progress, run: () => createDockerLauncher(deps).run(hooks) };
}

describe('starting Docker', () => {
  it('starts it and waits until the engine answers', async () => {
    const w = world({ running: [false, false, false, true] });

    const result = await w.run();

    expect(result).toEqual({ ok: true, code: 0, cancelled: false });
    expect(w.calls).toEqual([
      'ping',
      'launch',
      'sleep:3000',
      'ping',
      'sleep:3000',
      'ping',
      'sleep:3000',
      'ping',
    ]);
  });

  it('does not start a second copy when the engine already answers', async () => {
    const w = world({ running: [true] });

    expect(await w.run()).toMatchObject({ ok: true });
    expect(w.deps.launch).not.toHaveBeenCalled();
  });

  it('says it is waiting, and for how long', async () => {
    const w = world({ running: [false, false, true] });

    await w.run();

    expect(w.progress).toContainEqual({
      phase: 'preparing',
      fraction: null,
      detail: 'Waiting for Docker to start, 3 s',
    });
    expect(w.progress.at(-1)).toMatchObject({ detail: 'Waiting for Docker to start, 6 s' });
  });

  it('gives up after two and a half minutes, and says what to try', async () => {
    const w = world({ running: [false] });

    const result = await w.run();

    expect(result).toMatchObject({
      ok: false,
      message:
        'Docker did not start within 2 and a half minutes. Open Docker Desktop yourself and check whether it is showing a message.',
    });
    expect(w.calls.filter((call) => call === 'launch')).toHaveLength(1);
  });

  it('reports a launch that did not work, without waiting', async () => {
    const w = world({
      running: [false],
      launch: { ok: false, message: 'Docker Desktop was not found. Install it first.' },
    });

    expect(await w.run()).toMatchObject({
      ok: false,
      message: 'Docker Desktop was not found. Install it first.',
    });
    expect(w.deps.sleep).not.toHaveBeenCalled();
  });

  it('stops waiting when cancelled', async () => {
    const w = world({ running: [false] });
    vi.mocked(w.deps.sleep).mockImplementation(async () => {
      w.token.cancelled = true;
    });

    expect(await w.run()).toMatchObject({ ok: false, cancelled: true });
    // Only the first check: a cancel during the wait stops before asking again.
    expect(w.calls.filter((call) => call === 'ping')).toHaveLength(1);
  });

  it('does nothing if it was cancelled before it began', async () => {
    const w = world();
    w.token.cancelled = true;

    expect(await w.run()).toMatchObject({ cancelled: true });
    expect(w.calls).toEqual([]);
  });
});
