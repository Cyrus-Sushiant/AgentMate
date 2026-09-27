import { describe, expect, it } from 'vitest';
import { byteToChar, createLineSplitter, parseRgMatch, toSearchLine } from './rgJson';

/**
 * Turning ripgrep's JSON output into what the search list shows. ripgrep counts in UTF-8
 * bytes and the editor counts in UTF-16 characters, which is where most of the care goes.
 */

function matchLine(path: string, text: string, line: number, spans: [number, number][]): string {
  return JSON.stringify({
    type: 'match',
    data: {
      path: { text: path },
      lines: { text },
      line_number: line,
      absolute_offset: 0,
      submatches: spans.map(([start, end]) => ({ match: { text: 'x' }, start, end })),
    },
  });
}

describe('createLineSplitter', () => {
  it('gives whole lines however the output is chunked', () => {
    const lines: string[] = [];
    const splitter = createLineSplitter((line) => lines.push(line));
    splitter.push(Buffer.from('{"a":1}\n{"b"'));
    splitter.push(Buffer.from(':2}\r\n{"c":3}'));
    splitter.end();
    expect(lines).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it('does not break a character split across two chunks', () => {
    const lines: string[] = [];
    const splitter = createLineSplitter((line) => lines.push(line));
    const bytes = Buffer.from('سلام\n');
    splitter.push(bytes.subarray(0, 3));
    splitter.push(bytes.subarray(3));
    splitter.end();
    expect(lines).toEqual(['سلام']);
  });
});

describe('parseRgMatch', () => {
  it('reads a match', () => {
    expect(parseRgMatch(matchLine('./src/a.ts', '  const foo = 1;\n', 3, [[8, 11]]))).toEqual({
      path: 'src/a.ts',
      line: 3,
      text: '  const foo = 1;\n',
      spans: [[8, 11]],
    });
  });

  it('skips everything that is not a match', () => {
    expect(parseRgMatch(JSON.stringify({ type: 'begin', data: {} }))).toBeNull();
    expect(parseRgMatch(JSON.stringify({ type: 'summary', data: {} }))).toBeNull();
    expect(parseRgMatch('not json')).toBeNull();
  });

  it('skips lines ripgrep could only send as raw bytes', () => {
    const raw = JSON.stringify({
      type: 'match',
      data: {
        path: { text: 'a.bin' },
        lines: { bytes: 'AAEC' },
        line_number: 1,
        submatches: [],
      },
    });
    expect(parseRgMatch(raw)).toBeNull();
  });
});

describe('byteToChar', () => {
  it('counts plain text one to one', () => {
    expect(byteToChar('hello', 3)).toBe(3);
  });

  it('counts wide letters and emoji the way the editor does', () => {
    // Each Persian letter is two bytes and one character; the emoji is four bytes and two.
    expect(byteToChar('سلام x', 9)).toBe(5);
    expect(byteToChar('😀x', 4)).toBe(2);
    expect(byteToChar('中文x', 6)).toBe(2);
  });
});

describe('toSearchLine', () => {
  it('drops the line break and the indent, and moves the marks with it', () => {
    expect(toSearchLine('    const foo = 1;\r\n', 7, [[10, 13]])).toEqual({
      line: 7,
      column: 11,
      text: 'const foo = 1;',
      textOffset: 4,
      clipped: false,
      ranges: [[6, 9]],
    });
  });

  it('marks the right letters in non-Latin text', () => {
    const result = toSearchLine('سلام دنیا\n', 1, [[9, 17]]);
    expect(result.text.slice(...result.ranges[0])).toBe('دنیا');
    expect(result.column).toBe(6);
  });

  it('cuts a long line down to a window around the first match', () => {
    const long = `${'a'.repeat(5000)}needle${'b'.repeat(5000)}`;
    const result = toSearchLine(long, 1, [[5000, 5006]]);
    expect(result.text.length).toBeLessThanOrEqual(240);
    expect(result.textOffset).toBeGreaterThan(0);
    expect(result.clipped).toBe(true);
    expect(result.text.slice(...result.ranges[0])).toBe('needle');
    expect(result.column).toBe(5001);
  });

  it('leaves out marks that fall outside the window', () => {
    const long = `needle${'a'.repeat(5000)}needle`;
    const result = toSearchLine(long, 1, [
      [0, 6],
      [5006, 5012],
    ]);
    expect(result.ranges).toEqual([[0, 6]]);
  });
});
