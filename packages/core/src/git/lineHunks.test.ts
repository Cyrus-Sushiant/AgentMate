import { describe, expect, it } from 'vitest';
import {
  applyLineHunks,
  lineHunkPreviews,
  lineHunksMatch,
  parseLineHunks,
  splitLinesKeepEnds,
} from './lineHunks.js';

describe('line hunks', () => {
  it('keeps line endings when splitting', () => {
    expect(splitLinesKeepEnds('a\r\nb\nc')).toEqual(['a\r\n', 'b\n', 'c']);
    expect(splitLinesKeepEnds('')).toEqual([]);
    expect(splitLinesKeepEnds('a\n')).toEqual(['a\n']);
  });

  it('turns git line numbers into start indexes', () => {
    const hunks = parseLineHunks(
      [
        '@@ -2 +2 @@',
        '-x',
        '+y',
        '@@ -5,0 +6,2 @@',
        '+p',
        '+q',
        '@@ -9,2 +11,0 @@ fn',
        '-r',
        '-s',
      ].join('\n'),
    );
    expect(hunks.map(({ header, ...rest }) => rest)).toEqual([
      { oldStart: 1, oldCount: 1, newStart: 1, newCount: 1 },
      { oldStart: 5, oldCount: 0, newStart: 5, newCount: 2 },
      { oldStart: 8, oldCount: 2, newStart: 11, newCount: 0 },
    ]);
  });

  it('applies only the hunks that are not reverted', () => {
    const before = splitLinesKeepEnds(
      '{\r\n  "version": "1.0.0",\r\n  "a": 1,\r\n  "dep": "1.0.0"\r\n}',
    );
    const after = splitLinesKeepEnds(
      '{\r\n  "version": "2.0.0",\r\n  "a": 1,\r\n  "dep": "2.0.0"\r\n}',
    );
    const hunks = parseLineHunks('@@ -2 +2 @@\n-a\n+b\n@@ -4 +4 @@\n-c\n+d\n');
    expect(lineHunksMatch(before, after, hunks)).toBe(true);
    expect(applyLineHunks(before, after, hunks, new Set([1]))).toBe(
      '{\r\n  "version": "2.0.0",\r\n  "a": 1,\r\n  "dep": "1.0.0"\r\n}',
    );
    expect(applyLineHunks(before, after, hunks, new Set([0]))).toBe(
      '{\r\n  "version": "1.0.0",\r\n  "a": 1,\r\n  "dep": "2.0.0"\r\n}',
    );
  });

  it('handles pure additions, removals and a missing final newline', () => {
    const before = splitLinesKeepEnds('a\nb\nc\nd');
    const after = splitLinesKeepEnds('a\nnew\nb\nd\ne\n');
    const hunks = parseLineHunks(
      '@@ -1,0 +2 @@\n+new\n@@ -3 +3,0 @@\n-c\n@@ -4 +4,2 @@\n-d\n+d\n+e\n',
    );
    expect(lineHunksMatch(before, after, hunks)).toBe(true);
    expect(applyLineHunks(before, after, hunks, new Set([1]))).toBe('a\nnew\nb\nc\nd\ne\n');
    expect(applyLineHunks(before, after, hunks, new Set([0, 2]))).toBe('a\nb\nd');
  });

  it('rejects hunks that do not fit the files', () => {
    const before = splitLinesKeepEnds('a\nb\n');
    const after = splitLinesKeepEnds('a\nc\n');
    expect(lineHunksMatch(before, after, parseLineHunks('@@ -1 +1 @@\n'))).toBe(false);
    expect(lineHunksMatch(before, after, parseLineHunks('@@ -7 +7 @@\n'))).toBe(false);
  });

  it('previews each hunk with context that stops at the neighbouring changes', () => {
    const before = splitLinesKeepEnds('1\n2\n3\n4\n5\n6\n');
    const after = splitLinesKeepEnds('1\nB\n3\nD\n5\n6\n');
    const hunks = parseLineHunks('@@ -2 +2 @@\n@@ -4 +4 @@\n');
    expect(lineHunkPreviews(before, after, hunks)).toEqual([
      [' 1', '-2', '+B', ' 3'],
      [' 3', '-4', '+D', ' 5', ' 6'],
    ]);
  });
});
