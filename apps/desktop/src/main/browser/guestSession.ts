import type { BrowserWindow, Session, WebContents } from 'electron';
import type { BrowserGuestShortcut, BrowserOpenInNewTab } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { sendToContents } from '../ipc/send';
import {
  browserUserAgent,
  guestPermissionAllowed,
  guestShortcut,
  sanitizeWebviewAttach,
} from './guestGuard';

/**
 * Hooks the workspace browser's webviews into the app: every guest is checked before it
 * attaches, popups become new browser tabs, and the browser's own shortcuts reach the app while a
 * page has focus. The rules themselves are in guestGuard.ts.
 */

function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function wireGuest(
  guest: WebContents,
  host: WebContents,
  platform: NodeJS.Platform = process.platform,
): void {
  guest.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) {
      const payload: BrowserOpenInNewTab = { webContentsId: guest.id, url };
      sendToContents(host, IPC.browser.onOpenInNewTab, payload);
    }
    return { action: 'deny' };
  });

  guest.on('before-input-event', (event, input) => {
    const shortcut = guestShortcut(input, platform);
    if (!shortcut) return;
    event.preventDefault();
    const payload: BrowserGuestShortcut = { webContentsId: guest.id, shortcut };
    sendToContents(host, IPC.browser.onGuestShortcut, payload);
  });
}

/** Settings for the browser's own session, applied once at startup. */
export function configureBrowserSession(session: Session): void {
  session.setUserAgent(browserUserAgent(session.getUserAgent()));
  session.setPermissionRequestHandler((_contents, permission, done) =>
    done(guestPermissionAllowed(permission)),
  );
  session.setPermissionCheckHandler((_contents, permission) => guestPermissionAllowed(permission));
}

export function setupBrowserGuests(win: BrowserWindow): void {
  const host = win.webContents;
  host.on('will-attach-webview', (event, webPreferences, params) => {
    const allowed = sanitizeWebviewAttach(
      webPreferences as Record<string, unknown>,
      params as unknown as Record<string, string>,
    );
    if (!allowed) event.preventDefault();
  });
  host.on('did-attach-webview', (_event, guest) => wireGuest(guest, host));
}
