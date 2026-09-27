/**
 * What the workspace search box asks for. The typed text is the only state: a short prefix
 * (`f:`, `t:`, `m:`, `x:`, as in Visual Studio) picks what to search, and the tabs above the box
 * rewrite that prefix rather than keeping a mode of their own.
 */

export type SearchMode = 'all' | 'files' | 'types' | 'members' | 'text';

export const SEARCH_MODES: readonly SearchMode[] = ['all', 'files', 'types', 'members', 'text'];

export const MODE_PREFIX: Record<Exclude<SearchMode, 'all'>, string> = {
  files: 'f:',
  types: 't:',
  members: 'm:',
  text: 'x:',
};

const MODE_OF_LETTER: Record<string, SearchMode> = {
  f: 'files',
  t: 'types',
  m: 'members',
  x: 'text',
};

export interface ParsedQuery {
  mode: SearchMode;
  /** What to look for, with the prefix and any line suffix taken off. */
  text: string;
  /** A 1-based line asked for with `name:42` or `name(42)`. */
  line?: number;
  column?: number;
}

/** A prefix, unless a slash follows it: then it is a drive letter (`f:\src`). */
const PREFIX = /^([ftmx]):(?![\\/])\s*/i;
/** `name:42`, `name:42:7` or `name(42)`, the ways editors and compilers print a location. */
const LOCATION = /^(.+?)(?::(\d+)(?::(\d+))?|\((\d+)\))$/;

function readLocation(text: string): Pick<ParsedQuery, 'text' | 'line' | 'column'> {
  const match = LOCATION.exec(text);
  if (!match) return { text };
  const line = Number(match[2] ?? match[4]);
  if (!(line > 0)) return { text };
  const column = Number(match[3]);
  return column > 0 ? { text: match[1], line, column } : { text: match[1], line };
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const prefix = PREFIX.exec(raw);
  const mode = prefix ? MODE_OF_LETTER[prefix[1].toLowerCase()] : 'all';
  const rest = prefix ? raw.slice(prefix[0].length) : raw;
  // A text search looks for exactly what was typed, trailing spaces included.
  if (mode === 'text') return { mode, text: rest };
  const text = rest.trim();
  if (mode === 'all' || mode === 'files') return { mode, ...readLocation(text) };
  return { mode, text };
}

/** The same query under another mode, as the tabs switch it. */
export function withMode(raw: string, mode: SearchMode): string {
  const prefix = PREFIX.exec(raw);
  const rest = prefix ? raw.slice(prefix[0].length) : raw.trimStart();
  return mode === 'all' ? rest : `${MODE_PREFIX[mode]}${rest}`;
}

/** The mode Tab (1) or Shift+Tab (-1) moves to. */
export function nextMode(mode: SearchMode, step: 1 | -1): SearchMode {
  const at = SEARCH_MODES.indexOf(mode);
  return SEARCH_MODES[(at + step + SEARCH_MODES.length) % SEARCH_MODES.length];
}
