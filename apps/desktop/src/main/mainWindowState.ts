import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, type BrowserWindow, type Rectangle, screen } from 'electron';

/** Size of the very first window, before there is anything to remember. */
export const DEFAULT_MAIN_WINDOW_SIZE = { width: 1440, height: 860 };
export const MAIN_WINDOW_MIN_SIZE = { width: 960, height: 600 };

/** Resizing and dragging fire dozens of events a second; one write after they settle is enough. */
const SAVE_DELAY_MS = 500;

export interface MainWindowState {
  /** The restored (not maximized) bounds, so un-maximizing goes back to the size the user picked. */
  bounds: Rectangle | null;
  isMaximized: boolean;
}

let cached: MainWindowState | null = null;

function stateFile(): string {
  return join(app.getPath('userData'), 'data', 'window-state.json');
}

function isRect(value: unknown): value is Rectangle {
  if (!value || typeof value !== 'object') return false;
  const rect = value as Record<string, unknown>;
  return ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]));
}

function readState(): MainWindowState {
  try {
    const saved = JSON.parse(readFileSync(stateFile(), 'utf-8')) as Record<string, unknown>;
    return {
      bounds: isRect(saved.bounds) ? saved.bounds : null,
      isMaximized: saved.isMaximized === true,
    };
  } catch {
    // Missing on first launch, and a damaged file is not worth failing startup over.
    return { bounds: null, isMaximized: false };
  }
}

function writeState(state: MainWindowState): void {
  cached = state;
  try {
    const file = stateFile();
    mkdirSync(join(file, '..'), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    renameSync(tmp, file);
  } catch {
    // Losing the window size is harmless; the next change tries again.
  }
}

export function loadMainWindowState(): MainWindowState {
  cached ??= readState();
  return cached;
}

/** True when enough of `bounds` is on a connected screen to grab the title bar. */
function isOnScreen(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea }) => {
    const left = Math.max(bounds.x, workArea.x);
    const right = Math.min(bounds.x + bounds.width, workArea.x + workArea.width);
    const top = Math.max(bounds.y, workArea.y);
    const bottom = Math.min(bounds.y + bounds.height, workArea.y + workArea.height);
    return right - left >= 100 && bottom - top >= 50;
  });
}

/**
 * Size and position for a new main window. A position is only reused while it
 * still lands on a connected screen, so unplugging a monitor can't strand the
 * window off screen; the size is kept either way and Electron centers it.
 */
export function mainWindowBounds(
  state: MainWindowState,
): Partial<Rectangle> & { width: number; height: number } {
  if (!state.bounds) return { ...DEFAULT_MAIN_WINDOW_SIZE };
  const width = Math.max(MAIN_WINDOW_MIN_SIZE.width, Math.round(state.bounds.width));
  const height = Math.max(MAIN_WINDOW_MIN_SIZE.height, Math.round(state.bounds.height));
  const placed = { x: Math.round(state.bounds.x), y: Math.round(state.bounds.y), width, height };
  return isOnScreen(placed) ? placed : { width, height };
}

/**
 * Remembers the window's size, position and maximized state as it changes, so
 * the next launch opens the way this one was left.
 *
 * Maximized is tracked from the maximize/unmaximize events rather than asked for
 * at close time: a maximized window that was minimized and then closed from the
 * taskbar reports `isMaximized() === false`, and it should still come back maximized.
 */
export function trackMainWindowState(win: BrowserWindow, startMaximized: boolean): void {
  let isMaximized = startMaximized;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (win.isDestroyed()) return;
    // Full screen is a passing mode; the bounds from before it are what to keep.
    const bounds = win.isFullScreen() ? (cached?.bounds ?? null) : win.getNormalBounds();
    writeState({ bounds, isMaximized });
  };
  const saveSoon = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };

  win.on('maximize', () => {
    isMaximized = true;
    save();
  });
  win.on('unmaximize', () => {
    isMaximized = false;
    save();
  });
  win.on('resize', saveSoon);
  win.on('move', saveSoon);
  // Written right away: the app may be about to quit and a pending timer would never run.
  win.on('close', save);
}
