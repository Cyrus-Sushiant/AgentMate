import { app, ipcMain } from 'electron';
import type { UpdateStatus } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { takePendingRoute } from '../mainWindow';
import { checkForUpdates, downloadUpdate, pauseDownload, quitAndInstall } from '../updater';

/**
 * Unpackaged runs (electron-vite dev, or `electron .` against the built
 * output without an installer) always carry whatever version happens to be
 * sitting in package.json, which is meaningless outside a real release. The
 * CD pipeline is the only thing that writes a real version there, and only
 * for packaged builds. So dev/local runs report a fixed 'dev' string instead.
 */
export function registerAppHandlers(): void {
  ipcMain.handle(IPC.app.getVersion, (): string => (app.isPackaged ? app.getVersion() : 'dev'));
  ipcMain.handle(IPC.app.checkForUpdates, (): Promise<UpdateStatus> => checkForUpdates(true));
  ipcMain.handle(IPC.app.downloadUpdate, (): Promise<void> => downloadUpdate());
  ipcMain.handle(IPC.app.pauseDownload, (): void => pauseDownload());
  ipcMain.handle(IPC.app.quitAndInstall, (): void => quitAndInstall());
  ipcMain.handle(IPC.app.pendingNavigate, (): string | null => takePendingRoute());
  // app.quit(), not app.exit(): exit() skips before-quit, so the terminal sessions,
  // pet window, hook server and watchers registered there would never be torn down
  // and every relaunch would orphan the spawned CLI/PTY children.
  ipcMain.handle(IPC.app.relaunch, (): void => {
    app.relaunch();
    app.quit();
  });
}
