import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, clipboard, ipcMain } from 'electron';
import type { TerminalClipboardPaste } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';

/**
 * Lets a terminal take more than text from the clipboard, the way agent CLIs expect: a copied
 * screenshot becomes an image file whose path is pasted (Claude Code and Codex attach an image
 * given its path), and copied files paste as their paths.
 */

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/** Pasted images are only needed for the session they were pasted into. */
const KEEP_PASTED_MS = 7 * 24 * 60 * 60 * 1000;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
};

function pastedDir(): string {
  return join(app.getPath('userData'), 'pasted-images');
}

async function pruneOld(dir: string): Promise<void> {
  const cutoff = Date.now() - KEEP_PASTED_MS;
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    const path = join(dir, name);
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs < cutoff) await rm(path, { force: true }).catch(() => undefined);
  }
}

async function saveImage(bytes: Uint8Array, extension: string): Promise<string> {
  const dir = pastedDir();
  await mkdir(dir, { recursive: true });
  void pruneOld(dir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `pasted-${stamp}-${randomUUID().slice(0, 6)}.${extension}`);
  await writeFile(path, bytes);
  return path;
}

/** A file path Windows Explorer put on the clipboard, if it copied exactly one file. */
function copiedFilePath(): string | null {
  if (process.platform !== 'win32') return null;
  try {
    const raw = clipboard.readBuffer('FileNameW');
    if (raw.length === 0) return null;
    const path = raw.toString('utf16le').replace(/\0+$/, '').trim();
    return path || null;
  } catch {
    return null;
  }
}

export function registerTerminalClipboardHandlers(): void {
  ipcMain.handle(
    IPC.terminalClipboard.saveImage,
    async (_event, bytes: unknown, mime: unknown): Promise<string> => {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        throw new Error('Nothing to save.');
      }
      if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('That image is too large to paste.');
      const extension = typeof mime === 'string' ? EXTENSIONS[mime] : undefined;
      if (!extension) throw new Error('Only images can be pasted as files.');
      return saveImage(bytes, extension);
    },
  );

  // Right-click paste reads the clipboard itself, so it asks here for what text-only
  // clipboard access cannot see.
  ipcMain.handle(
    IPC.terminalClipboard.readSpecial,
    async (): Promise<TerminalClipboardPaste | null> => {
      const file = copiedFilePath();
      if (file) return { kind: 'files', paths: [file] };
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        return { kind: 'files', paths: [await saveImage(image.toPNG(), 'png')] };
      }
      return null;
    },
  );
}
