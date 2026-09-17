/**
 * Line hunks from a zero-context diff (`git diff -U0`), and the two things done with them:
 * showing each changed line on its own, and rebuilding a file with only some of them applied.
 *
 * Line arrays keep their line endings (see splitLinesKeepEnds), so a file rebuilt from them
 * comes back byte for byte, CRLF and a missing final newline included.
 */

export interface LineHunk {
  /** The `@@ -a,b +c,d @@` line as git printed it. */
  header: string;
  /** Index of the hunk's first old line, or where the new lines go when it removes nothing. */
  oldStart: number;
  oldCount: number;
  /** Index of the hunk's first new line, or where it would sit when it adds nothing. */
  newStart: number;
  newCount: number;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Splits text into lines that each keep their own `\n` (and `\r` before it). */
export function splitLinesKeepEnds(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', start)) {
    lines.push(text.slice(start, index + 1));
    start = index + 1;
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

/**
 * Reads the hunk headers of a zero-context diff. Git numbers lines from 1, and a hunk that
 * only adds (or only removes) names the line before the gap, so both are turned into the
 * index the lines actually start at.
 */
export function parseLineHunks(diff: string): LineHunk[] {
  const hunks: LineHunk[] = [];
  for (const line of diff.split('\n')) {
    const match = HUNK_HEADER.exec(line);
    if (!match) continue;
    const oldLine = Number(match[1]);
    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newLine = Number(match[3]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);
    hunks.push({
      header: match[0],
      oldStart: oldCount === 0 ? oldLine : oldLine - 1,
      oldCount,
      newStart: newCount === 0 ? newLine : newLine - 1,
      newCount,
    });
  }
  return hunks;
}

/**
 * How many line edits a hunk holds. The first old line pairs with the first new line, the
 * second with the second, and so on, so a changed line is one edit rather than a removal and an
 * addition. Whatever is left over once one side runs out is a plain removal or addition.
 */
export function lineEditCount(hunk: LineHunk): number {
  return Math.max(hunk.oldCount, hunk.newCount);
}

/**
 * The before file with every line edit applied except the ones in `revert`. Edits are numbered
 * across the whole file in order, hunk by hunk (see lineEditCount). Hunks from a zero-context
 * diff never share a line, and within a hunk each edit covers its own old and new line, so any
 * mix of edits can be taken or left.
 */
export function applyLineEdits(
  before: readonly string[],
  after: readonly string[],
  hunks: readonly LineHunk[],
  revert: ReadonlySet<number>,
): string {
  const out: string[] = [];
  let cursor = 0;
  let edit = 0;
  for (const hunk of hunks) {
    out.push(...before.slice(cursor, hunk.oldStart));
    for (let offset = 0; offset < lineEditCount(hunk); offset += 1, edit += 1) {
      const reverted = revert.has(edit);
      if (reverted && offset < hunk.oldCount) out.push(before[hunk.oldStart + offset]);
      if (!reverted && offset < hunk.newCount) out.push(after[hunk.newStart + offset]);
    }
    cursor = hunk.oldStart + hunk.oldCount;
  }
  out.push(...before.slice(cursor));
  // Only a file's last line can lack a line ending. Once a partial pick moves such a line up,
  // it takes the ending of the line after it rather than running into it.
  return out
    .map((line, index) =>
      index === out.length - 1 || line.endsWith('\n')
        ? line
        : line + (/\r?\n$/.exec(out[index + 1])?.[0] ?? '\n'),
    )
    .join('');
}

/** Line ranges picked in an editor, 1-based and inclusive, on the old and the new side. */
export interface LineRanges {
  original: readonly (readonly [number, number])[];
  modified: readonly (readonly [number, number])[];
}

/**
 * The line edits (numbered the way applyLineEdits counts them) that touch the picked lines. An
 * edit counts when its old line sits in an original range or its new line in a modified one.
 */
export function editsInLineRanges(hunks: readonly LineHunk[], ranges: LineRanges): Set<number> {
  const inside = (line: number, list: LineRanges['original']): boolean =>
    list.some(([from, to]) => line >= from && line <= to);
  const picked = new Set<number>();
  let edit = 0;
  for (const hunk of hunks) {
    for (let offset = 0; offset < lineEditCount(hunk); offset += 1, edit += 1) {
      const oldHit = offset < hunk.oldCount && inside(hunk.oldStart + offset + 1, ranges.original);
      const newHit = offset < hunk.newCount && inside(hunk.newStart + offset + 1, ranges.modified);
      if (oldHit || newHit) picked.add(edit);
    }
  }
  return picked;
}

/**
 * True when the hunks really describe before and after: in order, inside both files, and
 * rebuilding with all or none of them gives back each side exactly. Anything that fails
 * this is not safe to pick apart.
 */
export function lineHunksMatch(
  before: readonly string[],
  after: readonly string[],
  hunks: readonly LineHunk[],
): boolean {
  let oldEnd = 0;
  let newEnd = 0;
  for (const hunk of hunks) {
    if (hunk.oldStart < oldEnd || hunk.newStart < newEnd) return false;
    oldEnd = hunk.oldStart + hunk.oldCount;
    newEnd = hunk.newStart + hunk.newCount;
    if (oldEnd > before.length || newEnd > after.length) return false;
  }
  const total = hunks.reduce((sum, hunk) => sum + lineEditCount(hunk), 0);
  const all = new Set(Array.from({ length: total }, (_, index) => index));
  return (
    applyLineEdits(before, after, hunks, new Set()) === after.join('') &&
    applyLineEdits(before, after, hunks, all) === before.join('')
  );
}

function stripEnding(line: string): string {
  return line.replace(/\r?\n$/, '');
}

/** One line edit as shown: the old line, the new line, or both for a changed line. */
export interface LineEditPreview {
  removed?: string;
  added?: string;
}

export interface LineHunkPreview {
  /** 1-based line numbers of the first lead line in the old and the new file. */
  oldLine: number;
  newLine: number;
  /** Unchanged lines just before the hunk. */
  lead: string[];
  edits: LineEditPreview[];
  /** Unchanged lines just after it. */
  trail: string[];
}

/**
 * Each hunk split into its line edits, with up to `context` unchanged lines on either side and
 * line endings removed. Context stops short of a neighbouring hunk's changed lines, so it only
 * ever shows lines that are the same in both files.
 */
export function lineHunkPreviews(
  before: readonly string[],
  after: readonly string[],
  hunks: readonly LineHunk[],
  context = 2,
): LineHunkPreview[] {
  return hunks.map((hunk, index) => {
    const previous = hunks[index - 1];
    const next = hunks[index + 1];
    const oldEnd = hunk.oldStart + hunk.oldCount;
    const leadFrom = Math.max(
      previous ? previous.oldStart + previous.oldCount : 0,
      hunk.oldStart - context,
    );
    const trailTo = Math.min(next ? next.oldStart : before.length, oldEnd + context);
    const edits: LineEditPreview[] = [];
    for (let offset = 0; offset < lineEditCount(hunk); offset += 1) {
      const edit: LineEditPreview = {};
      if (offset < hunk.oldCount) edit.removed = stripEnding(before[hunk.oldStart + offset]);
      if (offset < hunk.newCount) edit.added = stripEnding(after[hunk.newStart + offset]);
      edits.push(edit);
    }
    return {
      oldLine: leadFrom + 1,
      // Lines before a hunk are the same in both files, so they sit the same distance above it.
      newLine: hunk.newStart - (hunk.oldStart - leadFrom) + 1,
      lead: before.slice(leadFrom, hunk.oldStart).map(stripEnding),
      edits,
      trail: before.slice(oldEnd, Math.max(oldEnd, trailTo)).map(stripEnding),
    };
  });
}
