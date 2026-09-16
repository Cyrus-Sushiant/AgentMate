/**
 * Line hunks from a zero-context diff (`git diff -U0`), and the two things done with them:
 * showing each hunk on its own, and rebuilding a file with only some of them applied.
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
 * The before file with every hunk applied except the ones in `revert`. Hunks from a
 * zero-context diff never share a line, so each one can be taken or left on its own.
 */
export function applyLineHunks(
  before: readonly string[],
  after: readonly string[],
  hunks: readonly LineHunk[],
  revert: ReadonlySet<number>,
): string {
  const out: string[] = [];
  let cursor = 0;
  hunks.forEach((hunk, index) => {
    out.push(...before.slice(cursor, hunk.oldStart));
    if (revert.has(index)) out.push(...before.slice(hunk.oldStart, hunk.oldStart + hunk.oldCount));
    else out.push(...after.slice(hunk.newStart, hunk.newStart + hunk.newCount));
    cursor = hunk.oldStart + hunk.oldCount;
  });
  out.push(...before.slice(cursor));
  return out.join('');
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
  const all = new Set(hunks.map((_, index) => index));
  return (
    applyLineHunks(before, after, hunks, new Set()) === after.join('') &&
    applyLineHunks(before, after, hunks, all) === before.join('')
  );
}

function stripEnding(line: string): string {
  return line.replace(/\r?\n$/, '');
}

/**
 * Each hunk as diff lines (' ', '-' or '+' in front) with up to `context` unchanged lines on
 * either side. Context stops short of a neighbouring hunk's changed lines, so it only ever shows
 * lines that are the same in both files.
 */
export function lineHunkPreviews(
  before: readonly string[],
  after: readonly string[],
  hunks: readonly LineHunk[],
  context = 2,
): string[][] {
  return hunks.map((hunk, index) => {
    const previous = hunks[index - 1];
    const next = hunks[index + 1];
    const oldEnd = hunk.oldStart + hunk.oldCount;
    const leadFrom = Math.max(
      previous ? previous.oldStart + previous.oldCount : 0,
      hunk.oldStart - context,
    );
    const trailTo = Math.min(next ? next.oldStart : before.length, oldEnd + context);
    return [
      ...before.slice(leadFrom, hunk.oldStart).map((line) => ` ${stripEnding(line)}`),
      ...before.slice(hunk.oldStart, oldEnd).map((line) => `-${stripEnding(line)}`),
      ...after
        .slice(hunk.newStart, hunk.newStart + hunk.newCount)
        .map((line) => `+${stripEnding(line)}`),
      ...before.slice(oldEnd, Math.max(oldEnd, trailTo)).map((line) => ` ${stripEnding(line)}`),
    ];
  });
}
