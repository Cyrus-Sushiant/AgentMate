import { ipcMain, shell } from 'electron';
import { IPC } from '../../shared/ipcChannels';

export function registerShellHandlers(): void {
  ipcMain.handle(IPC.shell.openExternal, async (_event, url: string): Promise<void> => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Refusing to open URL with scheme "${parsed.protocol}"`);
    }
    await shell.openExternal(url);
  });
}
