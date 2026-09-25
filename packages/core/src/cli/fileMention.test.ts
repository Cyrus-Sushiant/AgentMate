import { describe, expect, it } from 'vitest';
import { formatFileMentions } from './fileMention.js';

describe('formatFileMentions', () => {
  it('mentions files and folders with @ for CLIs that attach files that way', () => {
    expect(
      formatFileMentions('claude-code', [
        { relativePath: 'src/app.ts', isDirectory: false },
        { relativePath: 'src/lib', isDirectory: true },
      ]),
    ).toBe('@src/app.ts @src/lib/ ');
  });

  it('uses forward slashes for Windows paths', () => {
    expect(
      formatFileMentions('codex-cli', [
        { relativePath: 'src\\ui\\Button.tsx', isDirectory: false },
      ]),
    ).toBe('@src/ui/Button.tsx ');
  });

  it('quotes a path with spaces so it stays one reference', () => {
    expect(
      formatFileMentions('claude-code', [{ relativePath: 'docs/My Notes.md', isDirectory: false }]),
    ).toBe('@"docs/My Notes.md" ');
  });

  it('does not double the slash of a folder path that already ends in one', () => {
    expect(formatFileMentions('gemini-cli', [{ relativePath: 'src/', isDirectory: true }])).toBe(
      '@src/ ',
    );
  });

  it('gives bare paths to CLIs with no mention syntax', () => {
    expect(
      formatFileMentions('aider', [
        { relativePath: 'app.py', isDirectory: false },
        { relativePath: 'my dir', isDirectory: true },
      ]),
    ).toBe('app.py "my dir/" ');
  });

  it('falls back to @ for an unknown CLI', () => {
    expect(formatFileMentions('nope', [{ relativePath: 'a.ts', isDirectory: false }])).toBe(
      '@a.ts ',
    );
  });

  it('returns nothing for no entries', () => {
    expect(formatFileMentions('claude-code', [])).toBe('');
  });
});
