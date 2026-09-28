import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { clipboard } from 'electron';

const execFileAsync = promisify(execFile);

/**
 * The files currently copied on this computer, the way Explorer, Finder and a Linux file manager
 * each put them on the clipboard. Shared by the RDP clipboard sync and the workspace explorer's
 * paste-from-OS feature.
 */

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
  return url ? [fileURLToPath(url, { windows: false })] : [];
}

function linuxPaths(): string[] {
  const raw = clipboard.read('text/uri-list') || clipboard.read('x-special/gnome-copied-files');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('file://'))
    .map((line) => fileURLToPath(line, { windows: false }));
}

/** The absolute paths of whatever is copied on the OS clipboard right now, top-level only. */
export async function osClipboardPaths(): Promise<string[]> {
  if (process.platform === 'win32') return windowsPaths();
  if (process.platform === 'darwin') return macPaths();
  return linuxPaths();
}
