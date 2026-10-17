import type { DevDetection, DevSetupEnvironment } from '@agentmat/core';
import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalStore } from '@/stores/terminalStore';
import {
  renderHookWithProviders,
  userEvent,
} from '../../../../../test/renderer/renderWithProviders';
import { useDevSetup } from './useDevSetup';

/**
 * The hook behind the Dev Setup panel. The things worth pinning are the ones the experience
 * depends on: each row resolving on its own instead of waiting for the slowest probe, a failed
 * probe becoming a row rather than a crash, the terminal hand-off re-checking by itself, and the
 * user's stack choices surviving a reload.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const WIN: DevSetupEnvironment = { os: 'win32', arch: 'x64', packageManagers: ['winget'] };
const found = (version: string): DevDetection => ({
  state: 'found',
  version,
  path: null,
  onPath: true,
});
const absent: DevDetection = { state: 'absent' };

/** A detect() that answers from a map, and says "absent" for anything not listed. */
function detectFrom(answers: Record<string, DevDetection | Promise<DevDetection>>) {
  return (id: string) => Promise.resolve(answers[id] ?? absent);
}

function bridgeFor(
  options: {
    stacks?: string[];
    detect?: (id: string, options?: { force?: boolean }) => Promise<DevDetection>;
    environment?: DevSetupEnvironment | (() => Promise<DevSetupEnvironment>);
  } = {},
) {
  return {
    'settings.get': { devSetupStacks: options.stacks ?? ['essentials'] },
    'settings.update': async (patch: unknown) => patch,
    'devSetup.environment': options.environment ?? WIN,
    'devSetup.detect': options.detect ?? detectFrom({}),
  };
}

beforeEach(() => {
  toast.info.mockReset();
  toast.error.mockReset();
  useTerminalStore.setState({ sessions: [], activeSessionId: null, isOpen: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDevSetup: loading', () => {
  it('has no checklist until the machine has been described', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({ environment: () => new Promise(() => undefined) }),
    });

    expect(result.current.checklist).toBeUndefined();
    expect(result.current.environmentFailed).toBe(false);
  });

  it('lists the Essentials items, each one checking until its own probe answers', async () => {
    const pending = new Promise<DevDetection>(() => undefined);
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({
        detect: (id) =>
          id === 'node' ? pending : Promise.resolve(id === 'git' ? found('2.55.0') : absent),
      }),
    });

    await waitFor(() => expect(result.current.checklist).toBeDefined());
    await waitFor(() => {
      const states = Object.fromEntries(
        result.current.checklist?.rows.map((row) => [row.item.id, row.state.kind]) ?? [],
      );
      // git has answered, node is still thinking, and neither waited for the other.
      expect(states.git).toBe('installed');
      expect(states.node).toBe('checking');
      expect(states.gh).toBe('missing');
    });
  });

  it('turns a probe that failed to run into a row, not a crash', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({
        detect: (id) =>
          id === 'git' ? Promise.reject(new Error('spawn blew up')) : Promise.resolve(absent),
      }),
    });

    await waitFor(() => {
      const git = result.current.checklist?.rows.find((row) => row.item.id === 'git');
      expect(git?.state).toEqual({ kind: 'unknown', message: 'spawn blew up' });
    });
  });

  it('reports that the machine could not be described, and can try again', async () => {
    let calls = 0;
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({
        environment: () => {
          calls += 1;
          return calls === 1 ? Promise.reject(new Error('nope')) : Promise.resolve(WIN);
        },
      }),
    });

    await waitFor(() => expect(result.current.environmentFailed).toBe(true));
    expect(result.current.checklist).toBeUndefined();

    act(() => result.current.retryEnvironment());
    await waitFor(() => expect(result.current.checklist).toBeDefined());
    expect(result.current.environmentFailed).toBe(false);
  });
});

describe('useDevSetup: stacks', () => {
  it('shows Essentials until the saved settings say otherwise', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: { ...bridgeFor(), 'settings.get': () => new Promise(() => undefined) },
    });

    expect(result.current.stacks).toEqual(['essentials']);
  });

  it('reads the stacks the user chose, and lists their items', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({ stacks: ['essentials', 'docker'] }),
    });

    await waitFor(() => expect(result.current.stacks).toEqual(['essentials', 'docker']));
    await waitFor(() =>
      expect(result.current.checklist?.rows.map((row) => row.item.id)).toContain('docker-desktop'),
    );
  });

  it('saves a stack when it is switched on, and takes it back out when it is switched off', async () => {
    const { result, bridge } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({ stacks: ['essentials', 'dotnet'] }),
    });
    await waitFor(() => expect(result.current.stacks).toEqual(['essentials', 'dotnet']));

    act(() => result.current.toggleStack('docker'));
    await waitFor(() =>
      expect(bridge.$fn('settings.update')).toHaveBeenLastCalledWith({
        devSetupStacks: ['essentials', 'dotnet', 'docker'],
      }),
    );

    act(() => result.current.toggleStack('dotnet'));
    await waitFor(() =>
      expect(bridge.$fn('settings.update')).toHaveBeenLastCalledWith({
        devSetupStacks: ['essentials'],
      }),
    );
  });

  it('never lets Essentials be switched off', async () => {
    const { result, bridge } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor(),
    });
    await waitFor(() => expect(result.current.checklist).toBeDefined());

    act(() => result.current.toggleStack('essentials'));

    expect(() => bridge.$fn('settings.update')).toThrow();
  });

  it('ignores a stack id that is not in the catalog', async () => {
    const { result, bridge } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor(),
    });
    await waitFor(() => expect(result.current.checklist).toBeDefined());

    act(() => result.current.toggleStack('bogus'));

    expect(() => bridge.$fn('settings.update')).toThrow();
  });

  it('shows the new choice straight away, before the save comes back', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: {
        ...bridgeFor(),
        'settings.update': () => new Promise(() => undefined),
      },
    });
    await waitFor(() => expect(result.current.checklist).toBeDefined());

    act(() => result.current.toggleStack('flutter'));

    await waitFor(() => expect(result.current.stacks).toEqual(['essentials', 'flutter']));
  });

  it('says so when the choice could not be saved', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: { ...bridgeFor(), 'settings.update': () => Promise.reject(new Error('disk full')) },
    });
    await waitFor(() => expect(result.current.checklist).toBeDefined());

    act(() => result.current.toggleStack('docker'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not save your choice.'));
  });
});

describe('useDevSetup: checking again', () => {
  it('asks for a fresh answer when told to check one item again', async () => {
    const detect = vi.fn(detectFrom({}));
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({ detect }),
    });
    await waitFor(() => expect(result.current.checklist?.summary.checking).toBe(0));
    detect.mockClear();

    act(() => result.current.recheck('git'));

    await waitFor(() => expect(detect).toHaveBeenCalledWith('git', { force: true }));
    expect(detect).not.toHaveBeenCalledWith('node', expect.anything());
  });

  it('checks everything again, and the machine too, since a package manager may have been added', async () => {
    const detect = vi.fn(detectFrom({}));
    const { result, bridge } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({ detect }),
    });
    await waitFor(() => expect(result.current.checklist?.summary.checking).toBe(0));
    detect.mockClear();
    bridge.$fn('devSetup.environment').mockClear();

    act(() => result.current.recheckAll());

    await waitFor(() => expect(detect).toHaveBeenCalledWith('node', { force: true }));
    expect(detect).toHaveBeenCalledWith('git', { force: true });
    await waitFor(() => expect(bridge.$fn('devSetup.environment')).toHaveBeenCalled());
  });
});

describe('useDevSetup: the terminal hand-off', () => {
  const COMMAND = 'winget install --id GitHub.cli';

  it('opens a terminal with the command typed in but not run, and tells the person what to do', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), { bridge: bridgeFor() });
    await waitFor(() => expect(result.current.checklist).toBeDefined());

    act(() => result.current.openInTerminal({ id: 'gh', name: 'GitHub CLI', command: COMMAND }));

    const [session] = useTerminalStore.getState().sessions;
    expect(session).toMatchObject({ title: 'Install GitHub CLI', initialInput: COMMAND });
    expect(session?.initialInput?.endsWith('\n')).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Press Enter in the terminal to install GitHub CLI.');
  });

  it('marks the row as waiting for the terminal', async () => {
    const { result } = renderHookWithProviders(() => useDevSetup(), { bridge: bridgeFor() });
    await waitFor(() => expect(result.current.checklist?.summary.checking).toBe(0));

    act(() => result.current.openInTerminal({ id: 'gh', name: 'GitHub CLI', command: COMMAND }));

    const gh = result.current.checklist?.rows.find((row) => row.item.id === 'gh');
    expect(gh?.state).toEqual({ kind: 'waiting-terminal' });
  });

  it('checks again every few seconds while waiting, and stops once the tool turns up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let installed = false;
    const detect = vi.fn(async (id: string) =>
      id === 'gh' && installed ? found('2.62.0') : absent,
    );
    const { result } = renderHookWithProviders(() => useDevSetup(), {
      bridge: bridgeFor({ detect }),
    });
    await waitFor(() => expect(result.current.checklist?.summary.checking).toBe(0));

    act(() => result.current.openInTerminal({ id: 'gh', name: 'GitHub CLI', command: COMMAND }));
    detect.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_200);
    });
    expect(detect.mock.calls.filter(([id]) => id === 'gh').length).toBeGreaterThanOrEqual(1);

    installed = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_200);
    });
    await waitFor(() => {
      const gh = result.current.checklist?.rows.find((row) => row.item.id === 'gh');
      expect(gh?.state).toMatchObject({ kind: 'installed', version: '2.62.0' });
    });

    // Found, so it is no longer being waited on and the polling stops.
    detect.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000);
    });
    expect(detect.mock.calls.filter(([id]) => id === 'gh')).toHaveLength(0);
  });

  it('gives up waiting after ten minutes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHookWithProviders(() => useDevSetup(), { bridge: bridgeFor() });
    await waitFor(() => expect(result.current.checklist?.summary.checking).toBe(0));
    act(() => result.current.openInTerminal({ id: 'gh', name: 'GitHub CLI', command: COMMAND }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000 + 6_000);
    });

    await waitFor(() => {
      const gh = result.current.checklist?.rows.find((row) => row.item.id === 'gh');
      expect(gh?.state.kind).toBe('missing');
    });
  });

  it('copies the command to the clipboard', async () => {
    // renderHookWithProviders does not set userEvent up, and that is what installs a clipboard.
    userEvent.setup();
    const { result } = renderHookWithProviders(() => useDevSetup(), { bridge: bridgeFor() });
    await waitFor(() => expect(result.current.checklist).toBeDefined());

    await act(async () => {
      await result.current.copyCommand({ name: 'GitHub CLI', command: COMMAND });
    });

    // userEvent.setup() replaces navigator.clipboard, so the text is read back rather than spied on.
    expect(await navigator.clipboard.readText()).toBe(COMMAND);
    expect(toast.success).toHaveBeenCalledWith('Copied the command for GitHub CLI.');
  });
});
