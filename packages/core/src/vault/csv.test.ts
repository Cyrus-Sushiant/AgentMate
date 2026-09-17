import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, serializeCsv } from './csv.js';

describe('parseCsv', () => {
  it('reads a simple table', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted delimiters, escaped quotes and line breaks inside quotes', () => {
    const text = 'name,notes\n"Acme, Inc.","He said ""hi""\nsecond line"\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'notes'],
      ['Acme, Inc.', 'He said "hi"\nsecond line'],
    ]);
  });

  it('strips a UTF-8 byte order mark', () => {
    expect(parseCsv('﻿name,url\nx,y')).toEqual([
      ['name', 'url'],
      ['x', 'y'],
    ]);
  });

  it('accepts CRLF, LF and bare CR line endings', () => {
    const expected = [
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ];
    expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual(expected);
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual(expected);
    expect(parseCsv('a,b\r1,2\r3,4')).toEqual(expected);
  });

  it('keeps CRLF inside a quoted cell as written', () => {
    expect(parseCsv('"x\r\ny",z')).toEqual([['x\r\ny', 'z']]);
  });

  it('keeps empty cells and ragged rows', () => {
    expect(parseCsv('a,b,c\n1,,\n2\n,')).toEqual([['a', 'b', 'c'], ['1', '', ''], ['2'], ['', '']]);
  });

  it('skips completely blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('﻿')).toEqual([]);
  });

  it('supports other delimiters', () => {
    expect(parseCsv('a;b\n"1;2";3', { delimiter: ';' })).toEqual([
      ['a', 'b'],
      ['1;2', '3'],
    ]);
    expect(parseCsv('a\tb\n1\t2', { delimiter: '\t' })).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps text after a closing quote instead of dropping it', () => {
    expect(parseCsv('"ab"cd,e')).toEqual([['abcd', 'e']]);
  });

  it('closes an unterminated quote at the end of the input', () => {
    expect(parseCsv('"abc,def')).toEqual([['abc,def']]);
  });
});

describe('detectDelimiter', () => {
  it('picks the delimiter that splits the header most consistently', () => {
    expect(detectDelimiter('name,url,username,password\nx,y,z,w')).toBe(',');
    expect(detectDelimiter('name;url;username\nx;y;z')).toBe(';');
    expect(detectDelimiter('name\turl\tusername\nx\ty\tz')).toBe('\t');
  });

  it('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a;b;c;d",e\n"x;y",z')).toBe(',');
  });

  it('falls back to a comma', () => {
    expect(detectDelimiter('single')).toBe(',');
    expect(detectDelimiter('')).toBe(',');
  });
});

describe('serializeCsv', () => {
  it('quotes only when needed', () => {
    expect(serializeCsv([['a', 'b,c', 'd"e', 'f\ng', ' pad ']])).toBe(
      'a,"b,c","d""e","f\ng"," pad "\r\n',
    );
  });

  it('writes CRLF line endings and no trailing blank row', () => {
    expect(
      serializeCsv([
        ['h1', 'h2'],
        ['1', '2'],
      ]),
    ).toBe('h1,h2\r\n1,2\r\n');
    expect(serializeCsv([])).toBe('');
  });

  it('round-trips hostile strings', () => {
    const nasty = [
      '',
      ' ',
      ',',
      '"',
      '""',
      '\n',
      '\r\n',
      '\r',
      'a,b"c\nd',
      '=SUM(A1:A2)',
      '﻿bom-looking',
      'تست فارسی',
      'emoji 🔐',
      '\t tab',
    ];
    const rows = [nasty, [...nasty].reverse()];
    const parsed = parseCsv(serializeCsv(rows));
    expect(parsed).toEqual(rows);
  });
});
