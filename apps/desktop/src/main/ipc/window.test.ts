import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import { FakeBrowserWindow } from '../../test/main/electronMock';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * The frameless window's own controls. Worth testing because the handlers are registered again
 * every time the main window is rebuilt (macOS dock activate, or the pet asking for the app
 * back), and a second registration used to throw rather than point at the new window.
 */

useTempUserData();
expectChannelsCovered(IPC.window, [
  // Sent from main to the renderer rather than invoked, and asserted in its own test below.
  IPC.window.onMaximizedChange,
]);

async function register(win: FakeBrowserWindow): Promise<void> {
  await loadIpc(
    () => import('./window'),
    (module) => module.registerWindowHandlers(win as never),
  );
}

let win: FakeBrowserWindow;

beforeEach(async () => {
  win = new FakeBrowserWindow();
  await register(win);
});

describe('window controls', () => {
  it('minimizes the window it was registered with', async () => {
    const minimize = vi.spyOn(win, 'minimize');

    await invoke(IPC.window.minimize);

    expect(minimize).toHaveBeenCalledTimes(1);
  });

  it('closes the window', async () => {
    const close = vi.spyOn(win, 'close');

    await invoke(IPC.window.close);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('toggles between maximized and restored', async () => {
    const maximize = vi.spyOn(win, 'maximize');
    const unmaximize = vi.spyOn(win, 'unmaximize');

    // Not maximized, so the toggle maximizes.
    vi.spyOn(win, 'isMaximized').mockReturnValue(false);
    await invoke(IPC.window.maximizeToggle);
    expect(maximize).toHaveBeenCalledTimes(1);
    expect(unmaximize).not.toHaveBeenCalled();

    vi.spyOn(win, 'isMaximized').mockReturnValue(true);
    await invoke(IPC.window.maximizeToggle);
    expect(unmaximize).toHaveBeenCalledTimes(1);
  });

  it('reports whether the window is maximized', async () => {
    vi.spyOn(win, 'isMaximized').mockReturnValue(true);

    // The title bar draws a different icon for each state, so this has to be the live value.
    await expect(invoke(IPC.window.isMaximized)).resolves.toBe(true);
  });
});

describe('re-registering for a rebuilt window', () => {
  it('points the handlers at the newest window instead of throwing', async () => {
    const replacement = new FakeBrowserWindow();
    const oldMinimize = vi.spyOn(win, 'minimize');
    const newMinimize = vi.spyOn(replacement, 'minimize');

    // Electron throws on a second handle() for the same channel, so the module removes the old
    // handlers first. Without that, the app would crash when the window is recreated.
    await expect(register(replacement)).resolves.toBeUndefined();

    await invoke(IPC.window.minimize);
    expect(newMinimize).toHaveBeenCalledTimes(1);
    expect(oldMinimize).not.toHaveBeenCalled();
  });
});

describe('maximize events', () => {
  it('tells the renderer when the window is maximized and restored', async () => {
    win.emit('maximize');
    win.emit('unmaximize');

    expect(win.webContents.sentOn(IPC.window.onMaximizedChange)).toEqual([[true], [false]]);
  });
});
