import { describe, expect, it } from 'vitest';
import { nextMode, parseSearchQuery, withMode } from './query';

/**
 * The search box is the only state the modes have: a prefix picks the mode, and the tabs just
 * rewrite that prefix. So everything the dialog shows starts from this parse.
 */

describe('parseSearchQuery', () => {
  it('searches everything when there is no prefix', () => {
    expect(parseSearchQuery('userStore')).toEqual({ mode: 'all', text: 'userStore' });
  });

  it('reads each prefix, in any case, with or without a space after it', () => {
    expect(parseSearchQuery('f:store')).toMatchObject({ mode: 'files', text: 'store' });
    expect(parseSearchQuery('T: User')).toMatchObject({ mode: 'types', text: 'User' });
    expect(parseSearchQuery('m:load')).toMatchObject({ mode: 'members', text: 'load' });
    expect(parseSearchQuery('X:todo')).toMatchObject({ mode: 'text', text: 'todo' });
  });

  it('leaves an unknown prefix as part of the text', () => {
    expect(parseSearchQuery('z:foo')).toEqual({ mode: 'all', text: 'z:foo' });
  });

  it('handles a prefix with nothing after it', () => {
    expect(parseSearchQuery('f:')).toEqual({ mode: 'files', text: '' });
    expect(parseSearchQuery('   ')).toEqual({ mode: 'all', text: '' });
  });

  it('trims names but keeps the spaces a text search asked for', () => {
    expect(parseSearchQuery('f: store  ').text).toBe('store');
    expect(parseSearchQuery('x: a b ').text).toBe('a b ');
  });

  it('reads a line and column after a file name', () => {
    expect(parseSearchQuery('store.ts:42')).toEqual({ mode: 'all', text: 'store.ts', line: 42 });
    expect(parseSearchQuery('f:store.ts:42:7')).toEqual({
      mode: 'files',
      text: 'store.ts',
      line: 42,
      column: 7,
    });
    expect(parseSearchQuery('store.ts(12)')).toEqual({ mode: 'all', text: 'store.ts', line: 12 });
  });

  it('ignores a zero line', () => {
    expect(parseSearchQuery('store.ts:0')).toEqual({ mode: 'all', text: 'store.ts:0' });
  });

  it('never reads a line out of a text or symbol search', () => {
    expect(parseSearchQuery('x:a:1')).toEqual({ mode: 'text', text: 'a:1' });
    expect(parseSearchQuery('m:load:3')).toEqual({ mode: 'members', text: 'load:3' });
  });

  it('does not take a drive letter for a prefix or a line', () => {
    expect(parseSearchQuery('E:\\a.ts')).toEqual({ mode: 'all', text: 'E:\\a.ts' });
    expect(parseSearchQuery('f:\\src\\a.ts')).toEqual({ mode: 'all', text: 'f:\\src\\a.ts' });
    expect(parseSearchQuery('x:/src')).toEqual({ mode: 'all', text: 'x:/src' });
  });
});

describe('withMode', () => {
  it('adds, swaps and drops the prefix while keeping what was typed', () => {
    expect(withMode('store', 'files')).toBe('f:store');
    expect(withMode('f:store', 'types')).toBe('t:store');
    expect(withMode('T: store', 'all')).toBe('store');
    expect(withMode('', 'text')).toBe('x:');
  });

  it('keeps a line suffix', () => {
    expect(withMode('store.ts:4', 'files')).toBe('f:store.ts:4');
  });
});

describe('nextMode', () => {
  it('steps through the modes and wraps around', () => {
    expect(nextMode('all', 1)).toBe('files');
    expect(nextMode('text', 1)).toBe('all');
    expect(nextMode('all', -1)).toBe('text');
  });
});
