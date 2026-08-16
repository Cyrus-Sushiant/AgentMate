import type { BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;
let factory: (() => BrowserWindow) | null = null;

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

/** Brings the app to the front, restoring or recreating the window as needed. */
export function focusMainWindow(): void {
  const win = getMainWindow() ?? factory?.() ?? null;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}
