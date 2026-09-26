import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import { configureBrowserSession, setupBrowserGuests, wireGuest } from './guestSession';

/**
 * The Electron wiring around the rules in guestGuard.ts: which events are hooked on the app
 * window, what a guest page may open and which of its key presses reach the app.
 */

type Listener = (...args: unknown[]) => void;

function emitter() {
  const listeners = new Map<string, Listener[]>();
  return {
    listeners,
    on(event: string, listener: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
  };
}

function fakeHost() {
  const events = emitter();
  const sent: { channel: string; args: unknown[] }[] = [];
  return {
    ...events,
    id: 1,
    isDestroyed: () => false,
    send: (channel: string, ...args: unknown[]) => sent.push({ channel, args }),
    sent,
  };
}

function fakeGuest() {
  const events = emitter();
  let openHandler: ((details: { url: string }) => { action: string }) | null = null;
  return {
    ...events,
    id: 42,
    setWindowOpenHandler: (handler: typeof openHandler) => {
      openHandler = handler;
    },
    open: (url: string) => openHandler?.({ url }),
  };
}

describe('wireGuest', () => {
  it('turns a popup into a new browser tab instead of a window', () => {
    const host = fakeHost();
    const guest = fakeGuest();
    wireGuest(guest as never, host as never, 'win32');
    expect(guest.open('https://example.com/login')).toEqual({ action: 'deny' });
    expect(host.sent).toEqual([
      {
        channel: IPC.browser.onOpenInNewTab,
        args: [{ webContentsId: 42, url: 'https://example.com/login' }],
      },
    ]);
  });

  it('refuses popups to anything but a web page', () => {
    const host = fakeHost();
    const guest = fakeGuest();
    wireGuest(guest as never, host as never, 'win32');
    expect(guest.open('file:///C:/secret.txt')).toEqual({ action: 'deny' });
    expect(host.sent).toEqual([]);
  });

  it('hands browser shortcuts to the app and keeps them from the page', () => {
    const host = fakeHost();
    const guest = fakeGuest();
    wireGuest(guest as never, host as never, 'win32');
    const event = { preventDefault: vi.fn() };
    guest.emit('before-input-event', event, {
      type: 'keyDown',
      key: 'C',
      control: true,
      shift: true,
      meta: false,
      alt: false,
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(host.sent).toEqual([
      { channel: IPC.browser.onGuestShortcut, args: [{ webContentsId: 42, shortcut: 'pick' }] },
    ]);
  });

  it('leaves other keys to the page', () => {
    const host = fakeHost();
    const guest = fakeGuest();
    wireGuest(guest as never, host as never, 'win32');
    const event = { preventDefault: vi.fn() };
    guest.emit('before-input-event', event, { type: 'keyDown', key: 'a', control: false });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(host.sent).toEqual([]);
  });
});

describe('configureBrowserSession', () => {
  it('refuses permissions a page has no use for and hides the Electron user agent', () => {
    const handlers: {
      request?: (wc: unknown, permission: string, done: (ok: boolean) => void) => void;
      check?: (wc: unknown, permission: string) => boolean;
    } = {};
    const session = {
      getUserAgent: () => 'Mozilla/5.0 Chrome/140.0.0.0 Electron/43.3.0 Safari/537.36',
      setUserAgent: vi.fn(),
      setPermissionRequestHandler: (handler: typeof handlers.request) => {
        handlers.request = handler;
      },
      setPermissionCheckHandler: (handler: typeof handlers.check) => {
        handlers.check = handler;
      },
    };
    configureBrowserSession(session as never);
    expect(session.setUserAgent).toHaveBeenCalledWith('Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36');
    const answers: boolean[] = [];
    handlers.request?.(null, 'media', (ok) => answers.push(ok));
    handlers.request?.(null, 'clipboard-sanitized-write', (ok) => answers.push(ok));
    expect(answers).toEqual([false, true]);
    expect(handlers.check?.(null, 'geolocation')).toBe(false);
  });
});

describe('setupBrowserGuests', () => {
  it('guards every webview the window attaches and wires it once attached', () => {
    const host = fakeHost();
    setupBrowserGuests({ webContents: host } as never);

    const blocked = { preventDefault: vi.fn() };
    host.emit('will-attach-webview', blocked, {}, { src: 'file:///C:/x' });
    expect(blocked.preventDefault).toHaveBeenCalled();

    const allowed = { preventDefault: vi.fn() };
    const prefs: Record<string, unknown> = { nodeIntegration: true };
    host.emit('will-attach-webview', allowed, prefs, { src: 'http://localhost:3000/' });
    expect(allowed.preventDefault).not.toHaveBeenCalled();
    expect(prefs.nodeIntegration).toBe(false);

    const guest = fakeGuest();
    host.emit('did-attach-webview', {}, guest);
    expect(guest.listeners.has('before-input-event')).toBe(true);
  });
});
