// @vitest-environment jsdom

import type { AppNotification } from '@agentmat/core';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastHistoryStore } from '@/stores/toastHistoryStore';
import { useAppNotificationMessages } from './useAppNotificationMessages';

const toastFns = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  message: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: toastFns }));

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'pipeline-failure',
    title: 'CI failed',
    body: 'Demo · main · run #42',
    projectId: 'p1',
    projectName: 'Demo',
    htmlUrl: 'https://github.com/acme/demo/actions/runs/123',
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

let inbox: AppNotification[] = [];
let changed: (() => void) | null = null;

function Probe(): React.JSX.Element {
  useAppNotificationMessages();
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

async function mount(): Promise<void> {
  render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
  await act(async () => undefined);
}

async function inboxChanged(next: AppNotification[]): Promise<void> {
  inbox = next;
  await act(async () => {
    changed?.();
  });
}

beforeEach(() => {
  inbox = [];
  changed = null;
  useToastHistoryStore.setState({ items: [], open: false });
  for (const fn of Object.values(toastFns)) fn.mockReset();
  Object.assign(window, {
    agentmat: {
      shell: { openExternal: vi.fn(async () => undefined) },
      appNotifications: {
        list: vi.fn(async () => inbox),
        markRead: vi.fn(async () => []),
        onChanged: (callback: () => void) => {
          changed = callback;
          return () => {
            changed = null;
          };
        },
      },
    },
  });
});

afterEach(cleanup);

describe('useAppNotificationMessages', () => {
  it('leaves what was already in the inbox at startup alone', async () => {
    inbox = [notification()];
    await mount();
    expect(toastFns.error).not.toHaveBeenCalled();
    expect(useToastHistoryStore.getState().items).toEqual([]);
  });

  it('flashes a colored toast and files a linked row in history for a new failure', async () => {
    await mount();
    await inboxChanged([notification()]);

    expect(toastFns.error).toHaveBeenCalledTimes(1);
    const [title, options] = toastFns.error.mock.calls[0];
    expect(title).toBe('CI failed');
    expect(options.action.label).toBe('Open');

    const items = useToastHistoryStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'error',
      tag: 'Failed',
      projectId: 'p1',
      link: { route: '/pipelines?run=123&repo=acme%2Fdemo', notificationId: 'n1' },
    });
  });

  it('calls a passing run success, and only announces each entry once', async () => {
    await mount();
    const pass = notification({ id: 'n2', kind: 'pipeline-success', title: 'CI passed' });
    await inboxChanged([pass]);
    await inboxChanged([pass]);

    expect(toastFns.success).toHaveBeenCalledTimes(1);
    expect(useToastHistoryStore.getState().items[0]).toMatchObject({ tag: 'Passed' });
  });

  it('opens the run in the app from the toast button and marks it read', async () => {
    await mount();
    await inboxChanged([notification()]);

    const options = toastFns.error.mock.calls[0][1];
    await act(async () => options.action.onClick());

    expect(document.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/pipelines?run=123&repo=acme%2Fdemo',
    );
    expect(window.agentmat.appNotifications.markRead).toHaveBeenCalledWith('n1');
    expect(window.agentmat.shell.openExternal).not.toHaveBeenCalled();
  });

  it('sends a non-pipeline link to the browser', async () => {
    await mount();
    await inboxChanged([
      notification({
        kind: 'tool-update-available',
        title: 'CLI update',
        projectId: null,
        htmlUrl: 'https://www.npmjs.com/package/x',
      }),
    ]);

    expect(toastFns.info).toHaveBeenCalledTimes(1);
    await act(async () => toastFns.info.mock.calls[0][1].action.onClick());
    expect(window.agentmat.shell.openExternal).toHaveBeenCalledWith(
      'https://www.npmjs.com/package/x',
    );
  });
});
