import type { Terminal } from '@xterm/xterm';
import { describe, expect, it, vi } from 'vitest';
import { createImageChipPreview, imagePathsIn } from './imageChipPreview';

describe('imagePathsIn', () => {
  it('finds a quoted Windows path', () => {
    expect(imagePathsIn("'C:\\Users\\A B\\shot.png' ")).toEqual(['C:\\Users\\A B\\shot.png']);
    expect(imagePathsIn('"C:\\pics\\shot.jpeg"')).toEqual(['C:\\pics\\shot.jpeg']);
  });

  it('finds an unquoted absolute path', () => {
    expect(imagePathsIn('C:\\pics\\shot.png')).toEqual(['C:\\pics\\shot.png']);
    expect(imagePathsIn('/home/me/shot.png')).toEqual(['/home/me/shot.png']);
    expect(imagePathsIn('~/Pictures/shot.png')).toEqual(['~/Pictures/shot.png']);
  });

  it('keeps backslashes in a Windows path but unescapes them elsewhere', () => {
    // A backslash is a separator on Windows and an escape character on every other platform.
    expect(imagePathsIn('/home/me/a\\ file.png')).toEqual(['/home/me/a file.png']);
    expect(imagePathsIn('C:\\pics\\a.png')).toEqual(['C:\\pics\\a.png']);
  });

  it('unescapes a doubled quote inside a quoted path', () => {
    expect(imagePathsIn("'/home/me/it''s.png'")).toEqual(["/home/me/it's.png"]);
    expect(imagePathsIn('"/home/me/say""hi"".png"')).toEqual(['/home/me/say"hi".png']);
  });

  it('finds every image in a line with several', () => {
    expect(imagePathsIn("'/a/one.png' '/a/two.jpg' notes.txt")).toEqual([
      '/a/one.png',
      '/a/two.jpg',
    ]);
  });

  it('takes every image extension an agent CLI can attach', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'PNG']) {
      expect(imagePathsIn(`/a/shot.${ext}`)).toEqual([`/a/shot.${ext}`]);
    }
  });

  it('ignores anything that is not an absolute image path', () => {
    expect(imagePathsIn('shot.png')).toEqual([]);
    expect(imagePathsIn('./shot.png')).toEqual([]);
    expect(imagePathsIn('/home/me/notes.txt')).toEqual([]);
    expect(imagePathsIn('/home/me/archive.png.zip')).toEqual([]);
    expect(imagePathsIn('')).toEqual([]);
  });

  it('looks past the escape sequences around a bracketed paste', () => {
    // The paste markers are not part of any path, and used to get glued to the first one.
    expect(imagePathsIn('\x1b[200~/home/me/shot.png\x1b[201~')).toEqual(['/home/me/shot.png']);
  });
});

/**
 * A terminal with just enough of an API for the preview to attach to: it registers an OSC-free
 * link provider, watches parsed writes and reads the visible rows.
 */
function fakeTerm(lines: string[] = []) {
  const linkDispose = vi.fn();
  const parsedDispose = vi.fn();
  // The parameter is declared so the recorded call keeps its type; xterm hands it a provider.
  const registerLinkProvider = vi.fn((_provider: unknown) => ({ dispose: linkDispose }));
  const onWriteParsed = vi.fn(() => ({ dispose: parsedDispose }));
  const term = {
    rows: lines.length,
    registerLinkProvider,
    onWriteParsed,
    registerMarker: vi.fn(() => ({ line: 0, dispose: vi.fn() })),
    buffer: {
      active: {
        type: 'normal',
        viewportY: 0,
        baseY: 0,
        cursorY: 0,
        getLine: (y: number) =>
          lines[y] === undefined ? undefined : { translateToString: () => lines[y] },
      },
    },
  };
  return { term: term as unknown as Terminal, registerLinkProvider, onWriteParsed, linkDispose };
}

describe('createImageChipPreview', () => {
  it('ignores a chunk with no image name in it', () => {
    // Most chunks are single keystrokes, and scanning each one for paths would be wasteful.
    const { term, onWriteParsed } = fakeTerm();
    const preview = createImageChipPreview(term);
    preview.noteOutgoing('ls -al\r');
    expect(onWriteParsed).not.toHaveBeenCalled();
    preview.dispose();
  });

  it('starts watching the screen once an image path goes out', () => {
    const { term, onWriteParsed } = fakeTerm(['']);
    const preview = createImageChipPreview(term);
    preview.noteOutgoing("'C:\\pics\\a.png' ");
    expect(onWriteParsed).toHaveBeenCalledTimes(1);
    preview.dispose();
  });

  it('ignores a file name that only looks like an image', () => {
    const { term, onWriteParsed } = fakeTerm(['']);
    const preview = createImageChipPreview(term);
    preview.noteOutgoing('report.png.txt');
    expect(onWriteParsed).not.toHaveBeenCalled();
    preview.dispose();
  });

  it('registers a link provider so a label can be hovered', () => {
    const { term, registerLinkProvider } = fakeTerm();
    const preview = createImageChipPreview(term);
    expect(registerLinkProvider).toHaveBeenCalledTimes(1);
    preview.dispose();
  });

  it('offers no links while nothing has been mapped yet', () => {
    const { term, registerLinkProvider } = fakeTerm(['[Image #1] here']);
    const preview = createImageChipPreview(term);
    const provider = registerLinkProvider.mock.calls[0][0] as unknown as {
      provideLinks: (y: number, callback: (links: unknown) => void) => void;
    };
    const callback = vi.fn();
    provider.provideLinks(1, callback);
    expect(callback).toHaveBeenCalledWith(undefined);
    preview.dispose();
  });

  it('lets go of its terminal hooks when disposed', () => {
    const { term, linkDispose } = fakeTerm();
    createImageChipPreview(term).dispose();
    expect(linkDispose).toHaveBeenCalled();
  });
});
