import { describe, expect, it } from 'vitest';
import {
  applyLineEdits,
  editsInLineRanges,
  lineEditCount,
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

  it('applies only the edits that are not reverted', () => {
    const before = splitLinesKeepEnds(
      '{\r\n  "version": "1.0.0",\r\n  "a": 1,\r\n  "dep": "1.0.0"\r\n}',
    );
    const after = splitLinesKeepEnds(
      '{\r\n  "version": "2.0.0",\r\n  "a": 1,\r\n  "dep": "2.0.0"\r\n}',
    );
    const hunks = parseLineHunks('@@ -2 +2 @@\n-a\n+b\n@@ -4 +4 @@\n-c\n+d\n');
    expect(lineHunksMatch(before, after, hunks)).toBe(true);
    expect(applyLineEdits(before, after, hunks, new Set([1]))).toBe(
      '{\r\n  "version": "2.0.0",\r\n  "a": 1,\r\n  "dep": "1.0.0"\r\n}',
    );
    expect(applyLineEdits(before, after, hunks, new Set([0]))).toBe(
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
    expect(applyLineEdits(before, after, hunks, new Set([1]))).toBe('a\nnew\nb\nc\nd\ne\n');
    expect(applyLineEdits(before, after, hunks, new Set([0, 2, 3]))).toBe('a\nb\nd');
    expect(applyLineEdits(before, after, hunks, new Set([0, 2]))).toBe('a\nb\nd\ne\n');
  });

  it('rejects hunks that do not fit the files', () => {
    const before = splitLinesKeepEnds('a\nb\n');
    const after = splitLinesKeepEnds('a\nc\n');
    expect(lineHunksMatch(before, after, parseLineHunks('@@ -1 +1 @@\n'))).toBe(false);
    expect(lineHunksMatch(before, after, parseLineHunks('@@ -7 +7 @@\n'))).toBe(false);
  });

  it('picks single lines out of a hunk that changes several', () => {
    const before = splitLinesKeepEnds('a\nb\nc\nz\n');
    const after = splitLinesKeepEnds('A\nB\nz\nnew\n');
    const hunks = parseLineHunks('@@ -1,3 +1,2 @@\n@@ -4,0 +4 @@\n');
    expect(hunks.map(lineEditCount)).toEqual([3, 1]);
    expect(lineHunksMatch(before, after, hunks)).toBe(true);
    // Edits: a to A, b to B, c removed, new added.
    expect(applyLineEdits(before, after, hunks, new Set([0]))).toBe('a\nB\nz\nnew\n');
    expect(applyLineEdits(before, after, hunks, new Set([1]))).toBe('A\nb\nz\nnew\n');
    expect(applyLineEdits(before, after, hunks, new Set([2, 3]))).toBe('A\nB\nc\nz\n');
  });

  it('never runs two lines together when a kept last line had no newline', () => {
    const before = splitLinesKeepEnds('a\r\nb\r\nc');
    const after = splitLinesKeepEnds('a\r\nB\r\nc\r\nd\r\n');
    const hunks = parseLineHunks('@@ -2,2 +2,3 @@\n');
    expect(lineHunksMatch(before, after, hunks)).toBe(true);
    // Edits: b to B, c to c\r\n, d added. Reverting the middle one leaves "c" mid-file.
    expect(applyLineEdits(before, after, hunks, new Set([1]))).toBe('a\r\nB\r\nc\r\nd\r\n');
    expect(applyLineEdits(before, after, hunks, new Set([0, 1]))).toBe('a\r\nb\r\nc\r\nd\r\n');
  });

  it('previews each hunk as line edits with context that stops at the neighbouring changes', () => {
    const before = splitLinesKeepEnds('1\n2\n3\n4\n5\n6\n');
    const after = splitLinesKeepEnds('1\nB\n3\nD\nE\n5\n6\n');
    const hunks = parseLineHunks('@@ -2 +2 @@\n@@ -4 +4,2 @@\n');
    expect(lineHunkPreviews(before, after, hunks)).toEqual([
      { oldLine: 1, newLine: 1, lead: ['1'], edits: [{ removed: '2', added: 'B' }], trail: ['3'] },
      {
        oldLine: 3,
        newLine: 3,
        lead: ['3'],
        edits: [{ removed: '4', added: 'D' }, { added: 'E' }],
        trail: ['5', '6'],
      },
    ]);
  });

  it('picks only the line edits that touch the selected lines', () => {
    // Line 2 changed, line 4 changed plus a line added after it, and line 6 removed.
    const hunks = parseLineHunks('@@ -2 +2 @@\n@@ -4 +4,2 @@\n@@ -6 +6,0 @@\n');
    const none = { original: [], modified: [] };
    expect([...editsInLineRanges(hunks, none)]).toEqual([]);
    // Line 5 of the new file is the added E, the second edit of the middle hunk.
    expect([...editsInLineRanges(hunks, { ...none, modified: [[5, 5]] })]).toEqual([2]);
    expect([...editsInLineRanges(hunks, { ...none, modified: [[1, 4]] })]).toEqual([0, 1]);
    // A removed line can only be picked from the old side.
    expect([...editsInLineRanges(hunks, { ...none, original: [[6, 6]] })]).toEqual([3]);
  });
});
