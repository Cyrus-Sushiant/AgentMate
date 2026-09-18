import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DirectoryEntry } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { queueDialog } from '../../test/main/electronMock';
import { tempDir, writeTree } from '../../test/main/fixtures';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * The generic file IPC the renderer uses to read and write project files. Every path it takes
 * comes straight from the renderer, so the interesting half of these tests is the rejections:
 * anything outside userData or a registered project folder must never be touched.
 */

const userData = useTempUserData();
const project = { dir: '' };

expectChannelsCovered(IPC.fs);

beforeEach(async () => {
  project.dir = tempDir('agentmate-fs-project-');
  writeTree(project.dir, {
    'README.md': '# demo\n',
    'src/index.ts': 'export const a = 1;\n',
  });
  mkdirSync(join(project.dir, 'src', 'nested'), { recursive: true });
  userData.writeData('projects.json', [
    { id: 'p1', name: 'Demo', folderPath: project.dir, createdAt: new Date().toISOString() },
  ]);
  await loadIpc(
    () => import('./fileSystem'),
    (module) => module.registerFileSystemHandlers(),
  );
});

describe('fs:readFile', () => {
  it('reads a file inside a registered project folder', async () => {
    expect(await invoke<string>(IPC.fs.readFile, join(project.dir, 'README.md'))).toBe('# demo\n');
  });

  it('refuses a path outside every allowed root', async () => {
    // A sibling temp folder: it exists and is readable, so only the guard stops this.
    const outside = writeTree(tempDir('agentmate-fs-outside-'), { 'secret.txt': 'do not read' });
    await expect(invoke(IPC.fs.readFile, join(outside, 'secret.txt'))).rejects.toThrow(
      'outside of the allowed directories',
    );
  });

  it('refuses a traversal that climbs out of the project folder', async () => {
    const climb = join(project.dir, 'src', '..', '..', 'etc-passwd-stand-in');
    writeFileSync(join(project.dir, '..', 'etc-passwd-stand-in'), 'nope', 'utf-8');
    await expect(invoke(IPC.fs.readFile, climb)).rejects.toThrow(
      'outside of the allowed directories',
    );
  });

  it('reads the app data folder, which is an allowed root too', async () => {
    expect(await invoke<string>(IPC.fs.readFile, userData.dataFile('projects.json'))).toContain(
      'Demo',
    );
  });
});

describe('fs:writeFile', () => {
  it('writes inside the project and creates missing parent folders', async () => {
    const target = join(project.dir, 'docs', 'deep', 'notes.md');
    await invoke(IPC.fs.writeFile, target, 'hello');
    expect(readFileSync(target, 'utf-8')).toBe('hello');
  });

  it('refuses to write outside the allowed roots even though the parent exists', async () => {
    const outside = tempDir('agentmate-fs-outside-write-');
    await expect(invoke(IPC.fs.writeFile, join(outside, 'planted.txt'), 'x')).rejects.toThrow(
      'outside of the allowed directories',
    );
  });

  it('stops a write aimed at a file that does not exist yet outside the roots', async () => {
    // The guard resolves the nearest existing ancestor, so a brand new path is still checked.
    const outside = tempDir('agentmate-fs-outside-new-');
    await expect(invoke(IPC.fs.writeFile, join(outside, 'a', 'b', 'c.txt'), 'x')).rejects.toThrow(
      'outside of the allowed directories',
    );
  });
});

describe('fs:listDirectory', () => {
  it('lists folders before files, each alphabetically', async () => {
    const entries = await invoke<DirectoryEntry[]>(IPC.fs.listDirectory, project.dir);
    expect(entries.map((entry) => entry.name)).toEqual(['src', 'README.md']);
    expect(entries[0]).toMatchObject({ isDirectory: true, path: join(project.dir, 'src') });
    expect(entries[1].isDirectory).toBe(false);
  });

  it('refuses a directory outside the allowed roots', async () => {
    const outside = tempDir('agentmate-fs-outside-list-');
    await expect(invoke(IPC.fs.listDirectory, outside)).rejects.toThrow(
      'outside of the allowed directories',
    );
  });
});

describe('fs:writeScratchFile', () => {
  it('writes under userData/scratch and returns the path', async () => {
    const written = await invoke<string>(IPC.fs.writeScratchFile, 'note.txt', 'scratch body');
    expect(written).toBe(join(userData.dir, 'scratch', 'note.txt'));
    expect(readFileSync(written, 'utf-8')).toBe('scratch body');
  });

  it('flattens a traversal in the file name instead of escaping the scratch folder', async () => {
    // basename is the whole guard here, so it is worth pinning down.
    const written = await invoke<string>(
      IPC.fs.writeScratchFile,
      join('..', '..', 'escaped.txt'),
      'x',
    );
    expect(written).toBe(join(userData.dir, 'scratch', 'escaped.txt'));
  });
});

describe('fs:saveFileAs', () => {
  it('writes to the path the save dialog returned', async () => {
    const target = join(tempDir('agentmate-fs-save-'), 'export.json');
    queueDialog('showSaveDialog', { canceled: false, filePath: target });
    expect(await invoke<string | null>(IPC.fs.saveFileAs, 'export.json', '{"a":1}')).toBe(target);
    expect(readFileSync(target, 'utf-8')).toBe('{"a":1}');
  });

  it('returns null and writes nothing when the dialog is cancelled', async () => {
    queueDialog('showSaveDialog', { canceled: true, filePath: undefined });
    expect(await invoke<string | null>(IPC.fs.saveFileAs, 'export.json', 'body')).toBeNull();
  });
});
