import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBrowserWindow, setElectronPath } from '../test/main/electronMock';

let userData: string;

beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'agentmate-window-state-'));
  setElectronPath('userData', userData);
  // The module caches what it read, so each test starts from a fresh copy.
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(userData, { recursive: true, force: true });
});

function savedFile(): unknown {
  return JSON.parse(readFileSync(join(userData, 'data', 'window-state.json'), 'utf-8'));
}

describe('main window state', () => {
  it('opens at the default size the first time', async () => {
    const state = await import('./mainWindowState');
    const saved = state.loadMainWindowState();

    expect(saved).toEqual({ bounds: null, isMaximized: false });
    expect(state.mainWindowBounds(saved)).toEqual({ width: 1440, height: 860 });
  });

  it('comes back maximized after being closed maximized', async () => {
    const first = await import('./mainWindowState');
    const win = new FakeBrowserWindow();
    win.bounds = { x: 100, y: 80, width: 1200, height: 800 };
    first.trackMainWindowState(win as unknown as BrowserWindow, false);

    win.emit('maximize');
    win.emit('close');

    expect(savedFile()).toEqual({
      bounds: { x: 100, y: 80, width: 1200, height: 800 },
      isMaximized: true,
    });

    vi.resetModules();
    const next = await import('./mainWindowState');
    const restored = next.loadMainWindowState();
    expect(restored.isMaximized).toBe(true);
    expect(next.mainWindowBounds(restored)).toEqual({ x: 100, y: 80, width: 1200, height: 800 });
  });

  it('stays maximized when minimized from maximized and then closed', async () => {
    const state = await import('./mainWindowState');
    const win = new FakeBrowserWindow();
    state.trackMainWindowState(win as unknown as BrowserWindow, true);

    // A minimized window reports isMaximized() false; that must not be what gets saved.
    win.emit('minimize');
    win.emit('close');

    expect(savedFile()).toMatchObject({ isMaximized: true });
  });

  it('forgets maximized once the window is restored', async () => {
    const state = await import('./mainWindowState');
    const win = new FakeBrowserWindow();
    state.trackMainWindowState(win as unknown as BrowserWindow, true);

    win.emit('unmaximize');

    expect(savedFile()).toMatchObject({ isMaximized: false });
  });

  it('saves a resize once it settles', async () => {
    vi.useFakeTimers();
    const state = await import('./mainWindowState');
    const win = new FakeBrowserWindow();
    state.trackMainWindowState(win as unknown as BrowserWindow, false);

    win.bounds = { x: 10, y: 20, width: 1000, height: 700 };
    win.emit('resize');
    vi.advanceTimersByTime(1000);

    expect(savedFile()).toEqual({
      bounds: { x: 10, y: 20, width: 1000, height: 700 },
      isMaximized: false,
    });
  });

  it('drops a position that is no longer on any screen but keeps the size', async () => {
    const state = await import('./mainWindowState');
    const bounds = state.mainWindowBounds({
      bounds: { x: 5000, y: 3000, width: 1100, height: 750 },
      isMaximized: false,
    });

    expect(bounds).toEqual({ width: 1100, height: 750 });
  });

  it('never opens below the minimum size', async () => {
    const state = await import('./mainWindowState');
    const bounds = state.mainWindowBounds({
      bounds: { x: 0, y: 0, width: 300, height: 200 },
      isMaximized: false,
    });

    expect(bounds).toMatchObject({ width: 960, height: 600 });
  });
});
