import type { TextSearchFileMatches } from '@shared/apiTypes';
import { describe, expect, it } from 'vitest';
import type { FileHit } from '@/components/workspace/git/explorer/fileSearch';
import { buildRows, firstSelectable, nextSelectable, type Row, type RowsInput } from './rows';
import type { SymbolHit } from './symbols';

function file(path: string, index = 0): FileHit {
  return { index, path, nameStart: path.lastIndexOf('/') + 1, ranges: [], score: 1 };
}

function symbol(name: string, kind: SymbolHit['kind'] = 'class'): SymbolHit {
  return {
    id: 0,
    name,
    container: '',
    kind,
    path: 'a.ts',
    line: 1,
    column: 1,
    label: name,
    ranges: [],
  };
}

function textFile(path: string, lines: number[]): TextSearchFileMatches {
  return {
    path,
    matches: lines.map((line) => ({ line, column: 1, text: 'x', textOffset: 0, ranges: [] })),
  };
}

function input(patch: Partial<RowsInput>): RowsInput {
  return {
    mode: 'all',
    query: 'x',
    files: { hits: [], total: 0 },
    types: { hits: [], total: 0 },
    members: { hits: [], total: 0 },
    text: { files: [], matches: 0 },
    recent: [],
    ...patch,
  };
}

function shape(rows: Row[]): string[] {
  return rows.map((row) => {
    switch (row.kind) {
      case 'section':
        return `# ${row.label} ${row.count}`;
      case 'file':
        return `file ${row.hit.path}`;
      case 'recent':
        return `recent ${row.path}`;
      case 'symbol':
        return `symbol ${row.hit.name}`;
      case 'textFile':
        return `in ${row.path} ${row.count}`;
      case 'textLine':
        return `line ${row.path}:${row.match.line}`;
      case 'more':
        return `more ${row.mode}`;
      case 'hint':
        return `hint ${row.text}`;
    }
  });
}

describe('buildRows', () => {
  it('shows recent files before anything is typed', () => {
    const rows = buildRows(input({ query: '', recent: ['src/a.ts', 'b.ts'] }));
    expect(shape(rows)).toEqual(['# Recent files 2', 'recent src/a.ts', 'recent b.ts']);
  });

  it('says what to type when there is nothing recent', () => {
    expect(shape(buildRows(input({ query: '' })))).toEqual([
      'hint Type to search files, types, members and text.',
    ]);
    expect(shape(buildRows(input({ query: '', mode: 'types' })))).toEqual([
      'hint Type the name of a class, interface, enum or type.',
    ]);
  });

  it('shows the best of each kind together, with a way to see the rest', () => {
    const files = Array.from({ length: 9 }, (_, at) => file(`f${at}.ts`, at));
    const rows = buildRows(
      input({
        files: { hits: files, total: 9 },
        types: { hits: [symbol('User')], total: 1 },
        members: { hits: [symbol('load', 'method')], total: 1 },
        text: { files: [textFile('a.ts', [1, 2]), textFile('b.ts', [5])], matches: 3 },
      }),
    );
    expect(shape(rows)).toEqual([
      '# Files 9',
      'file f0.ts',
      'file f1.ts',
      'file f2.ts',
      'file f3.ts',
      'file f4.ts',
      'file f5.ts',
      'more files',
      '# Types 1',
      'symbol User',
      '# Members 1',
      'symbol load',
      '# Text 3',
      'in a.ts 2',
      'line a.ts:1',
      'line a.ts:2',
      'in b.ts 1',
      'line b.ts:5',
    ]);
  });

  it('leaves out a kind with nothing to show', () => {
    const rows = buildRows(input({ files: { hits: [file('a.ts')], total: 1 } }));
    expect(shape(rows)).toEqual(['# Files 1', 'file a.ts']);
  });

  it('lists one kind in full under its own tab', () => {
    const files = Array.from({ length: 9 }, (_, at) => file(`f${at}.ts`, at));
    const rows = buildRows(input({ mode: 'files', files: { hits: files, total: 9 } }));
    expect(rows.filter((row) => row.kind === 'file')).toHaveLength(9);
    expect(rows.some((row) => row.kind === 'section' || row.kind === 'more')).toBe(false);
  });

  it('groups text matches under their file', () => {
    const rows = buildRows(
      input({ mode: 'text', text: { files: [textFile('a.ts', [1, 4])], matches: 2 } }),
    );
    expect(shape(rows)).toEqual(['in a.ts 2', 'line a.ts:1', 'line a.ts:4']);
  });

  it('says when nothing matched', () => {
    expect(shape(buildRows(input({ mode: 'files', query: 'zzz' })))).toEqual([
      'hint No files match “zzz”.',
    ]);
  });
});

describe('selection', () => {
  const rows = buildRows(
    input({
      files: { hits: [file('a.ts'), file('b.ts')], total: 2 },
      types: { hits: [symbol('User')], total: 1 },
    }),
  );

  it('starts on the first row that can be opened', () => {
    expect(shape([rows[firstSelectable(rows)]])).toEqual(['file a.ts']);
  });

  it('steps over section headers and wraps at both ends', () => {
    const at = firstSelectable(rows);
    const second = nextSelectable(rows, at, 1);
    const third = nextSelectable(rows, second, 1);
    expect(shape([rows[second], rows[third]])).toEqual(['file b.ts', 'symbol User']);
    expect(nextSelectable(rows, third, 1)).toBe(at);
    expect(nextSelectable(rows, at, -1)).toBe(third);
  });

  it('finds nothing to select in a list of hints', () => {
    const empty = buildRows(input({ query: '' }));
    expect(firstSelectable(empty)).toBe(-1);
    expect(nextSelectable(empty, -1, 1)).toBe(-1);
  });
});
