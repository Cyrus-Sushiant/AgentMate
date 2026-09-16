import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain, shell } from 'electron';
import { IPC } from '../../shared/ipcChannels';

const execFileAsync = promisify(execFile);

export function registerShellHandlers(): void {
  ipcMain.handle(IPC.shell.openExternal, async (_event, url: string): Promise<void> => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Refusing to open URL with scheme "${parsed.protocol}"`);
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC.shell.openPath, async (_event, path: string): Promise<void> => {
    const error = await shell.openPath(path);
    if (error) throw new Error(error);
  });

  ipcMain.handle(IPC.shell.openInEditor, async (_event, path: string): Promise<void> => {
    try {
      // `code` is a .cmd shim on Windows, which Node won't spawn directly; route through
      // cmd.exe with an argv array (not `shell: true`) so the path is never string-concatenated.
      if (process.platform === 'win32') {
        await execFileAsync('cmd.exe', ['/d', '/s', '/c', 'code', path], { windowsHide: true });
      } else {
        await execFileAsync('code', [path]);
      }
    } catch {
      throw new Error(
        'Could not open VS Code. Make sure it is installed and "code" is on your PATH.',
      );
    }
  });
}
