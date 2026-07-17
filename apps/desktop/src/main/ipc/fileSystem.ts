import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { app, dialog, ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { DirectoryEntry } from '../../shared/apiTypes';
import { assertPathWithinRoots } from '../pathGuard';
import { store } from '../store';

async function allowedRoots(): Promise<string[]> {
  const projects = await store.getProjects();
  return [app.getPath('userData'), ...projects.map((p) => p.folderPath)];
}

export function registerFileSystemHandlers(): void {
  ipcMain.handle(IPC.fs.readFile, async (_event, path: string): Promise<string> => {
    const safePath = assertPathWithinRoots(path, await allowedRoots());
    return readFile(safePath, 'utf-8');
  });

  ipcMain.handle(
    IPC.fs.writeFile,
    async (_event, path: string, content: string): Promise<void> => {
      const safePath = assertPathWithinRoots(path, await allowedRoots());
      await mkdir(dirname(safePath), { recursive: true });
      await writeFile(safePath, content, 'utf-8');
    },
  );

  ipcMain.handle(
    IPC.fs.listDirectory,
    async (_event, path: string): Promise<DirectoryEntry[]> => {
      const safePath = assertPathWithinRoots(path, await allowedRoots());
      const entries = await readdir(safePath, { withFileTypes: true });
      return entries
        .map((entry) => ({
          name: entry.name,
          path: join(safePath, entry.name),
          isDirectory: entry.isDirectory(),
        }))
        .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
    },
  );

  ipcMain.handle(
    IPC.fs.writeScratchFile,
    async (_event, fileName: string, content: string): Promise<string> => {
      const scratchDir = join(app.getPath('userData'), 'scratch');
      await mkdir(scratchDir, { recursive: true });
      const filePath = join(scratchDir, basename(fileName));
      await writeFile(filePath, content, 'utf-8');
      return filePath;
    },
  );

  ipcMain.handle(
    IPC.fs.saveFileAs,
    async (_event, defaultFileName: string, content: string): Promise<string | null> => {
      const result = await dialog.showSaveDialog({ defaultPath: defaultFileName });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, content, 'utf-8');
      return result.filePath;
    },
  );
}
