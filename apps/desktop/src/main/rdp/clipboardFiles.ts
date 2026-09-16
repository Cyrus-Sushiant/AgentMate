import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { clipboard } from 'electron';
import type { RdpClipboardFiles, RdpFileEntry } from '../../shared/apiTypes';

const execFileAsync = promisify(execFile);

/**
 * Files copied in Explorer, Finder, or a Linux file manager, expanded into the flat list the
 * RDP clipboard channel wants. The session window turns them into a paste on the server, the
 * same thing Windows' own Remote Desktop client does with Ctrl+C here and Ctrl+V there.
 */

/** Files are read into memory before the server asks for them, so a copy has to stay modest. */
export const MAX_CLIPBOARD_COPY_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 1000;
const MAX_DEPTH = 32;

export interface ClipboardFileSet {
  files: RdpClipboardFiles;
  /** Absolute path per entry, `null` for folders. Only ever read back by index. */
  sources: (string | null)[];
}

/** A cheap marker of what's copied, so the full listing only runs when it changes. */
function rawSignature(): string {
  try {
    switch (process.platform) {
      case 'win32':
        return clipboard.readBuffer('FileNameW').toString('hex');
      case 'darwin':
        return clipboard.read('NSFilenamesPboardType') || clipboard.read('public.file-url');
      default:
        return clipboard.read('text/uri-list') || clipboard.read('x-special/gnome-copied-files');
    }
  } catch {
    return '';
  }
}

async function windowsPaths(): Promise<string[]> {
  // `FileNameW` only carries the first file. PowerShell reads the whole drop list.
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }',
      ],
      { windowsHide: true, timeout: 5000 },
    );
    const paths = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (paths.length > 0) return paths;
  } catch {
    // Fall back to the single file below.
  }
  const single = clipboard.readBuffer('FileNameW').toString('utf16le').replace(/\0+$/, '').trim();
  return single ? [single] : [];
}

function macPaths(): string[] {
  const plist = clipboard.read('NSFilenamesPboardType');
  if (plist) {
    return [...plist.matchAll(/<string>([^<]+)<\/string>/g)].map((match) =>
      match[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&'),
    );
  }
  const url = clipboard.read('public.file-url');
  return url ? [fileURLToPath(url)] : [];
}

function linuxPaths(): string[] {
  const raw = clipboard.read('text/uri-list') || clipboard.read('x-special/gnome-copied-files');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('file://'))
    .map((line) => fileURLToPath(line));
}

async function copiedPaths(): Promise<string[]> {
  if (process.platform === 'win32') return windowsPaths();
  if (process.platform === 'darwin') return macPaths();
  return linuxPaths();
}

/**
 * The files currently copied on this computer, or `null` when the clipboard holds none. Pass
 * the last signature seen to skip the work (and get `'unchanged'`) when nothing new was copied.
 */
export async function readClipboardFiles(
  previousSignature: string | null,
): Promise<ClipboardFileSet | 'unchanged' | null> {
  const signature = rawSignature();
  if (!signature) return null;
  if (signature === previousSignature) return 'unchanged';

  const entries: RdpFileEntry[] = [];
  const sources: (string | null)[] = [];
  let totalBytes = 0;

  async function add(absolute: string, parent: string | undefined, depth: number): Promise<void> {
    if (entries.length >= MAX_ENTRIES) return;
    const info = await stat(absolute).catch(() => null);
    if (!info) return;
    const name = basename(absolute);
    if (info.isDirectory()) {
      entries.push({
        name,
        path: parent,
        size: 0,
        lastModified: info.mtimeMs,
        isDirectory: true,
      });
      sources.push(null);
      if (depth >= MAX_DEPTH) return;
      const childParent = parent ? `${parent}\\${name}` : name;
      const children = await readdir(absolute).catch(() => [] as string[]);
      for (const child of children) await add(join(absolute, child), childParent, depth + 1);
    } else if (info.isFile()) {
      entries.push({
        name,
        path: parent,
        size: info.size,
        lastModified: info.mtimeMs,
        isDirectory: false,
      });
      sources.push(absolute);
      totalBytes += info.size;
    }
  }

  for (const path of await copiedPaths()) await add(path, undefined, 0);
  if (entries.length === 0) return null;

  return {
    files: {
      signature,
      entries,
      totalBytes,
      tooLarge: totalBytes > MAX_CLIPBOARD_COPY_BYTES,
    },
    sources,
  };
}
