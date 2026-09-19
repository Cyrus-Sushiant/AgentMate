import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * How a child is started and stopped on each platform, with a fake child process so the POSIX
 * behaviour can be checked from any machine. Windows kills the tree with taskkill; POSIX has to
 * put the child in its own process group and signal the group, or its grandchildren live on.
 */

interface FakeChild extends EventEmitter {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  exitCode: number | null;
  signalCode: string | null;
}

const spawned: { command: string; args: string[]; options: Record<string, unknown> }[] = [];
const execFileCalls: unknown[][] = [];
let child: FakeChild;

/** Only the parts of a child process this module touches. */
const asChild = (fake: FakeChild): ChildProcess => fake as unknown as ChildProcess;

function makeChild(): FakeChild {
  const fake = new EventEmitter() as FakeChild;
  fake.pid = 4242;
  fake.stdout = new EventEmitter();
  fake.stderr = new EventEmitter();
  fake.kill = vi.fn();
  fake.exitCode = null;
  fake.signalCode = null;
  return fake;
}

vi.mock('node:child_process', () => ({
  spawn: (command: string, args: string[], options: Record<string, unknown>) => {
    spawned.push({ command, args, options });
    return child;
  },
  execFile: (...args: unknown[]) => {
    execFileCalls.push(args);
    const done = args.find((arg) => typeof arg === 'function') as
      | ((...rest: unknown[]) => void)
      | undefined;
    done?.(null, '', '');
  },
}));
vi.mock('../toolPaths', () => ({
  withToolPath: async (env?: NodeJS.ProcessEnv) => ({ ...(env ?? process.env) }),
}));

const { cancelSpawn, killProcessTree, spawnStreaming } = await import('./spawnStreaming');

const realPlatform = process.platform;
const setPlatform = (value: string): void => {
  Object.defineProperty(process, 'platform', { value, configurable: true });
};

beforeEach(() => {
  spawned.length = 0;
  execFileCalls.length = 0;
  child = makeChild();
});

afterEach(() => {
  setPlatform(realPlatform);
  vi.restoreAllMocks();
});

function run(): Promise<Awaited<ReturnType<typeof spawnStreaming>>> {
  return spawnStreaming({
    command: 'pytest',
    args: ['-q'],
    cwd: '/work/app',
    timeoutMs: 60_000,
    token: { cancelled: false, child: null },
  });
}

describe('spawnStreaming on POSIX', () => {
  it('starts the child in its own process group so the whole tree can be signalled', async () => {
    setPlatform('linux');
    const running = run();
    await vi.waitFor(() => expect(spawned).toHaveLength(1));
    expect(spawned[0]).toMatchObject({
      command: 'pytest',
      args: ['-q'],
      options: { cwd: '/work/app', detached: true },
    });
    child.emit('close', 0);
    await running;
  });

  it('signals the process group, and only falls back to the child when there is no group', () => {
    setPlatform('linux');
    // Fake timers so the escalation this schedules cannot fire at a real pid after the test.
    vi.useFakeTimers();
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    killProcessTree(asChild(child));
    expect(kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
    expect(child.kill).not.toHaveBeenCalled();

    kill.mockImplementation(() => {
      throw new Error('ESRCH');
    });
    killProcessTree(asChild(child));
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('kills a child that ignores SIGTERM', () => {
    setPlatform('linux');
    vi.useFakeTimers();
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    killProcessTree(asChild(child));
    vi.advanceTimersByTime(5_000);
    expect(kill).toHaveBeenCalledWith(-4242, 'SIGKILL');

    // A child that has already exited is left alone, so no recycled pid gets signalled.
    kill.mockClear();
    child.exitCode = 0;
    killProcessTree(asChild(child));
    vi.advanceTimersByTime(5_000);
    expect(kill).not.toHaveBeenCalledWith(-4242, 'SIGKILL');
    vi.useRealTimers();
  });

  it('cancels before the spawn without touching any process', async () => {
    setPlatform('linux');
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const token = { cancelled: false, child: null };
    cancelSpawn(token);
    expect(kill).not.toHaveBeenCalled();
    expect(token.cancelled).toBe(true);
  });
});

describe('spawnStreaming on Windows', () => {
  it('goes through cmd.exe and kills the tree with taskkill', async () => {
    setPlatform('win32');
    const running = run();
    await vi.waitFor(() => expect(spawned).toHaveLength(1));
    expect(spawned[0].command).toBe('cmd.exe');
    expect(spawned[0].args).toEqual(['/d', '/s', '/c', '"pytest "-q""']);
    expect(spawned[0].options).toMatchObject({ windowsVerbatimArguments: true, windowsHide: true });
    expect(spawned[0].options.detached).toBeUndefined();

    killProcessTree(asChild(child));
    expect(execFileCalls[0]?.[0]).toBe('taskkill');
    expect(execFileCalls[0]?.[1]).toEqual(['/pid', '4242', '/T', '/F']);

    child.emit('close', 0);
    await running;
  });
});
