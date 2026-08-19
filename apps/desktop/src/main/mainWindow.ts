import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipcChannels';

let mainWindow: BrowserWindow | null = null;
let factory: (() => BrowserWindow) | null = null;
let pendingRoute: string | null = null;

/** Records the app's main window so other parts of main can reach it later. */
export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

/**
 * Lets `focusMainWindow` rebuild the window on macOS, where closing it leaves
 * the app running with no window at all.
 */
export function setMainWindowFactory(create: () => BrowserWindow): void {
  factory = create;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

/**
 * Brings the app to the front, restoring or recreating the window as needed.
 * Pass a route (`/pipelines?run=...`) to land the renderer on a specific page.
 */
export function focusMainWindow(route?: string): void {
  const win = getMainWindow() ?? factory?.() ?? null;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  if (route) sendNavigate(win, route);
}

/**
 * A window that is still loading has no listener yet, and pushing at
 * `did-finish-load` can still land before React mounts. So the route is parked
 * and the renderer picks it up itself once it is ready.
 */
function sendNavigate(win: BrowserWindow, route: string): void {
  if (win.webContents.isLoading()) {
    pendingRoute = route;
    return;
  }
  win.webContents.send(IPC.app.onNavigate, route);
}

/** Hands over a route parked during startup, once. */
export function takePendingRoute(): string | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}
