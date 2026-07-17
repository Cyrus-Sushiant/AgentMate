import { ipcMain, type BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipcChannels';

export function registerWindowHandlers(win: BrowserWindow): void {
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
