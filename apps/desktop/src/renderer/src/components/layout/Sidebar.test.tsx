import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAgentStatusStore } from '@/stores/agentStatusStore';
import { useUiStore } from '@/stores/uiStore';
import { useUpdateStore } from '@/stores/updateStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

/**
 * The sidebar is how the app is navigated, so the things worth pinning down are: every entry is
 * a real link, the entry for the page you are on is marked current, and the badges that pull
 * attention (unread pipeline failures, an agent waiting on you) only appear when they should.
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

const { NAV_ITEMS, Sidebar } = await import('./Sidebar');

function renderSidebar(route = '/', bridge: Record<string, unknown> = {}) {
  return renderWithProviders(<Sidebar />, { route, bridge });
}

/** The link marked as the current page by NavLink. */
function currentLink(): HTMLElement {
  return screen.getByRole('link', { current: 'page' });
}

describe('Sidebar navigation', () => {
  it('lists every destination as a link', () => {
    renderSidebar();

    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: new RegExp(item.label) })).toBeTruthy();
    }
  });

  it('marks the dashboard current at the root, and only the dashboard', () => {
    renderSidebar('/');

    expect(currentLink().textContent).toContain('Dashboard');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('marks the entry for the page being shown', () => {
    renderSidebar('/mcp');

    expect(currentLink().textContent).toContain('MCP Servers');
  });

  it('keeps a nested route under its own entry', () => {
    renderSidebar('/projects/abc');

    expect(currentLink().textContent).toContain('Projects');
  });

  it('keeps Prompt Builder lit on Prompt History, which has no entry of its own', () => {
    renderSidebar('/prompt-history');

    expect(screen.getByRole('link', { name: /Prompt Builder/ }).textContent).toContain(
      'Prompt Builder',
    );
    // Prompt History is reached from the builder, so the builder is what stays highlighted.
    expect(screen.queryByRole('link', { name: /Prompt History/ })).toBeNull();
  });

  it('collapses to icons only, keeping the links reachable', () => {
    renderSidebar('/usage');
    act(() => useUiStore.setState({ sidebarMode: 'collapsed' }));

    // The labels go, the links stay, and the current page is still marked.
    expect(screen.queryByText('Token Usage')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(NAV_ITEMS.length);
    expect(currentLink().getAttribute('href')).toContain('/usage');
  });

  it('empties out when hidden, so the page gets the full width', () => {
    renderSidebar('/usage');
    act(() => useUiStore.setState({ sidebarMode: 'hidden' }));

    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('Sidebar badges', () => {
  it('shows the unread pipeline count on Pipelines', async () => {
    renderSidebar('/', { 'appNotifications.unreadCount': async () => 3 });

    const pipelines = await screen.findByRole('link', { name: /Pipelines/ });
    await waitFor(() => expect(within(pipelines).getByText('3')).toBeTruthy());
  });

  it('caps a large unread count rather than stretching the sidebar', async () => {
    renderSidebar('/', { 'appNotifications.unreadCount': async () => 143 });

    const pipelines = await screen.findByRole('link', { name: /Pipelines/ });
    await waitFor(() => expect(within(pipelines).getByText('99+')).toBeTruthy());
  });

  it('refreshes the count when the main process reports a change', async () => {
    let unread = 1;
    const { bridge } = renderSidebar('/', {
      'appNotifications.unreadCount': async () => unread,
    });
    const pipelines = await screen.findByRole('link', { name: /Pipelines/ });
    await waitFor(() => expect(within(pipelines).getByText('1')).toBeTruthy());

    unread = 4;
    act(() => bridge.$emit('appNotifications.onChanged'));

    await waitFor(() => expect(within(pipelines).getByText('4')).toBeTruthy());
  });

  it('carries no badge when nothing is unread', async () => {
    renderSidebar('/', { 'appNotifications.unreadCount': async () => 0 });

    const pipelines = await screen.findByRole('link', { name: /Pipelines/ });
    await waitFor(() => expect(pipelines.textContent).toBe('Pipelines'));
  });

  it('survives a bridge that cannot answer the unread count', async () => {
    renderSidebar('/', {
      'appNotifications.unreadCount': () => Promise.reject(new Error('no database')),
    });

    const pipelines = await screen.findByRole('link', { name: /Pipelines/ });
    expect(pipelines.textContent).toBe('Pipelines');
  });
});

describe('Sidebar version and updates', () => {
  it('shows the running version', async () => {
    renderSidebar('/', { 'app.getVersion': async () => '2.4.1' });

    expect(await screen.findByRole('button', { name: /AgentMate v2\.4\.1/ })).toBeTruthy();
  });

  it('says so when a check finds nothing new', async () => {
    const { user } = renderSidebar('/', {
      'app.getVersion': async () => '2.4.1',
      'app.checkForUpdates': async () => ({ state: 'not-available' }),
    });

    await user.click(await screen.findByRole('button', { name: /AgentMate/ }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("You're on the latest version."),
    );
  });

  it('reports a failed check instead of looking like nothing happened', async () => {
    const { user } = renderSidebar('/', {
      'app.checkForUpdates': async () => ({ state: 'error', message: 'Update server down.' }),
    });

    await user.click(await screen.findByRole('button', { name: /AgentMate/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Update server down.'));
  });

  it('hands a found update to the update dialog rather than toasting it', async () => {
    const { user } = renderSidebar('/', {
      'app.checkForUpdates': async () => ({
        state: 'available',
        info: { version: '3.0.0', releaseDate: null, releaseNotes: null, sizeBytes: null },
        partialBytes: 0,
      }),
    });

    await user.click(await screen.findByRole('button', { name: /AgentMate/ }));

    await waitFor(() => expect(useUpdateStore.getState().dialogOpen).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('Sidebar workspace attention', () => {
  it('flags Workspace when an agent is waiting for an answer', async () => {
    renderSidebar('/');
    const workspace = screen.getByRole('link', { name: /Workspace/ });
    const before = workspace.childElementCount;

    act(() => useAgentStatusStore.setState({ statuses: { 'tab-1': 'needs-input' } }));

    await waitFor(() => expect(workspace.childElementCount).toBeGreaterThan(before));
  });
});
