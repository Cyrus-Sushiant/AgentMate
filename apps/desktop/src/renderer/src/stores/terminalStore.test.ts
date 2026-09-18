import type { SshSavedServer } from '@shared/apiTypes';
import { beforeEach, describe, expect, it } from 'vitest';
import { type FakeBridge, installAgentmatBridge } from '../../../test/renderer/agentmatBridge';
import {
  defaultNewSession,
  TERMINAL_DEFAULT_HEIGHT,
  TERMINAL_MIN_HEIGHT,
  useTerminalStore,
} from './terminalStore';

let bridge: FakeBridge;

function store() {
  return useTerminalStore.getState();
}

function reset(): void {
  useTerminalStore.setState({
    isOpen: false,
    drawerHeight: TERMINAL_DEFAULT_HEIGHT,
    sessions: [],
    activeSessionId: null,
  });
}

const server = { id: 'srv-1', nickname: 'build box' } as SshSavedServer;

beforeEach(() => {
  bridge = installAgentmatBridge({ platform: 'win32' });
  reset();
});

describe('defaultNewSession', () => {
  it('starts the shell that belongs to the platform', () => {
    expect(defaultNewSession()).toEqual({ title: 'PowerShell', shell: 'powershell.exe' });
    installAgentmatBridge({ platform: 'darwin' });
    expect(defaultNewSession()).toEqual({ title: 'zsh', shell: 'zsh' });
    installAgentmatBridge({ platform: 'linux' });
    expect(defaultNewSession()).toEqual({ title: 'bash', shell: 'bash' });
  });
});

describe('the drawer', () => {
  it('starts closed at its default height', () => {
    expect(store().isOpen).toBe(false);
    expect(store().drawerHeight).toBe(TERMINAL_DEFAULT_HEIGHT);
  });

  it('opens, closes and toggles', () => {
    store().openDrawer();
    expect(store().isOpen).toBe(true);
    store().closeDrawer();
    expect(store().isOpen).toBe(false);
    store().toggleDrawer();
    expect(store().isOpen).toBe(true);
    store().toggleDrawer();
    expect(store().isOpen).toBe(false);
  });

  it('rounds a dragged height and never goes below the minimum', () => {
    store().setDrawerHeight(400.6);
    expect(store().drawerHeight).toBe(401);
    store().setDrawerHeight(10);
    expect(store().drawerHeight).toBe(TERMINAL_MIN_HEIGHT);
  });
});

describe('openSession', () => {
  it('adds a tab, makes it active and shows the drawer', () => {
    const id = store().openSession({ title: 'PowerShell', shell: 'powershell.exe' });
    expect(store().sessions).toHaveLength(1);
    expect(store().activeSessionId).toBe(id);
    expect(store().isOpen).toBe(true);
  });

  it('keeps everything the caller asked for', () => {
    store().openSession({
      title: 'Claude Code',
      cwd: 'E:\\proj',
      shell: 'powershell.exe',
      initialInput: 'claude\r',
      projectId: 'p1',
    });
    expect(store().sessions[0]).toMatchObject({
      title: 'Claude Code',
      cwd: 'E:\\proj',
      initialInput: 'claude\r',
      projectId: 'p1',
    });
  });

  it('takes an id the caller chose, so a tab can be reopened as itself', () => {
    expect(store().openSession({ id: 'fixed', title: 'sh' })).toBe('fixed');
  });
});

describe('openDefaultSession', () => {
  it('names the first tab after the shell and numbers the ones after it', () => {
    store().openDefaultSession();
    store().openDefaultSession();
    store().openDefaultSession();
    expect(store().sessions.map((session) => session.title)).toEqual([
      'PowerShell',
      'PowerShell 2',
      'PowerShell 3',
    ]);
  });

  it('counts only tabs running the same shell', () => {
    store().openSession({ title: 'bash', shell: 'bash' });
    store().openDefaultSession();
    expect(store().sessions.at(-1)?.title).toBe('PowerShell');
  });
});

describe('openSshSession', () => {
  it('opens a tab named after the saved server', () => {
    store().openSshSession(server);
    expect(store().sessions[0]).toMatchObject({
      title: 'build box',
      kind: 'ssh',
      sshServerId: 'srv-1',
    });
  });
});

describe('closeSession', () => {
  it('ends the shell and drops the tab', () => {
    const id = store().openDefaultSession();
    store().closeSession(id);
    // Ending the shell lives in the store, so a reload or a re-run of the effects never costs
    // the user a running shell.
    expect(bridge.$fn('terminal.kill')).toHaveBeenCalledWith(id);
    expect(store().sessions).toEqual([]);
    expect(store().activeSessionId).toBeNull();
  });

  it('ends an SSH tab through the SSH side', () => {
    const id = store().openSshSession(server);
    store().closeSession(id);
    expect(bridge.$fn('ssh.kill')).toHaveBeenCalledWith(id);
  });

  it('moves to the last remaining tab', () => {
    const first = store().openDefaultSession();
    const second = store().openDefaultSession();
    const third = store().openDefaultSession();
    store().setActiveSession(second);
    store().closeSession(second);
    expect(store().activeSessionId).toBe(third);
    store().closeSession(third);
    expect(store().activeSessionId).toBe(first);
  });

  it('leaves the active tab alone when another one closes', () => {
    const first = store().openDefaultSession();
    const second = store().openDefaultSession();
    store().closeSession(first);
    expect(store().activeSessionId).toBe(second);
  });
});

describe('forgetSession', () => {
  it('drops a tab whose shell has already ended, without killing anything', () => {
    const id = store().openDefaultSession();
    store().forgetSession(id);
    expect(store().sessions).toEqual([]);
    expect(() => bridge.$fn('terminal.kill')).toThrow();
  });
});

describe('setActiveSession', () => {
  it('switches the tab on screen', () => {
    const first = store().openDefaultSession();
    store().openDefaultSession();
    store().setActiveSession(first);
    expect(store().activeSessionId).toBe(first);
  });
});

describe('coming back from a saved drawer', () => {
  function seed(state: Record<string, unknown>): void {
    localStorage.setItem('agentmate-terminal-sessions', JSON.stringify({ state, version: 0 }));
  }

  async function rehydrate(): Promise<void> {
    await useTerminalStore.persist.rehydrate();
  }

  it('marks every restored tab, so it reconnects instead of starting a shell', async () => {
    seed({
      isOpen: true,
      drawerHeight: 350,
      activeSessionId: 's2',
      sessions: [
        { id: 's1', title: 'PowerShell' },
        { id: 's2', title: 'bash' },
      ],
    });
    await rehydrate();
    expect(store().sessions.every((session) => session.restored)).toBe(true);
    expect(store().drawerHeight).toBe(350);
    expect(store().activeSessionId).toBe('s2');
    expect(store().isOpen).toBe(true);
  });

  it('keeps the drawer shut when nothing came back with it', async () => {
    seed({ isOpen: true, sessions: [] });
    await rehydrate();
    expect(store().isOpen).toBe(false);
  });

  it('falls back to the last tab when the saved active one is gone', async () => {
    seed({ isOpen: true, activeSessionId: 'missing', sessions: [{ id: 's1', title: 'sh' }] });
    await rehydrate();
    expect(store().activeSessionId).toBe('s1');
  });

  it('survives a saved blob with no sessions array in it', async () => {
    seed({ isOpen: true, sessions: 'not an array' });
    await rehydrate();
    expect(store().sessions).toEqual([]);
    expect(store().activeSessionId).toBeNull();
    expect(store().drawerHeight).toBe(TERMINAL_DEFAULT_HEIGHT);
  });

  it('never saves the command a tab already ran', () => {
    store().openSession({ title: 'Claude Code', initialInput: 'claude\r' });
    const saved = JSON.parse(localStorage.getItem('agentmate-terminal-sessions') ?? '{}');
    // A reconnect must never type it a second time.
    expect(saved.state.sessions[0].initialInput).toBeUndefined();
  });

  it('never saves an SSH tab, which has no host to reattach to', () => {
    store().openSshSession(server);
    store().openDefaultSession();
    const saved = JSON.parse(localStorage.getItem('agentmate-terminal-sessions') ?? '{}');
    expect(saved.state.sessions).toHaveLength(1);
    expect(saved.state.sessions[0].kind).toBeUndefined();
  });
});
