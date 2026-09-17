import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { app, clipboard, ipcMain, nativeImage } from 'electron';
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

/** Longest side of the preview shown when hovering an image chip in a terminal. */
const PREVIEW_MAX_SIDE = 480;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

/**
 * A data URL of an image file, or null when the file is gone or isn't an image. For a hover
 * preview PNG and JPEG are scaled down first (the only formats nativeImage decodes everywhere);
 * anything else, and the full-size view, goes out as it is, within the paste size limit.
 */
async function previewImage(path: string, fullSize: boolean): Promise<string | null> {
  const mime = MIME_BY_EXTENSION[extname(path).toLowerCase()];
  if (!mime) return null;
  const info = await stat(path).catch(() => null);
  if (!info?.isFile() || info.size > MAX_IMAGE_BYTES) return null;
  if (!fullSize && (mime === 'image/png' || mime === 'image/jpeg')) {
    const image = nativeImage.createFromPath(path);
    if (image.isEmpty()) return null;
    const { width, height } = image.getSize();
    const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(width, height));
    if (scale === 1) return image.toDataURL();
    return image
      .resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        quality: 'good',
      })
      .toDataURL();
  }
  const bytes = await readFile(path).catch(() => null);
  return bytes ? `data:${mime};base64,${bytes.toString('base64')}` : null;
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

  ipcMain.handle(IPC.terminalClipboard.previewImage, (_event, path: unknown, fullSize: unknown) =>
    typeof path === 'string' ? previewImage(path, fullSize === true) : null,
  );

  // Every terminal paste reads the clipboard here rather than in the renderer. The renderer's
  // own clipboard API only ever sees text, and only while the document has focus, which is why
  // pasting a screenshot with Ctrl+V used to do nothing and Ctrl+V right after the window
  // regained focus (Win+V's flyout, alt-tab) could silently fail.
  ipcMain.handle(IPC.terminalClipboard.read, async (): Promise<TerminalClipboardPaste | null> => {
    const file = copiedFilePath();
    if (file) return { kind: 'files', paths: [file] };
    // Text copied from a web page can come with an image of itself; the text is what was meant.
    const text = clipboard.readText();
    if (text) return { kind: 'text', text };
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      return { kind: 'files', paths: [await saveImage(image.toPNG(), 'png')] };
    }
    return null;
  });
}
