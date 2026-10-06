import type { AppSettings } from '@agentmat/core';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

/**
 * The shell, for the one choice it makes itself: where the main menu goes. The sidebar and the
 * top menu bar are tested on their own; this pins down that the setting picks exactly one of
 * them, that the sidebar's fold button goes with the sidebar, and that a saved change takes
 * effect without a reload.
 *
 * Everything the shell hosts that has nothing to do with the menu (the workspace, the terminal
 * drawer, the dialogs, the status bar) is stubbed out, as are the app-wide listeners it starts.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

vi.mock('@/components/askAi/AskAiModal', () => ({ AskAiModal: () => null }));
vi.mock('@/components/search/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('@/components/terminal/RunningClisDialog', () => ({ RunningClisDialog: () => null }));
vi.mock('@/components/terminal/TerminalDrawer', () => ({ TerminalDrawer: () => null }));
vi.mock('@/components/toast/ToastHistoryPanel', () => ({ ToastHistoryPanel: () => null }));
vi.mock('@/components/UpdateManager', () => ({ UpdateStatusChip: () => null }));
vi.mock('@/components/workspace/WorkspaceHeaderActions', () => ({
  WorkspaceHeaderActions: () => null,
}));
vi.mock('@/components/workspace/WorkspaceHost', () => ({ WorkspaceHost: () => null }));
vi.mock('./StatusBar', () => ({ StatusBar: () => null }));
vi.mock('./LoadingOverlay', () => ({ LoadingOverlay: () => null }));

vi.mock('@/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: () => undefined }));
vi.mock('@/hooks/useVaultEvents', () => ({ useVaultEvents: () => undefined }));
vi.mock('@/hooks/useAppNotificationMessages', () => ({
  useAppNotificationMessages: () => undefined,
}));
vi.mock('@/hooks/useScheduledTaskRunner', () => ({ useScheduledTaskRunner: () => undefined }));
vi.mock('@/hooks/usePetDragGuard', () => ({ usePetDragGuard: () => undefined }));
vi.mock('@/hooks/useRememberRoute', () => ({ useRememberRoute: () => undefined }));
vi.mock('@/lib/terminal/runSessionFeed', () => ({ startRunSessionFeed: () => () => undefined }));
vi.mock('@/stores/agentStatusStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/agentStatusStore')>()),
  initAgentStatus: () => undefined,
}));
vi.mock('@/stores/sshAgentStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/sshAgentStore')>()),
  initSshAgentStatus: () => undefined,
}));

// The shell scrolls the page back to the top on every route change, and jsdom has no scrolling.
Element.prototype.scrollTo = () => undefined;

const { AppShell } = await import('./AppShell');

/** Only the field the shell reads. */
function settingsWith(menuPosition: AppSettings['menuPosition']): AppSettings {
  return { menuPosition } as AppSettings;
}

/** Renders the shell and waits for its settings read, so what is on screen is the saved choice. */
async function renderShell(menuPosition: AppSettings['menuPosition']) {
  const view = renderWithProviders(<AppShell />, {
    route: '/usage',
    bridge: { 'settings.get': settingsWith(menuPosition) },
  });
  await waitFor(() =>
    expect(view.queryClient.getQueryState(queryKeys.settings)?.status).toBe('success'),
  );
  return view;
}

const sidebar = (): HTMLElement | null => screen.queryByRole('complementary');
const topMenu = (): HTMLElement | null => screen.queryByRole('navigation', { name: 'Main menu' });
const sidebarToggle = (): HTMLElement | null =>
  screen.queryByRole('button', { name: /(Collapse|Hide|Show) sidebar/ });

describe('AppShell main menu position', () => {
  it('shows the sidebar and its fold button when the menu is on the left', async () => {
    await renderShell('left');

    expect(sidebar()).not.toBeNull();
    expect(topMenu()).toBeNull();
    expect(sidebarToggle()).not.toBeNull();
  });

  it('swaps the sidebar for the top menu bar when the menu is on top', async () => {
    await renderShell('top');

    expect(topMenu()).not.toBeNull();
    expect(sidebar()).toBeNull();
    // Nothing left to fold away, so the button goes too.
    expect(sidebarToggle()).toBeNull();
  });

  it('moves the menu as soon as the saved setting changes, without a reload', async () => {
    const { queryClient, bridge } = await renderShell('left');
    expect(sidebar()).not.toBeNull();

    // What the Settings page does with the answer to a save. React Query tells its readers on
    // the next tick, hence the wait, but nothing is fetched again.
    act(() => queryClient.setQueryData(queryKeys.settings, settingsWith('top')));
    await waitFor(() => expect(topMenu()).not.toBeNull());
    expect(sidebar()).toBeNull();

    act(() => queryClient.setQueryData(queryKeys.settings, settingsWith('left')));
    await waitFor(() => expect(sidebar()).not.toBeNull());
    expect(topMenu()).toBeNull();
    expect(bridge.$fn('settings.get')).toHaveBeenCalledTimes(1);
  });
});
