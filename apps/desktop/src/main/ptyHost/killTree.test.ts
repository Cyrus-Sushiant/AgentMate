import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Closing a terminal has to take down what the shell started (a dev server, Gradle, Flutter),
 * not just the shell. What matters is the order on Windows, where taskkill finds children by
 * their parent pid and so has to run while the shell is still alive, and that the shell is
 * always killed in the end, exactly once, whatever taskkill does.
 */

interface FakeChild extends EventEmitter {
  unref: ReturnType<typeof vi.fn>;
}

const spawned = vi.hoisted(
  () => [] as { command: string; args: string[]; options: Record<string, unknown> }[],
);
const children = vi.hoisted(() => [] as FakeChild[]);
const spawnBehavior = vi.hoisted(() => ({ throws: false }));

vi.mock('node:child_process', async () => {
  const { EventEmitter: Emitter } = await import('node:events');
  return {
    spawn: (command: string, args: string[], options: Record<string, unknown>) => {
      if (spawnBehavior.throws) throw new Error('spawn EPERM');
      spawned.push({ command, args, options });
      const child = Object.assign(new Emitter(), { unref: vi.fn() }) as FakeChild;
      children.push(child);
      return child;
    },
  };
});

const { killShellTree, TREE_KILL_TIMEOUT_MS } = await import('./killTree');

beforeEach(() => {
  spawned.length = 0;
  children.length = 0;
  spawnBehavior.throws = false;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('killShellTree on Windows', () => {
  it('runs taskkill on the whole tree first and kills the shell once it is done', () => {
    const killPty = vi.fn();

    killShellTree(4242, killPty, 'win32');

    expect(spawned).toEqual([
      {
        command: 'taskkill',
        args: ['/pid', '4242', '/T', '/F'],
        // Detached, so it finishes even when the pty host exits right after a shutdown.
        options: { detached: true, stdio: 'ignore', windowsHide: true },
      },
    ]);
    expect(children[0].unref).toHaveBeenCalled();
    // The shell has to be alive while taskkill walks down from it.
    expect(killPty).not.toHaveBeenCalled();

    children[0].emit('exit', 0);
    expect(killPty).toHaveBeenCalledOnce();
  });

  it('still kills the shell when taskkill fails to start', () => {
    const killPty = vi.fn();
    killShellTree(4242, killPty, 'win32');

    children[0].emit('error', new Error('ENOENT'));

    expect(killPty).toHaveBeenCalledOnce();
  });

  it('still kills the shell when spawning taskkill throws', () => {
    spawnBehavior.throws = true;
    const killPty = vi.fn();

    killShellTree(4242, killPty, 'win32');

    expect(killPty).toHaveBeenCalledOnce();
  });

  it('kills the shell anyway when taskkill takes too long, and only once', () => {
    const killPty = vi.fn();
    killShellTree(4242, killPty, 'win32');

    vi.advanceTimersByTime(TREE_KILL_TIMEOUT_MS);
    expect(killPty).toHaveBeenCalledOnce();

    // taskkill finishing late must not kill a second time.
    children[0].emit('exit', 1);
    children[0].emit('error', new Error('late'));
    expect(killPty).toHaveBeenCalledOnce();
  });

  it('does not let a throwing pty kill escape', () => {
    const killPty = vi.fn(() => {
      throw new Error('already exited');
    });
    killShellTree(4242, killPty, 'win32');

    expect(() => children[0].emit('exit', 0)).not.toThrow();
  });

  it('skips taskkill for a shell without a usable pid', () => {
    const killPty = vi.fn();

    killShellTree(0, killPty, 'win32');

    expect(spawned).toEqual([]);
    expect(killPty).toHaveBeenCalledOnce();
  });
});

describe('killShellTree elsewhere', () => {
  it('hangs up the shell process group, then kills the shell', () => {
    const order: string[] = [];
    const signal = vi.spyOn(process, 'kill').mockImplementation(((pid: number, sig?: string) => {
      order.push(`signal ${pid} ${sig}`);
      return true;
    }) as typeof process.kill);

    killShellTree(4242, () => order.push('pty'), 'linux');

    expect(signal).toHaveBeenCalledWith(-4242, 'SIGHUP');
    expect(order).toEqual(['signal -4242 SIGHUP', 'pty']);
    expect(spawned).toEqual([]);
  });

  it('still kills the shell when there is no group to signal', () => {
    vi.spyOn(process, 'kill').mockImplementation((() => {
      throw new Error('ESRCH');
    }) as typeof process.kill);
    const killPty = vi.fn();

    killShellTree(4242, killPty, 'darwin');

    expect(killPty).toHaveBeenCalledOnce();
  });
});
