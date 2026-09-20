import { BrowserWindow, type WebContents } from 'electron';

/**
 * Safe replacements for `webContents.send`.
 *
 * `isDestroyed()` alone is not enough. A window keeps its webContents object while its render
 * frame is being swapped out, which happens on every reload, navigation and dev-server hot
 * restart, and sending in that gap throws "Render frame was disposed before WebFrameMain could
 * be accessed". Nothing useful can be done about it: the listener on the other side is gone
 * either way, so the send is dropped and the sender carries on.
 */

export function sendToContents(
  contents: WebContents | null | undefined,
  channel: string,
  ...args: unknown[]
): void {
  if (!contents || contents.isDestroyed()) return;
  try {
    contents.send(channel, ...args);
  } catch {
    // The frame went away between the check and the send.
  }
}

export function sendToWindow(
  win: BrowserWindow | null | undefined,
  channel: string,
  ...args: unknown[]
): void {
  if (!win || win.isDestroyed()) return;
  sendToContents(win.webContents, channel, ...args);
}

/** Sends to every open window, skipping the ones that are closing or reloading. */
export function broadcastToWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) sendToWindow(win, channel, ...args);
}
