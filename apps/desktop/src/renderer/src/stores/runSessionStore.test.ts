import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type FakeBridge, installAgentmatBridge } from '../../../test/renderer/agentmatBridge';
import {
  pickRunToStop,
  runSessionsOf,
  stopActiveRun,
  stopRun,
  useRunSessionStore,
} from './runSessionStore';
import { type TerminalRunInfo, type TerminalSessionMeta, useTerminalStore } from './terminalStore';
import { useWorkspaceStore } from './workspaceStore';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

/**
 * What a project run printed about where it can be reached, and which run the stop shortcut
 * ends. The stop rules are what keep Shift+F5 from ever killing a plain shell or an agent tab.
 */

let bridge: FakeBridge;

function run(label = 'Dev', command = 'pnpm dev'): TerminalRunInfo {
  return { commandId: label.toLowerCase(), label, command, kind: 'web', startedAt: 1000 };
}

function session(id: string, over: Partial<TerminalSessionMeta> = {}): TerminalSessionMeta {
  return { id, title: id, ...over };
}

function outputs() {
  return useRunSessionStore.getState().outputs;
}

beforeEach(() => {
  bridge = installAgentmatBridge();
  toast.info.mockClear();
  toast.success.mockClear();
  useRunSessionStore.setState({ outputs: {} });
  // Lines carried over from an earlier test's chunks would leak into this one.
  useRunSessionStore.getState().prune([]);
});

describe('noteOutput', () => {
  it('keeps the local addresses a run prints, in the order printed', () => {
    useRunSessionStore
      .getState()
      .noteOutput(
        'r1',
        '  \x1b[32m➜\x1b[39m  Local:   \x1b[36mhttp://localhost:\x1b[1m5173\x1b[22m/\x1b[39m\n  ➜  Network: use --host to expose\n',
      );
    useRunSessionStore.getState().noteOutput('r1', 'API on http://127.0.0.1:3001/api\n');

    expect(outputs().r1.urls).toEqual(['http://localhost:5173/', 'http://127.0.0.1:3001/api']);
  });

  it('finds an address split across two chunks', () => {
    useRunSessionStore.getState().noteOutput('r1', '  Local:   http://local');
    useRunSessionStore.getState().noteOutput('r1', 'host:4200/\n');

    expect(outputs().r1.urls).toEqual(['http://localhost:4200/']);
  });

  it('keeps an address printed again in its first place', () => {
    const { noteOutput } = useRunSessionStore.getState();
    noteOutput('r1', 'http://localhost:5173/\n');
    noteOutput('r1', 'http://localhost:3000/\n');
    noteOutput('r1', 'http://localhost:5173/\n');

    expect(outputs().r1.urls).toEqual(['http://localhost:5173/', 'http://localhost:3000/']);
  });

  it('keeps the devices a mobile run goes to, the latest last', () => {
    const { noteOutput } = useRunSessionStore.getState();
    noteOutput('r1', 'Launching lib/main.dart on Pixel 7 in debug mode...\n');
    noteOutput('r1', "Installing APK 'app-debug.apk' on 'Pixel_Tablet(AVD) - 14' for :app:debug\n");

    expect(outputs().r1.devices).toEqual(['Pixel 7', 'Pixel_Tablet']);
  });

  it('keeps each run apart and ignores output with nothing in it', () => {
    const { noteOutput } = useRunSessionStore.getState();
    noteOutput('r1', 'compiling...\n');
    noteOutput('r2', 'http://localhost:8080/\n');

    expect(outputs()).toEqual({ r2: { urls: ['http://localhost:8080/'], devices: [] } });
  });
});

describe('prune', () => {
  it('drops what was kept for runs that are gone', () => {
    const { noteOutput, prune } = useRunSessionStore.getState();
    noteOutput('kept', 'http://localhost:3000/\n');
    noteOutput('gone', 'http://localhost:3001/\n');

    prune(['kept']);

    expect(Object.keys(outputs())).toEqual(['kept']);
  });
});

describe('runSessionsOf', () => {
  it('lists only local tabs that run a project', () => {
    const runs = runSessionsOf([
      session('shell'),
      session('dev', { run: run() }),
      session('ssh', { kind: 'ssh', run: run() }),
    ]);

    expect(runs.map((r) => r.id)).toEqual(['dev']);
  });
});

describe('pickRunToStop', () => {
  const sessions = [
    session('shell'),
    session('apollo-dev', { projectId: 'apollo', run: run() }),
    session('zeus-dev', { projectId: 'zeus', run: run() }),
    session('agent'),
  ];

  it('picks the run open in the drawer', () => {
    expect(pickRunToStop({ sessions, activeSessionId: 'apollo-dev', isOpen: true }, 'zeus')).toBe(
      'apollo-dev',
    );
  });

  it('does not count the drawer tab while the drawer is closed', () => {
    expect(pickRunToStop({ sessions, activeSessionId: 'apollo-dev', isOpen: false }, 'zeus')).toBe(
      'zeus-dev',
    );
  });

  it("falls back to the newest run of the workspace's project, worktree included", () => {
    const state = { sessions, activeSessionId: 'shell', isOpen: true };
    expect(pickRunToStop(state, 'apollo')).toBe('apollo-dev');
    // A worktree's scope id starts with its project's id.
    expect(pickRunToStop(state, 'apollo~feature-x')).toBe('apollo-dev');
  });

  it('falls back to the newest run when the project has none', () => {
    expect(pickRunToStop({ sessions, activeSessionId: null, isOpen: false }, 'hermes')).toBe(
      'zeus-dev',
    );
    expect(pickRunToStop({ sessions, activeSessionId: null, isOpen: false }, null)).toBe(
      'zeus-dev',
    );
  });

  it('never picks a plain shell or an agent tab', () => {
    const noRuns = [session('shell'), session('agent')];
    expect(pickRunToStop({ sessions: noRuns, activeSessionId: 'shell', isOpen: true }, null)).toBe(
      null,
    );
  });
});

describe('stopping', () => {
  it('stopRun closes the tab, which ends the shell and what it started', () => {
    useTerminalStore.setState({ sessions: [session('dev', { run: run('Dev') })] });

    stopRun('dev');

    expect(bridge.$fn('terminal.kill')).toHaveBeenCalledWith('dev');
    expect(useTerminalStore.getState().sessions).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith('Stopped "Dev"');
  });

  it('stopRun does nothing for a tab that is already gone', () => {
    stopRun('missing');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('stopActiveRun stops the run the rules pick', () => {
    useTerminalStore.setState({
      sessions: [session('shell'), session('dev', { projectId: 'apollo', run: run() })],
      activeSessionId: 'shell',
      isOpen: true,
    });
    useWorkspaceStore.setState({ activeProjectId: 'apollo' });

    stopActiveRun();

    expect(bridge.$fn('terminal.kill')).toHaveBeenCalledWith('dev');
    expect(useTerminalStore.getState().sessions.map((s) => s.id)).toEqual(['shell']);
  });

  it('stopActiveRun says so when nothing is running, and kills nothing', () => {
    useTerminalStore.setState({ sessions: [session('shell')], activeSessionId: 'shell' });

    stopActiveRun();

    expect(toast.info).toHaveBeenCalledWith('Nothing is running');
    expect(useTerminalStore.getState().sessions).toHaveLength(1);
  });
});
