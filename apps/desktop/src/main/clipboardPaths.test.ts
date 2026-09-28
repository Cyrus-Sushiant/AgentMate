import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withPlatform } from '../test/main/fixtures';

/**
 * The OS clipboard's file list, read the way Explorer, Finder and a Linux file manager each put
 * it there. Shared by the RDP clipboard sync and the workspace explorer's paste-from-OS feature,
 * so it is tested on its own rather than through either of those.
 */

interface ClipboardStandIn {
  read: (format: string) => string;
  readBuffer: (format: string) => Buffer;
}

const execState = vi.hoisted(() => ({
  calls: [] as { file: string; args: string[] }[],
  outcomes: [] as ({ stdout?: string; error?: Error } | undefined)[],
}));

/**
 * The real execFile carries a `util.promisify.custom` implementation that resolves to
 * `{ stdout, stderr }`. Without it promisify would resolve to stdout alone, so the stand-in has
 * to provide the same symbol (see packageManagers/execUtils.test.ts for the same pattern).
 */
vi.mock('node:child_process', () => {
  const custom = Symbol.for('nodejs.util.promisify.custom');
  const execFile = Object.assign(() => undefined, {
    [custom]: (file: string, args: string[]) => {
      execState.calls.push({ file, args });
      const outcome = execState.outcomes.shift();
      if (outcome?.error) return Promise.reject(outcome.error);
      return Promise.resolve({ stdout: outcome?.stdout ?? '', stderr: '' });
    },
  });
  return { execFile };
});

let electron: { clipboard: ClipboardStandIn };

beforeEach(async () => {
  execState.calls = [];
  execState.outcomes = [];
  electron = (await import('electron')) as unknown as { clipboard: ClipboardStandIn };
  electron.clipboard.read = () => '';
  electron.clipboard.readBuffer = () => Buffer.alloc(0);
});

/** What Explorer puts beside a file copy: the first file's path, in UTF-16. */
function explorerCopied(first: string): void {
  electron.clipboard.readBuffer = (format) =>
    format === 'FileNameW' ? Buffer.from(`${first}\0`, 'utf16le') : Buffer.alloc(0);
}

describe('osClipboardPaths on win32', () => {
  it('reads every path PowerShell reports for a multi-file drop list', async () => {
    explorerCopied('C:\\pics\\a.png');
    execState.outcomes.push({ stdout: 'C:\\pics\\a.png\r\nC:\\pics\\b.png\r\n' });
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('win32', osClipboardPaths);

    expect(paths).toEqual(['C:\\pics\\a.png', 'C:\\pics\\b.png']);
    expect(execState.calls[0]?.file).toBe('powershell.exe');
  });

  it('falls back to the single FileNameW path when PowerShell reports nothing', async () => {
    explorerCopied('C:\\shots\\screen.png');
    execState.outcomes.push({ stdout: '' });
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('win32', osClipboardPaths);

    expect(paths).toEqual(['C:\\shots\\screen.png']);
  });

  it('falls back to the single FileNameW path when PowerShell fails', async () => {
    explorerCopied('C:\\shots\\screen.png');
    execState.outcomes.push({ error: new Error('powershell is not available') });
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('win32', osClipboardPaths);

    expect(paths).toEqual(['C:\\shots\\screen.png']);
  });

  it('skips PowerShell when the clipboard carries no file at all', async () => {
    // Every paste in the explorer asks, and most of the time the clipboard holds text.
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('win32', osClipboardPaths);

    expect(paths).toEqual([]);
    expect(execState.calls).toEqual([]);
  });
});

describe('osClipboardPaths on darwin', () => {
  it('reads every path out of the NSFilenamesPboardType plist, unescaping its XML entities', async () => {
    electron.clipboard.read = (format) =>
      format === 'NSFilenamesPboardType'
        ? '<string>/Users/me/a &amp; b.png</string><string>/Users/me/c.png</string>'
        : '';
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('darwin', osClipboardPaths);

    expect(paths).toEqual(['/Users/me/a & b.png', '/Users/me/c.png']);
  });

  it('falls back to the single public.file-url when there is no plist', async () => {
    electron.clipboard.read = (format) =>
      format === 'public.file-url' ? 'file:///Users/me/shot.png' : '';
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('darwin', osClipboardPaths);

    expect(paths).toEqual(['/Users/me/shot.png']);
  });

  it('returns no paths when neither pasteboard type holds anything', async () => {
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('darwin', osClipboardPaths);

    expect(paths).toEqual([]);
  });
});

describe('osClipboardPaths on linux', () => {
  it('reads every file:// line out of text/uri-list', async () => {
    electron.clipboard.read = (format) =>
      format === 'text/uri-list' ? 'file:///home/me/a.png\r\nfile:///home/me/b.png\r\n' : '';
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('linux', osClipboardPaths);

    expect(paths).toEqual(['/home/me/a.png', '/home/me/b.png']);
  });

  it('falls back to x-special/gnome-copied-files when text/uri-list is empty', async () => {
    electron.clipboard.read = (format) =>
      format === 'x-special/gnome-copied-files' ? 'copy\nfile:///home/me/c.png' : '';
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('linux', osClipboardPaths);

    expect(paths).toEqual(['/home/me/c.png']);
  });

  it('ignores anything that is not a file:// line', async () => {
    electron.clipboard.read = (format) =>
      format === 'text/uri-list' ? 'not-a-uri\r\nfile:///home/me/ok.png\r\n' : '';
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('linux', osClipboardPaths);

    expect(paths).toEqual(['/home/me/ok.png']);
  });

  it('returns no paths when neither format holds anything', async () => {
    const { osClipboardPaths } = await import('./clipboardPaths');

    const paths = await withPlatform('linux', osClipboardPaths);

    expect(paths).toEqual([]);
  });
});
