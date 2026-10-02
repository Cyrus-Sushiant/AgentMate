import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { electronState, Notification } from '../../test/main/electronMock';
import { focusMainWindow } from '../mainWindow';
import { registerNotificationActivation, showOsNotification } from './osNotification';

vi.mock('../mainWindow', () => ({ focusMainWindow: vi.fn() }));

type Listener = (...args: unknown[]) => void;

const realPlatform = process.platform;
let listeners: Map<string, Listener>[] = [];
let activation: ((details: { type: string; arguments: string }) => void) | null = null;

beforeEach(() => {
  listeners = [];
  activation = null;
  vi.mocked(focusMainWindow).mockClear();
  vi.spyOn(Notification.prototype, 'on').mockImplementation(function (
    this: Notification,
    event: string,
    listener: Listener,
  ) {
    const index = electronState.notifications.indexOf(this.options);
    listeners[index] ??= new Map();
    listeners[index].set(event, listener);
    return this;
  } as unknown as () => Notification);
  Object.assign(Notification, {
    handleActivation: (handler: typeof activation) => {
      activation = handler;
    },
  });
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform });
  vi.restoreAllMocks();
});

function click(index: number): void {
  listeners[index]?.get('click')?.();
}

/** The `launch` arguments of the Windows toast the notification was built from. */
function launchArgs(index: number): string {
  const xml = (electronState.notifications[index] as { toastXml?: string }).toastXml ?? '';
  return (xml.match(/launch="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&');
}

describe('OS notification clicks', () => {
  it('opens the route in the main window by default', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    showOsNotification({ title: 'Done', body: 'All good', route: '/terminal-session/a' });
    click(0);
    expect(focusMainWindow).toHaveBeenCalledWith('/terminal-session/a');
  });

  it('runs onClick instead of opening a route when one is given', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const onClick = vi.fn();
    showOsNotification({ title: 'AI task paused', body: 'Server', route: '', onClick });
    click(0);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(focusMainWindow).not.toHaveBeenCalled();
  });

  it('runs onClick once for a Windows toast, from either the toast or its activation', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    registerNotificationActivation();
    const onClick = vi.fn();
    showOsNotification({ title: 'AI task paused', body: 'Server', route: '', onClick });

    // Windows fires both for one click.
    click(0);
    activation?.({ type: 'click', arguments: launchArgs(0) });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(focusMainWindow).not.toHaveBeenCalled();
  });

  it('runs onClick from an Action Center activation after the toast object is gone', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    registerNotificationActivation();
    const onClick = vi.fn();
    showOsNotification({ title: 'AI wants to act', body: 'Server', route: '', onClick });

    activation?.({ type: 'click', arguments: launchArgs(0) });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(focusMainWindow).not.toHaveBeenCalled();
  });

  it('still opens the route from a Windows activation without onClick', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    registerNotificationActivation();
    showOsNotification({ title: 'Done', body: 'All good', route: '/terminal-session/b' });
    activation?.({ type: 'click', arguments: launchArgs(0) });
    expect(focusMainWindow).toHaveBeenCalledWith('/terminal-session/b');
  });
});
