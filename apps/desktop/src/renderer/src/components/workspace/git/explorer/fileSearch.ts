/**
 * Ranking for the explorer's file search. The whole file list comes over once and every
 * keystroke is matched here, so this stays to plain string scans: `indexOf` for the common
 * case, and a subsequence walk only for the paths that have no straight match.
 */

export interface FileHit {
  /** Path relative to the project root, with forward slashes. */
  path: string;
  /** Where the file name starts inside `path`. */
  nameStart: number;
  /** [start, end) ranges in `path` that matched, for highlighting. */
  ranges: [number, number][];
  score: number;
}

export interface FileSearchResult {
  hits: FileHit[];
  /** How many files matched, which can be more than `hits` holds. */
  total: number;
}

export const DEFAULT_SEARCH_LIMIT = 200;

/**
 * Score floors, best first. Each match adds up to 99 on top, so a weaker kind of match can
 * never outrank a better one.
 */
const NAME_EXACT = 900;
const NAME_START = 800;
const NAME_PART = 700;
const PATH_PART = 600;
const NAME_FUZZY = 500;
const PATH_FUZZY = 400;

const WORD_BREAK = /[\\/\-_. ]/;

interface Match {
  score: number;
  ranges: [number, number][];
}

/** True at the start, after a separator, and at a camelCase hump. */
function isWordStart(text: string, at: number): boolean {
  if (at === 0) return true;
  const previous = text[at - 1];
  if (WORD_BREAK.test(previous)) return true;
  return previous === previous.toLowerCase() && text[at] !== text[at].toLowerCase();
}

/** An early, word-aligned run scores highest. Always between 0 and 99. */
function runBonus(original: string, at: number): number {
  return Math.max(0, 60 - at) + (isWordStart(original, at) ? 39 : 0);
}

/** The query's characters found in order, or null. Neighbouring hits merge into one range. */
function subsequence(
  lower: string,
  original: string,
  query: string,
  from: number,
): { ranges: [number, number][]; starts: number; spread: number } | null {
  const ranges: [number, number][] = [];
  let starts = 0;
  let cursor = from;
  let first = -1;
  for (const char of query) {
    const at = lower.indexOf(char, cursor);
    if (at === -1) return null;
    if (first === -1) first = at;
    if (isWordStart(original, at)) starts += 1;
    const last = ranges.at(-1);
    if (last && last[1] === at) last[1] = at + 1;
    else ranges.push([at, at + 1]);
    cursor = at + 1;
  }
  return { ranges, starts, spread: cursor - first };
}

function fuzzyMatch(
  lower: string,
  original: string,
  query: string,
  from: number,
  floor: number,
): Match | null {
  const found = subsequence(lower, original, query, from);
  if (!found) return null;
  const compact = Math.round((query.length / found.spread) * 60);
  return { score: floor + compact + Math.min(found.starts * 8, 39), ranges: found.ranges };
}

/** How one path scores against the query, or null when it does not match at all. */
function matchPath(path: string, lower: string, query: string, byPath: boolean): Match | null {
  const nameStart = lower.lastIndexOf('/') + 1;
  if (!byPath) {
    if (lower.length - nameStart === query.length && lower.endsWith(query)) {
      return { score: NAME_EXACT + 99, ranges: [[nameStart, lower.length]] };
    }
    const at = lower.indexOf(query, nameStart);
    if (at !== -1) {
      const floor = at === nameStart ? NAME_START : NAME_PART;
      return { score: floor + runBonus(path, at), ranges: [[at, at + query.length]] };
    }
  }
  const at = lower.indexOf(query);
  if (at !== -1) {
    return { score: PATH_PART + runBonus(path, at), ranges: [[at, at + query.length]] };
  }
  return (
    (byPath ? null : fuzzyMatch(lower, path, query, nameStart, NAME_FUZZY)) ??
    fuzzyMatch(lower, path, query, 0, PATH_FUZZY)
  );
}

/**
 * Lowercased copies of the paths, kept beside the index so a keystroke does not have to
 * lowercase the whole project again. A path whose lowercase form is a different length (a
 * handful of letters do that) keeps its original, and matches case-sensitively.
 */
export function loweredPaths(files: readonly string[]): string[] {
  return files.map((path) => {
    const lower = path.toLowerCase();
    return lower.length === path.length ? lower : path;
  });
}

/**
 * A path from the index, as a path on disk. The root comes from the main process, so its
 * separator is the one this system uses.
 */
export function toAbsolutePath(root: string, relative: string): string {
  const separator = root.includes('\\') ? '\\' : '/';
  const trimmed = root.replace(/[\\/]+$/, '');
  return `${trimmed}${separator}${separator === '/' ? relative : relative.replaceAll('/', separator)}`;
}

/** Whitespace is not useful inside a path, so "user store" reads as "userstore". */
export function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, '').toLowerCase();
}

export function searchFiles(
  files: readonly string[],
  query: string,
  options: { limit?: number; lowered?: readonly string[] } = {},
): FileSearchResult {
  const needle = normalizeQuery(query);
  if (!needle) return { hits: [], total: 0 };
  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  const lowered = options.lowered ?? loweredPaths(files);
  const byPath = needle.includes('/');

  const hits: FileHit[] = [];
  for (const [index, path] of files.entries()) {
    const match = matchPath(path, lowered[index] ?? path, needle, byPath);
    if (!match) continue;
    hits.push({
      path,
      nameStart: path.lastIndexOf('/') + 1,
      ranges: match.ranges,
      score: match.score,
    });
  }
  const total = hits.length;
  // Same score: the shorter, then alphabetical path, so the order never wanders between runs.
  hits.sort(
    (a, b) => b.score - a.score || a.path.length - b.path.length || (a.path < b.path ? -1 : 1),
  );
  return { hits: hits.length > limit ? hits.slice(0, limit) : hits, total };
}
