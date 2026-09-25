import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipcChannels';
import {
  electronState,
  FakeBrowserWindow,
  type FakeIpcEvent,
  fakeWebContents,
  nativeTheme,
} from '../test/main/electronMock';

vi.mock('../../resources/icon.ico?asset', () => ({ default: 'icon.ico' }));

const splash = await import('./splashWindow');

type Listener = (...args: unknown[]) => void;

/** A main window whose webContents events a test can fire. */
function mainWindow(): FakeBrowserWindow & {
  fireContents: (event: string, ...args: unknown[]) => void;
} {
  const win = new FakeBrowserWindow() as FakeBrowserWindow & {
    fireContents: (event: string, ...args: unknown[]) => void;
  };
  const listeners = new Map<string, Listener[]>();
  const record = (event: string, listener: unknown): void => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener as Listener]);
  };
  win.webContents.on = record;
  win.webContents.once = record;
  win.fireContents = (event, ...args) => {
    for (const listener of listeners.get(event) ?? []) listener(...args);
  };
  return win;
}

function sendReady(from = fakeWebContents()): void {
  const event = {
    sender: from,
    senderFrame: null,
    preventDefault: () => undefined,
  } as FakeIpcEvent;
  for (const listener of electronState.listeners.get(IPC.app.rendererReady) ?? []) listener(event);
}

function splashWindow(): FakeBrowserWindow | undefined {
  return FakeBrowserWindow.instances.find((one) => one.options.width === 520);
}

/** Puts the splash up and marks it shown, the way `ready-to-show` would. */
function openSplash(): FakeBrowserWindow {
  splash.showSplash('dark');
  const win = splashWindow();
  if (!win) throw new Error('no splash window');
  win.emit('ready-to-show');
  return win;
}

describe('startup theme', () => {
  afterEach(() => {
    nativeTheme.shouldUseDarkColors = true;
  });

  it('follows the OS for the system theme', () => {
    nativeTheme.shouldUseDarkColors = false;
    expect(splash.resolveStartupTheme('system')).toBe('light');
    nativeTheme.shouldUseDarkColors = true;
    expect(splash.resolveStartupTheme('system')).toBe('dark');
  });

  it('opens the main window on the page color of the chosen theme', () => {
    expect(splash.themeBackground('light')).toBe('#f5f5f5');
    expect(splash.themeBackground('dark')).toBe('#0a0a0a');
    expect(splash.themeBackground('vscode-dark')).toBe('#1f1f1f');
    expect(splash.themeBackground('vs2026')).toBe('#181921');
  });
});

describe('splash window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    splash.getSplash()?.destroy();
    vi.useRealTimers();
  });

  it('is a small frameless window that only shows once it has painted', () => {
    splash.showSplash('light');
    const win = splashWindow();
    expect(win?.options).toMatchObject({ width: 520, height: 320, frame: false, show: false });
    expect(win?.visible).toBe(false);
    win?.emit('ready-to-show');
    expect(win?.visible).toBe(true);
  });

  it('opens only one splash per launch', () => {
    splash.showSplash('dark');
    splash.showSplash('dark');
    expect(FakeBrowserWindow.instances.filter((one) => one.options.width === 520)).toHaveLength(1);
  });

  it('lets startup carry on if the splash never finishes loading', async () => {
    let up = false;
    void splash.showSplash('dark').then(() => {
      up = true;
    });
    splashWindow()?.emit('ready-to-show');
    await vi.advanceTimersByTimeAsync(1500);
    expect(up).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(up).toBe(true);
  });

  it('lets startup carry on when the splash is closed early', async () => {
    let up = false;
    void splash.showSplash('dark').then(() => {
      up = true;
    });
    splashWindow()?.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(up).toBe(true);
  });

  it('passes the startup status on to the page', () => {
    const win = openSplash();
    splash.setSplashStatus('Starting services...');
    expect(win.webContents.sentOn(IPC.splash.onStatus)).toEqual([['Starting services...']]);
  });
});

describe('handing over to the main window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    splash.getSplash()?.destroy();
    vi.useRealTimers();
  });

  it('keeps the main window hidden until its own renderer says it is ready', () => {
    const win = openSplash();
    const main = mainWindow();
    splash.handOffWhenReady(main as unknown as BrowserWindow);

    // A widget or pet window runs the same bundle; its word doesn't count.
    sendReady();
    vi.advanceTimersByTime(1000);
    expect(main.visible).toBe(false);

    sendReady(main.webContents);
    vi.advanceTimersByTime(1000);
    expect(main.visible).toBe(true);
    expect(win.webContents.sentOn(IPC.splash.onClose)).toHaveLength(1);
    expect(win.destroyed).toBe(true);
    expect(electronState.listeners.get(IPC.app.rendererReady)).toEqual([]);
  });

  it('keeps the splash up for a moment even when the app loads instantly', () => {
    openSplash();
    const main = mainWindow();
    splash.handOffWhenReady(main as unknown as BrowserWindow);
    sendReady(main.webContents);
    vi.advanceTimersByTime(300);
    expect(main.visible).toBe(false);
    vi.advanceTimersByTime(500);
    expect(main.visible).toBe(true);
  });

  it('shows the main window anyway if it never reports ready', () => {
    openSplash();
    const main = mainWindow();
    splash.handOffWhenReady(main as unknown as BrowserWindow);
    vi.advanceTimersByTime(14_000);
    expect(main.visible).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(main.visible).toBe(true);
    expect(splash.getSplash()).toBeNull();
  });

  it('shows the main window when its renderer crashes or fails to load', () => {
    openSplash();
    const crashed = mainWindow();
    splash.handOffWhenReady(crashed as unknown as BrowserWindow);
    crashed.fireContents('render-process-gone');
    vi.advanceTimersByTime(1000);
    expect(crashed.visible).toBe(true);

    openSplash();
    const failed = mainWindow();
    splash.handOffWhenReady(failed as unknown as BrowserWindow);
    // An aborted load is replaced by another one, so it isn't a failure.
    failed.fireContents('did-fail-load', {}, -3, 'ERR_ABORTED', 'app://', true);
    vi.advanceTimersByTime(1000);
    expect(failed.visible).toBe(false);
    failed.fireContents('did-fail-load', {}, -6, 'ERR_FILE_NOT_FOUND', 'app://', true);
    vi.advanceTimersByTime(1000);
    expect(failed.visible).toBe(true);
  });

  it('takes the splash down if the main window closes during startup', () => {
    const win = openSplash();
    const main = mainWindow();
    splash.handOffWhenReady(main as unknown as BrowserWindow);
    main.close();
    expect(win.destroyed).toBe(true);
    // A late ready or the timeout must not touch the closed window.
    sendReady(main.webContents);
    vi.advanceTimersByTime(20_000);
    expect(main.visible).toBe(false);
  });

  it('reveals through the show function it was given', () => {
    openSplash();
    const main = mainWindow();
    const show = vi.fn();
    splash.handOffWhenReady(main as unknown as BrowserWindow, show);
    sendReady(main.webContents);
    vi.advanceTimersByTime(1000);
    // The caller decides how the window goes up (maximized or not), not the splash.
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('reveals straight away when there is no splash (test mode)', () => {
    const main = mainWindow();
    splash.handOffWhenReady(main as unknown as BrowserWindow);
    sendReady(main.webContents);
    expect(main.visible).toBe(true);
  });
});
