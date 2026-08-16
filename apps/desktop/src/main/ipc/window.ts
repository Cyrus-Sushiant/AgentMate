import { ipcMain, type BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipcChannels';

export function registerWindowHandlers(win: BrowserWindow): void {
  // The main window can be rebuilt (macOS dock activate, or the pet asking for
  // the app back), so point the handlers at the newest window instead of
  // throwing on a second registration.
  for (const channel of [
    IPC.window.minimize,
    IPC.window.maximizeToggle,
    IPC.window.close,
    IPC.window.isMaximized,
  ]) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC.window.minimize, () => win.minimize());
  ipcMain.handle(IPC.window.maximizeToggle, () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle(IPC.window.close, () => win.close());
  ipcMain.handle(IPC.window.isMaximized, () => win.isMaximized());

  win.on('maximize', () => win.webContents.send(IPC.window.onMaximizedChange, true));
  win.on('unmaximize', () => win.webContents.send(IPC.window.onMaximizedChange, false));
}
