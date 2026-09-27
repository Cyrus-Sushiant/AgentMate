import { describe, expect, it } from 'vitest';
import { buildTextSearchArgs } from './rgArgs';

const PLAIN = { query: 'foo', matchCase: false, wholeWord: false, regex: false };

describe('buildTextSearchArgs', () => {
  it('asks for JSON, ignores the user config and keeps out what is never worth searching', () => {
    const args = buildTextSearchArgs(PLAIN);
    expect(args).toEqual(
      expect.arrayContaining([
        '--json',
        '--no-config',
        '--hidden',
        '--no-require-git',
        '--glob=!.git/',
        '--glob=!node_modules/',
        '--max-filesize=2M',
        '--max-count=100',
      ]),
    );
    expect(args).not.toContain('--follow');
  });

  it('searches for the text literally unless asked for a pattern', () => {
    expect(buildTextSearchArgs(PLAIN)).toContain('--fixed-strings');
    expect(buildTextSearchArgs({ ...PLAIN, regex: true })).not.toContain('--fixed-strings');
  });

  it('applies the case and whole word options', () => {
    expect(buildTextSearchArgs(PLAIN)).toContain('--ignore-case');
    expect(buildTextSearchArgs({ ...PLAIN, matchCase: true })).toContain('--case-sensitive');
    expect(buildTextSearchArgs({ ...PLAIN, wholeWord: true })).toContain('--word-regexp');
  });

  it('passes the query so it can never be read as a flag', () => {
    const args = buildTextSearchArgs({ ...PLAIN, query: '--files' });
    expect(args).toContain('--regexp=--files');
    expect(args).not.toContain('--files');
    // The folder to search comes last, after the end of the options.
    expect(args.slice(-2)).toEqual(['--', '.']);
  });

  it('refuses an empty or oversized query', () => {
    expect(() => buildTextSearchArgs({ ...PLAIN, query: '' })).toThrow();
    expect(() => buildTextSearchArgs({ ...PLAIN, query: 'a'.repeat(1001) })).toThrow();
  });

  it('refuses a query spanning lines', () => {
    expect(() => buildTextSearchArgs({ ...PLAIN, query: 'a\nb' })).toThrow();
  });
});
