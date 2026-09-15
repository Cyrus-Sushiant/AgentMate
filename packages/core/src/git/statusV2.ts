/**
 * Parsers for the machine-readable git output the workspace git panel is built on:
 * `status --porcelain=v2 -z --branch` and `diff --numstat -z`. Both use NUL separators, so
 * paths with spaces, quotes or non-ASCII characters come through untouched.
 */

/** Single-letter change kinds, as git prints them. `U` is a conflict, `?` untracked. */
export type GitChangeStatus = 'M' | 'A' | 'D' | 'R' | 'C' | 'T' | 'U' | '?';

export interface GitChangeEntry {
  /** Repo-relative path with forward slashes. For a rename, the new path. */
  path: string;
  /** For a rename or copy, the path it came from. */
  origPath?: string;
  status: GitChangeStatus;
  /** For conflicts, git's two-letter code (`UU`, `AA`, `DU`...). */
  conflict?: string;
  additions?: number;
  deletions?: number;
  binary?: boolean;
}

export interface ParsedStatusV2 {
  /** Null on an unborn branch (no commits yet). */
  oid: string | null;
  /** Null when HEAD is detached. */
  branch: string | null;
  detached: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitChangeEntry[];
  unstaged: GitChangeEntry[];
  untracked: GitChangeEntry[];
  conflicts: GitChangeEntry[];
}

const CHANGE_LETTERS = new Set(['M', 'A', 'D', 'R', 'C', 'T', 'U']);

function toStatus(letter: string): GitChangeStatus {
  return (CHANGE_LETTERS.has(letter) ? letter : 'M') as GitChangeStatus;
}

/** Splits off the first `count` space-separated fields; the rest (the path) may contain spaces. */
function splitFields(record: string, count: number): { fields: string[]; rest: string } | null {
  const fields: string[] = [];
  let from = 0;
  for (let i = 0; i < count; i += 1) {
    const space = record.indexOf(' ', from);
    if (space === -1) return null;
    fields.push(record.slice(from, space));
    from = space + 1;
  }
  return { fields, rest: record.slice(from) };
}

export function parseStatusV2(output: string): ParsedStatusV2 {
  const result: ParsedStatusV2 = {
    oid: null,
    branch: null,
    detached: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicts: [],
  };
  const records = output.split('\0');
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (!record) continue;
    const kind = record[0];

    if (kind === '#') {
      const header = record.slice(2);
      if (header.startsWith('branch.oid ')) {
        const oid = header.slice('branch.oid '.length);
        result.oid = oid === '(initial)' ? null : oid;
      } else if (header.startsWith('branch.head ')) {
        const head = header.slice('branch.head '.length);
        result.detached = head === '(detached)';
        result.branch = result.detached ? null : head;
      } else if (header.startsWith('branch.upstream ')) {
        result.upstream = header.slice('branch.upstream '.length);
      } else if (header.startsWith('branch.ab ')) {
        const match = /^\+(\d+) -(\d+)$/.exec(header.slice('branch.ab '.length));
        if (match) {
          result.ahead = Number(match[1]);
          result.behind = Number(match[2]);
        }
      }
      continue;
    }

    if (kind === '?') {
      result.untracked.push({ path: record.slice(2), status: '?' });
      continue;
    }

    if (kind === '1' || kind === '2') {
      // `1 XY sub mH mI mW hH hI path`, and a rename adds a score field before the path
      // with its original path in the next NUL-separated record.
      const parsed = splitFields(record, kind === '1' ? 8 : 9);
      if (!parsed) continue;
      const xy = parsed.fields[1] ?? '..';
      const path = parsed.rest;
      const origPath = kind === '2' ? records[i + 1] : undefined;
      if (kind === '2') i += 1;
      const x = xy[0] ?? '.';
      const y = xy[1] ?? '.';
      if (x !== '.') {
        result.staged.push({ path, status: toStatus(x), ...(origPath ? { origPath } : {}) });
      }
      if (y !== '.') {
        // The working-tree side of a staged rename is a change to the new path.
        result.unstaged.push({ path, status: toStatus(y) });
      }
      continue;
    }

    if (kind === 'u') {
      const parsed = splitFields(record, 10);
      if (!parsed) continue;
      result.conflicts.push({ path: parsed.rest, status: 'U', conflict: parsed.fields[1] });
    }
    // `!` (ignored) is never requested, and anything else is from a newer git; skip both.
  }
  return result;
}

export interface NumstatEntry {
  additions: number;
  deletions: number;
  binary: boolean;
}

/**
 * Parses `diff --numstat -z`. A normal line is `added\tdeleted\tpath\0`; a rename leaves the
 * path empty and follows with `old\0new\0`. Binary files show `-` for both counts.
 */
export function parseNumstatZ(output: string): Map<string, NumstatEntry> {
  const stats = new Map<string, NumstatEntry>();
  const records = output.split('\0');
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (!record) continue;
    const firstTab = record.indexOf('\t');
    const secondTab = record.indexOf('\t', firstTab + 1);
    if (firstTab === -1 || secondTab === -1) continue;
    const added = record.slice(0, firstTab);
    const deleted = record.slice(firstTab + 1, secondTab);
    let path = record.slice(secondTab + 1);
    if (path === '') {
      path = records[i + 2] ?? '';
      i += 2;
    }
    if (!path) continue;
    const binary = added === '-' || deleted === '-';
    stats.set(path, {
      additions: binary ? 0 : Number(added) || 0,
      deletions: binary ? 0 : Number(deleted) || 0,
      binary,
    });
  }
  return stats;
}

/** Copies line counts onto entries by path. Entries without a count are left as they were. */
export function withNumstat(
  entries: GitChangeEntry[],
  stats: Map<string, NumstatEntry>,
): GitChangeEntry[] {
  return entries.map((entry) => {
    const stat = stats.get(entry.path);
    return stat ? { ...entry, ...stat } : entry;
  });
}
