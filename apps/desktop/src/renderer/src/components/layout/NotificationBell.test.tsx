// @vitest-environment jsdom

import type { AppNotification, Project } from '@agentmat/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { installDomShims } from '@/components/vault/testing/mockVaultApi';
import { NotificationBell } from './NotificationBell';

installDomShims();

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'tool-update-available',
    title: 'Claude Code CLI update available',
    body: '1.0.0 → 1.1.0',
    projectId: null,
    projectName: 'Claude Code CLI',
    htmlUrl: 'https://www.npmjs.com/package/@anthropic-ai/claude-code',
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

let onChangedCallback: (() => void) | null = null;

const PROJECT = {
  id: 'p1',
  name: 'Curalink',
  iconDataUrl: 'data:image/png;base64,AAAA',
  iconBgColor: null,
  iconColor: null,
} as unknown as Project;

function installApi(items: AppNotification[], projects: Project[] = []): void {
  Object.assign(window, {
    agentmat: {
      platform: 'win32',
      shell: { openExternal: vi.fn(async () => undefined) },
      projects: { list: vi.fn(async () => projects) },
      appNotifications: {
        list: vi.fn(async () => items),
        unreadCount: vi.fn(async () => items.filter((item) => !item.read).length),
        markRead: vi.fn(async (id: string) =>
          items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        ),
        markAllRead: vi.fn(async () => items.map((item) => ({ ...item, read: true }))),
        remove: vi.fn(async (id: string) => items.filter((item) => item.id !== id)),
        onChanged: (callback: () => void) => {
          onChangedCallback = callback;
          return () => {
            onChangedCallback = null;
          };
        },
      },
    },
  });
}

function LocationProbe(): React.JSX.Element {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

function renderBell(items: AppNotification[], projects: Project[] = []): void {
  installApi(items, projects);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <NotificationBell />
          <LocationProbe />
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  onChangedCallback = null;
});

afterEach(() => {
  expect(document.querySelectorAll('[title]')).toHaveLength(0);
  cleanup();
});

describe('NotificationBell', () => {
  it('shows no badge when there are no unread notifications', async () => {
    renderBell([notification({ read: true })]);
    await screen.findByRole('button', { name: 'Notifications' });
    expect(screen.queryByTestId('notification-bell-count')).toBeNull();
  });

  it('shows the unread count, capped at 9+', async () => {
    const items = Array.from({ length: 12 }, (_, i) => notification({ id: `n${i}` }));
    renderBell(items);
    await waitFor(() =>
      expect(screen.getByTestId('notification-bell-count').textContent).toBe('9+'),
    );
  });

  it('lists notifications in the dropdown, with title, body and mark-all-read', async () => {
    renderBell([
      notification(),
      notification({ id: 'n2', title: 'Another update', body: '2.0.0 → 2.1.0', read: true }),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    within(panel).getByText('Claude Code CLI update available');
    within(panel).getByText('1.0.0 → 1.1.0');
    within(panel).getByRole('button', { name: 'Mark all read' });
  });

  it("shows the project's icon and name on a project notification", async () => {
    renderBell(
      [
        notification({
          id: 'n1',
          kind: 'pipeline-failure',
          title: 'Build failed',
          projectId: 'p1',
          projectName: 'Curalink',
        }),
      ],
      [PROJECT],
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await waitFor(() =>
      expect(panel.querySelector('img[src="data:image/png;base64,AAAA"]')).not.toBeNull(),
    );
    within(panel).getByText('Curalink');
  });

  it('labels runs Failed or Passed', async () => {
    renderBell([
      notification({ id: 'f', kind: 'pipeline-failure', title: 'CI failed', projectName: 'Demo' }),
      notification({
        id: 'p',
        kind: 'pipeline-success',
        title: 'CI passed',
        projectName: 'Demo',
        read: true,
      }),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    within(panel).getByText('Failed');
    within(panel).getByText('Passed');
  });

  it('opens a pipeline run on the Pipelines page instead of GitHub', async () => {
    renderBell([
      notification({
        kind: 'pipeline-failure',
        title: 'CI failed',
        htmlUrl: 'https://github.com/acme/demo/actions/runs/123',
      }),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByText('CI failed'));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(
        '/pipelines?run=123&repo=acme%2Fdemo',
      ),
    );
    expect(window.agentmat.shell.openExternal).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(window.agentmat.appNotifications.markRead).toHaveBeenCalledWith('n1'),
    );
  });

  it('falls back to a kind glyph when the notification has no project', async () => {
    renderBell([notification()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(panel.querySelector('img')).toBeNull();
  });

  it('shows an empty state when there are no notifications', async () => {
    renderBell([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    await screen.findByText('No notifications yet');
  });

  it('marks a notification read and opens its link when clicked', async () => {
    const item = notification();
    renderBell([item]);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByText('Claude Code CLI update available'));

    await waitFor(() =>
      expect(window.agentmat.appNotifications.markRead).toHaveBeenCalledWith('n1'),
    );
    expect(window.agentmat.shell.openExternal).toHaveBeenCalledWith(item.htmlUrl);
  });

  it('marks every notification read when "Mark all read" is clicked', async () => {
    renderBell([notification(), notification({ id: 'n2' })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));

    await waitFor(() => expect(window.agentmat.appNotifications.markAllRead).toHaveBeenCalled());
  });

  it('refreshes when the main process reports a change', async () => {
    renderBell([notification({ read: true })]);
    await screen.findByRole('button', { name: 'Notifications' });
    expect(screen.queryByTestId('notification-bell-count')).toBeNull();

    (window.agentmat.appNotifications.unreadCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    expect(onChangedCallback).not.toBeNull();
    await act(async () => onChangedCallback?.());

    await waitFor(() =>
      expect(screen.getByTestId('notification-bell-count').textContent).toBe('1'),
    );
  });
});
