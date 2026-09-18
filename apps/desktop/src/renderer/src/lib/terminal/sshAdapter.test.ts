import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type FakeBridge, installAgentmatBridge } from '../../../../test/renderer/agentmatBridge';
import { sshTerminalAdapter } from './sshAdapter';

let bridge: FakeBridge;

beforeEach(() => {
  bridge = installAgentmatBridge({
    'ssh.create': async () => ({ sessionId: 'ssh-1' }),
  });
});

describe('sshTerminalAdapter', () => {
  it('connects to the saved server and reports a fresh session', () => {
    const adapter = sshTerminalAdapter('server-1');
    return adapter.create({ sessionId: 's1', cols: 80, rows: 24 }).then((result) => {
      expect(bridge.$fn('ssh.create')).toHaveBeenCalledWith({
        sessionId: 's1',
        savedServerId: 'server-1',
        cols: 80,
        rows: 24,
      });
      // SSH sessions never reattach in v1, so there is never a snapshot to paint.
      expect(result).toEqual({ sessionId: 'ssh-1', isNew: true, snapshot: null });
    });
  });

  it('connects with no options at all', async () => {
    await sshTerminalAdapter('server-1').create();
    expect(bridge.$fn('ssh.create')).toHaveBeenCalledWith({
      sessionId: undefined,
      savedServerId: 'server-1',
      cols: undefined,
      rows: undefined,
    });
  });

  it('strips Electron is IPC boilerplate off a connect failure', async () => {
    // What is left is the line shown in the terminal pane, so it has to be the real reason.
    bridge = installAgentmatBridge({
      'ssh.create': async () => {
        throw new Error(
          "Error invoking remote method 'ssh:create': Error: All configured authentication methods failed",
        );
      },
    });
    await expect(sshTerminalAdapter('server-1').create()).rejects.toThrow(
      'All configured authentication methods failed',
    );
  });

  it('keeps a message that has no boilerplate around it', async () => {
    bridge = installAgentmatBridge({
      'ssh.create': async () => {
        throw new Error('Host unreachable');
      },
    });
    await expect(sshTerminalAdapter('server-1').create()).rejects.toThrow('Host unreachable');
  });

  it('turns something thrown that is not an Error into one', async () => {
    bridge = installAgentmatBridge({
      'ssh.create': async () => {
        throw 'timed out';
      },
    });
    await expect(sshTerminalAdapter('server-1').create()).rejects.toThrow('timed out');
  });

  it('keeps the original message when stripping would leave nothing', async () => {
    bridge = installAgentmatBridge({
      'ssh.create': async () => {
        throw new Error("Error invoking remote method 'ssh:create': Error:");
      },
    });
    await expect(sshTerminalAdapter('server-1').create()).rejects.toThrow(
      "Error invoking remote method 'ssh:create': Error:",
    );
  });

  it('passes writes, resizes and kills straight through', async () => {
    const adapter = sshTerminalAdapter('server-1');
    await adapter.write('s1', 'ls\r');
    await adapter.resize('s1', 100, 40);
    await adapter.kill('s1');
    expect(bridge.$fn('ssh.write')).toHaveBeenCalledWith('s1', 'ls\r');
    expect(bridge.$fn('ssh.resize')).toHaveBeenCalledWith('s1', 100, 40);
    expect(bridge.$fn('ssh.kill')).toHaveBeenCalledWith('s1');
  });

  it('forwards output as the terminal client shape', () => {
    const adapter = sshTerminalAdapter('server-1');
    const seen: { sessionId: string; data: string }[] = [];
    const off = adapter.onData((payload) => seen.push(payload));
    bridge.$emit('ssh.onData', { sessionId: 's1', data: 'hello' });
    expect(seen).toEqual([{ sessionId: 's1', data: 'hello' }]);
    off();
    expect(bridge.$listenerCount('ssh.onData')).toBe(0);
  });

  it('turns an exit carrying an error into a non-zero exit code', () => {
    // The terminal client only understands exit codes; an SSH error has to become one.
    const adapter = sshTerminalAdapter('server-1');
    const seen: { sessionId: string; exitCode: number }[] = [];
    adapter.onExit((payload) => seen.push(payload));
    bridge.$emit('ssh.onExit', { sessionId: 's1', error: 'connection reset' });
    bridge.$emit('ssh.onExit', { sessionId: 's2' });
    expect(seen).toEqual([
      { sessionId: 's1', exitCode: 1 },
      { sessionId: 's2', exitCode: 0 },
    ]);
  });

  it('stops forwarding exits once unsubscribed', () => {
    const adapter = sshTerminalAdapter('server-1');
    const listener = vi.fn();
    adapter.onExit(listener)();
    bridge.$emit('ssh.onExit', { sessionId: 's1' });
    expect(listener).not.toHaveBeenCalled();
  });
});
