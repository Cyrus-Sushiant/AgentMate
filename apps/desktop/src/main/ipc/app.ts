import { app, ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { UpdateStatus } from '../../shared/apiTypes';
import { checkForUpdates, downloadUpdate, quitAndInstall } from '../updater';

/**
 * Unpackaged runs (electron-vite dev, or `electron .` against the built
 * output without an installer) always carry whatever version happens to be
 * sitting in package.json, which is meaningless outside a real release — the
 * CD pipeline is the only thing that writes a real version there, and only
 * for packaged builds. So dev/local runs report a fixed 'dev' string instead.
 */
export function registerAppHandlers(): void {
  ipcMain.handle(IPC.app.getVersion, (): string => (app.isPackaged ? app.getVersion() : 'dev'));
  ipcMain.handle(IPC.app.checkForUpdates, (): Promise<UpdateStatus> => checkForUpdates(true));
  ipcMain.handle(IPC.app.downloadUpdate, (): Promise<void> => downloadUpdate());
  ipcMain.handle(IPC.app.quitAndInstall, (): void => quitAndInstall());
}
