import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSessionEntry, AutoContinuePendingMap } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { invoke, loadIpc, useTempUserData } from '../../test/main/ipcHarness';

/**
 * The auto-continue half of the agents IPC: the renderer's tab list turns watching on and off,
 * main reports what it has scheduled, and a scheduled continue can be dropped.
 *
 * Terminals are kept in this process (no background host) and node-pty is stubbed, since
 * syncing a tab list also attaches to its sessions.
 */

vi.mock('../ptyHost/hostLauncher', () => ({ connectToHost: async () => null }));

vi.mock('../ptyHost/sessionManager', () => ({
  PtySessionManager: class {
    createOrAttach(): unknown {
      return { isNew: true, snapshot: null };
    }
    write(): void {
      return undefined;
    }
    resize(): void {
      return undefined;
    }
    kill(): void {
      return undefined;
    }
    killAll(): void {
      return undefined;
    }
    list(): unknown[] {
      return [];
    }
  },
}));

useTempUserData();

let terminal: typeof import('./terminal');

beforeEach(async () => {
  terminal = await import('./terminal');
  await loadIpc(
    () => import('./agents'),
    (module) => module.registerAgentHandlers(),
  );
});

function tab(sessionId: string, autoContinue?: unknown): AgentSessionEntry {
  return {
    sessionId,
    projectId: 'p1',
    cliId: 'claude-code',
    title: 'Claude Code',
    autoContinue: autoContinue as AgentSessionEntry['autoContinue'],
  };
}

const NETWORK_ERROR = 'API Error: Connection error.';

describe('agents:sync and auto-continue', () => {
  it('starts watching a tab that turned auto-continue on', async () => {
    await invoke(IPC.agents.sync, [tab('watched', { afterNetworkError: true })]);
    terminal.autoContinue.output('watched', NETWORK_ERROR);

    const pending = await invoke<AutoContinuePendingMap>(IPC.agents.autoContinuePending);
    expect(pending.watched).toMatchObject({ kind: 'network', attempt: 1 });
  });

  it('stops watching when the tab turns it off again', async () => {
    await invoke(IPC.agents.sync, [tab('toggled', { afterNetworkError: true })]);
    terminal.autoContinue.output('toggled', NETWORK_ERROR);
    await invoke(IPC.agents.sync, [tab('toggled', { afterNetworkError: false })]);

    expect(await invoke(IPC.agents.autoContinuePending)).toEqual({});
  });

  it('turns away a tab whose options are not the shape the renderer sends', async () => {
    await invoke(IPC.agents.sync, [tab('string', 'yes'), tab('numbers', { afterNetworkError: 1 })]);
    terminal.autoContinue.output('string', NETWORK_ERROR);
    terminal.autoContinue.output('numbers', NETWORK_ERROR);

    expect(await invoke(IPC.agents.autoContinuePending)).toEqual({});
  });

  it('drops a scheduled continue on request, and ignores a bad id', async () => {
    await invoke(IPC.agents.sync, [tab('cancelled', { afterNetworkError: true })]);
    terminal.autoContinue.output('cancelled', NETWORK_ERROR);

    await invoke(IPC.agents.cancelAutoContinue, 42);
    expect(await invoke<AutoContinuePendingMap>(IPC.agents.autoContinuePending)).toHaveProperty(
      'cancelled',
    );

    await invoke(IPC.agents.cancelAutoContinue, 'cancelled');
    expect(await invoke(IPC.agents.autoContinuePending)).toEqual({});
  });
});
