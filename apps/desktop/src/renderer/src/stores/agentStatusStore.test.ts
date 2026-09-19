import type { AutoContinuePending } from '@agentmat/core';
import type { AgentSessionEntry, AutoContinuePendingMap } from '@shared/apiTypes';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type FakeBridge, installAgentmatBridge } from '../../../test/renderer/agentmatBridge';

// The runtime owns real xterm instances, which the workspace store only calls when a tab closes.
vi.mock('@/lib/terminal/terminalRuntime', () => ({
  terminalRuntime: { dispose: vi.fn(), mount: vi.fn(), unmount: vi.fn(), focus: vi.fn() },
}));

const PENDING: AutoContinuePending = { kind: 'network', fireAt: 1_800_000_000_000, attempt: 1 };

/**
 * `initAgentStatus` starts once per app, so each test loads the stores fresh and starts them
 * against its own bridge, with one Claude Code tab that has the limit option on.
 */
async function start(pending: AutoContinuePendingMap = {}) {
  vi.resetModules();
  const bridge: FakeBridge = installAgentmatBridge({
    'agents.list': {},
    'agents.runInfos': {},
    'agents.autoContinuePending': pending,
  });
  const { useWorkspaceStore } = await import('./workspaceStore');
  const status = await import('./agentStatusStore');
  useWorkspaceStore.getState().openProject('p1');
  const tabId = useWorkspaceStore.getState().addTerminal('p1', {
    title: 'Claude Code',
    cwd: 'E:\\proj',
    cliId: 'claude-code',
  });
  useWorkspaceStore.getState().setAutoContinue('p1', tabId, { afterLimitReset: true });
  status.initAgentStatus();
  await waitFor(() => expect(bridge.$fn('agents.autoContinuePending')).toHaveBeenCalled());
  const lastSync = (): AgentSessionEntry[] =>
    bridge.$fn('agents.sync').mock.calls.at(-1)?.[0] as AgentSessionEntry[];
  return { bridge, tabId, useWorkspaceStore, ...status, lastSync };
}

beforeEach(() => {
  vi.resetModules();
});

describe('auto-continue in the agent status store', () => {
  it('sends each tab its auto-continue options, so main knows what to watch', async () => {
    const { tabId, lastSync } = await start();
    expect(lastSync()).toEqual([
      expect.objectContaining({
        sessionId: tabId,
        cliId: 'claude-code',
        autoContinue: { afterLimitReset: true },
      }),
    ]);
  });

  it('syncs again when an option changes', async () => {
    const { tabId, lastSync, useWorkspaceStore } = await start();
    useWorkspaceStore.getState().setAutoContinue('p1', tabId, { afterNetworkError: true });
    await waitFor(() =>
      expect(lastSync()[0]?.autoContinue).toEqual({
        afterLimitReset: true,
        afterNetworkError: true,
      }),
    );
  });

  it('starts from what main has scheduled, then follows its updates', async () => {
    const { bridge, tabId, useAgentStatusStore, useAutoContinuePending } = await start();
    act(() => bridge.$emit('agents.onAutoContinue', { [tabId]: PENDING }));
    expect(useAgentStatusStore.getState().autoContinue[tabId]).toEqual(PENDING);

    const { result } = renderHook(() => useAutoContinuePending(tabId));
    expect(result.current).toEqual(PENDING);

    act(() => bridge.$emit('agents.onAutoContinue', { [tabId]: null }));
    expect(result.current).toBeNull();

    const later: AutoContinuePending = { kind: 'limit', fireAt: 1_900_000_000_000, attempt: 1 };
    act(() => bridge.$emit('agents.onAutoContinue', { [tabId]: later }));
    expect(result.current).toEqual(later);
  });

  it('takes the continues main already had scheduled when it starts', async () => {
    const { useAgentStatusStore } = await start({ 'restored-tab': PENDING });
    await waitFor(() =>
      expect(useAgentStatusStore.getState().autoContinue['restored-tab']).toEqual(PENDING),
    );
  });

  it('has nothing scheduled for a tab main never mentioned', async () => {
    const { useAutoContinuePending } = await start();
    const { result } = renderHook(() => useAutoContinuePending('some-other-tab'));
    expect(result.current).toBeNull();
  });
});
