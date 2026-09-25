import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitPendingOperation } from '../../shared/apiTypes';

/**
 * A conflict hunk starts with `<<<<<<<` and ends with `>>>>>>>`, each at the start of a line
 * and followed by a label or nothing. `=======` alone is left out: it is also a Markdown
 * heading underline, so a resolved README would still look conflicted.
 */
const CONFLICT_MARKER = /^(?:<{7}|>{7})(?:[ \t]|\r?$)/m;

export function hasConflictMarkers(text: string): boolean {
  return CONFLICT_MARKER.test(text);
}

/** The file as it is on disk right now, or null when it is gone or not text. */
export async function readConflictedText(root: string, path: string): Promise<string | null> {
  let buffer: Buffer;
  try {
    buffer = await readFile(join(root, path));
  } catch {
    return null;
  }
  if (buffer.subarray(0, 8000).includes(0)) return null;
  return buffer.toString('utf8');
}

/** Git's two-letter unmerged codes, in the words `git status` prints for them. */
const CONFLICT_KINDS: Record<string, string> = {
  UU: 'both modified',
  AA: 'both added',
  DD: 'both deleted',
  AU: 'added by us',
  UA: 'added by them',
  DU: 'deleted by us',
  UD: 'deleted by them',
};

/** What the two sides of the markers are, which flips between a merge and a rebase. */
function sidesNote(operation: GitPendingOperation | null): string {
  switch (operation) {
    case 'rebase':
      return (
        'A rebase is in progress, so the HEAD side of each conflict is the branch being rebased ' +
        'onto and the other side is the commit being replayed on top of it.'
      );
    case 'cherry-pick':
      return 'A cherry-pick is in progress: HEAD is the current branch, the other side is the picked commit.';
    case 'revert':
      return 'A revert is in progress: HEAD is the current branch, the other side undoes an earlier commit.';
    case 'merge':
      return 'A merge is in progress: HEAD is the current branch, the other side is the branch being merged in.';
    default:
      return 'HEAD is the current branch.';
  }
}

/**
 * Kept short on purpose: on Windows most CLIs take the prompt as an argument, which cmd.exe
 * caps at a few thousand characters, so the agent reads the file itself instead of getting
 * it pasted in here.
 */
export function buildConflictResolutionPrompt(
  path: string,
  operation: GitPendingOperation | null,
  conflictCode?: string,
): string {
  const kind = conflictCode ? CONFLICT_KINDS[conflictCode] : undefined;
  return [
    `Resolve the git conflicts in the file ${JSON.stringify(path)} (relative to the repository root).`,
    sidesNote(operation),
    kind ? `Git reports this file as "${kind}".` : '',
    'Read the file, then for every conflict block (<<<<<<< ... ======= ... >>>>>>>, with an ' +
      'optional ||||||| base section) write the code that keeps the intent of both sides. When ' +
      'both sides change the same thing in incompatible ways, prefer the version that fits the ' +
      'rest of the file and the surrounding code. Look at other files only if you need them to ' +
      'understand the change.',
    'Edit only this file. Remove every conflict marker. Keep the existing indentation, line ' +
      'endings and formatting. Do not run git add, git commit, git merge, git rebase or any ' +
      'other command that changes the repository.',
    'When you are done, reply with one or two short sentences saying how you resolved it.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The CLI's closing sentence, cut down to something that fits in a toast. */
export function resolutionSummary(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines.at(-1);
  if (!last) return undefined;
  return last.length > 240 ? `${last.slice(0, 239)}…` : last;
}
