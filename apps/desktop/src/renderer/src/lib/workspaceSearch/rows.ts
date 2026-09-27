import type { TextSearchFileMatches, TextSearchLine } from '@shared/apiTypes';
import type { FileHit } from '@/components/workspace/git/explorer/fileSearch';
import type { SearchMode } from './query';
import type { SymbolHit } from './symbols';

/**
 * The search dialog's list as flat rows, so it can be drawn a screenful at a time and walked
 * with the arrow keys. Section headers and hints sit in the list but are never selected.
 */

export type Row =
  | { kind: 'section'; key: string; label: string; count: number }
  | { kind: 'file'; key: string; hit: FileHit }
  | { kind: 'recent'; key: string; path: string }
  | { kind: 'symbol'; key: string; hit: SymbolHit }
  | { kind: 'textFile'; key: string; path: string; count: number }
  | { kind: 'textLine'; key: string; path: string; match: TextSearchLine }
  | { kind: 'more'; key: string; mode: SearchMode; label: string }
  | { kind: 'hint'; key: string; text: string };

export interface RowsInput {
  mode: SearchMode;
  /** What was typed, without the prefix. */
  query: string;
  files: { hits: FileHit[]; total: number };
  types: { hits: SymbolHit[]; total: number };
  members: { hits: SymbolHit[]; total: number };
  text: { files: TextSearchFileMatches[]; matches: number };
  /** Project-relative paths, newest first. */
  recent: string[];
  /** A text search is still running, so "nothing found" would be premature. */
  pending?: boolean;
}

/** How many of each kind the All tab shows before "See all". */
const ALL_LIMITS = { files: 6, types: 5, members: 5, text: 20 } as const;

const EMPTY_HINTS: Record<SearchMode, string> = {
  all: 'Type to search files, types, members and text.',
  files: 'Type part of a file name or path.',
  types: 'Type the name of a class, interface, enum or type.',
  members: 'Type the name of a function, method or property.',
  text: 'Type the text to find in the project’s files.',
};

const NO_MATCH: Record<SearchMode, string> = {
  all: 'Nothing matches',
  files: 'No files match',
  types: 'No types match',
  members: 'No members match',
  text: 'No text matches',
};

const SELECTABLE: ReadonlySet<Row['kind']> = new Set([
  'file',
  'recent',
  'symbol',
  'textLine',
  'more',
]);

function fileRows(hits: readonly FileHit[]): Row[] {
  return hits.map((hit) => ({ kind: 'file', key: `file:${hit.path}`, hit }));
}

function symbolRows(hits: readonly SymbolHit[]): Row[] {
  return hits.map((hit) => ({ kind: 'symbol', key: `symbol:${hit.id}`, hit }));
}

/** Text matches under a header per file, stopping after `limit` lines. */
function textRows(
  files: readonly TextSearchFileMatches[],
  limit = Number.POSITIVE_INFINITY,
): Row[] {
  const rows: Row[] = [];
  let lines = 0;
  for (const file of files) {
    if (lines >= limit) break;
    rows.push({
      kind: 'textFile',
      key: `textFile:${file.path}`,
      path: file.path,
      count: file.matches.length,
    });
    for (const match of file.matches) {
      if (lines >= limit) break;
      rows.push({
        kind: 'textLine',
        key: `textLine:${file.path}:${match.line}:${match.column}`,
        path: file.path,
        match,
      });
      lines += 1;
    }
  }
  return rows;
}

function section(
  label: string,
  count: number,
  body: Row[],
  more: SearchMode | null,
  shown: number,
): Row[] {
  if (body.length === 0) return [];
  const rows: Row[] = [{ kind: 'section', key: `section:${label}`, label, count }, ...body];
  if (more && count > shown) {
    rows.push({ kind: 'more', key: `more:${more}`, mode: more, label: `See all ${count}` });
  }
  return rows;
}

export function buildRows(input: RowsInput): Row[] {
  const { mode, query } = input;

  if (!query) {
    if ((mode === 'all' || mode === 'files') && input.recent.length > 0) {
      return [
        {
          kind: 'section',
          key: 'section:recent',
          label: 'Recent files',
          count: input.recent.length,
        },
        ...input.recent.map((path): Row => ({ kind: 'recent', key: `recent:${path}`, path })),
      ];
    }
    return [{ kind: 'hint', key: 'hint', text: EMPTY_HINTS[mode] }];
  }

  let rows: Row[];
  switch (mode) {
    case 'files':
      rows = fileRows(input.files.hits);
      break;
    case 'types':
      rows = symbolRows(input.types.hits);
      break;
    case 'members':
      rows = symbolRows(input.members.hits);
      break;
    case 'text':
      rows = textRows(input.text.files);
      break;
    case 'all': {
      const files = input.files.hits.slice(0, ALL_LIMITS.files);
      const types = input.types.hits.slice(0, ALL_LIMITS.types);
      const members = input.members.hits.slice(0, ALL_LIMITS.members);
      const text = textRows(input.text.files, ALL_LIMITS.text);
      const textShown = text.filter((row) => row.kind === 'textLine').length;
      rows = [
        ...section('Files', input.files.total, fileRows(files), 'files', files.length),
        ...section('Types', input.types.total, symbolRows(types), 'types', types.length),
        ...section('Members', input.members.total, symbolRows(members), 'members', members.length),
        ...section('Text', input.text.matches, text, 'text', textShown),
      ];
      break;
    }
  }

  if (rows.length === 0 && !input.pending) {
    return [{ kind: 'hint', key: 'hint', text: `${NO_MATCH[mode]} “${query.trim()}”.` }];
  }
  return rows;
}

export function isSelectable(row: Row | undefined): boolean {
  return row !== undefined && SELECTABLE.has(row.kind);
}

export function firstSelectable(rows: readonly Row[]): number {
  return rows.findIndex(isSelectable);
}

/** The next row the arrow keys land on, wrapping around. -1 when there is none. */
export function nextSelectable(rows: readonly Row[], from: number, step: 1 | -1): number {
  const count = rows.length;
  if (count === 0) return -1;
  let at = from;
  for (let tried = 0; tried < count; tried += 1) {
    at = (((at + step) % count) + count) % count;
    if (isSelectable(rows[at])) return at;
  }
  return -1;
}
