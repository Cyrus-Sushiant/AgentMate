import type { GitPendingOperation, WorkspaceGitState } from './apiTypes';

/** Git's two-letter unmerged codes, in the words `git status` prints for them. */
export const CONFLICT_KINDS: Record<string, string> = {
  UU: 'both modified',
  AA: 'both added',
  DD: 'both deleted',
  AU: 'added by us',
  UA: 'added by them',
  DU: 'deleted by us',
  UD: 'deleted by them',
};

/** What the two sides of the markers are, which flips between a merge and a rebase. */
export function sidesNote(operation: GitPendingOperation | null): string {
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

/** Past this many files the list stops and the agent is pointed at `git status` instead. */
export const FIX_CONFLICTS_LIST_LIMIT = 50;

/**
 * The prompt for handing every conflict in the working tree to an agent in a terminal. Unlike
 * the per-file prompt, the agent stages what it resolves so the panel's Conflicts list empties
 * as it goes, and the user still makes the commit (or continues the rebase) themselves.
 */
export function buildFixConflictsPrompt(
  state: Pick<WorkspaceGitState, 'operation' | 'branch' | 'conflicts' | 'projectPrefix'>,
): string {
  const { operation, branch, conflicts, projectPrefix } = state;
  const shown = conflicts.slice(0, FIX_CONFLICTS_LIST_LIMIT);
  const hidden = conflicts.length - shown.length;
  const files = shown.map((entry) => {
    const kind = entry.conflict ? CONFLICT_KINDS[entry.conflict] : undefined;
    return `- ${entry.path}${kind ? ` (${kind})` : ''}`;
  });
  if (hidden > 0) {
    files.push(`- and ${hidden} more (run \`git status\` to see them all)`);
  }
  const count = `${conflicts.length} file${conflicts.length === 1 ? '' : 's'}`;
  const prefix = projectPrefix.replace(/\/+$/, '');

  return [
    `This repository has unresolved git conflicts in ${count}${branch ? ` on the branch ${branch}` : ''}.`,
    sidesNote(operation),
    prefix
      ? `Paths are relative to the repository root. Your working directory is its "${prefix}" subfolder.`
      : 'Paths are relative to the repository root.',
    files.join('\n'),
    'Resolve every one of them. For each conflict block (<<<<<<< ... ======= ... >>>>>>>, with an ' +
      'optional ||||||| base section) write the code that keeps the intent of both sides. When ' +
      'both sides change the same thing in incompatible ways, prefer the version that fits the ' +
      'surrounding code. For a file that one side deleted and the other changed, decide whether ' +
      'it should still exist. Remove every conflict marker and keep the existing formatting.',
    "Once the files are resolved, run the project's build and tests where you can and fix what " +
      'the merged code broke.',
    'Run git add on each file as soon as it is resolved. Do not commit, and do not run git merge ' +
      '--continue, git rebase --continue, any --abort or anything else that moves the branch: ' +
      'I will finish the operation myself.',
    'When you are done, list each file with a short note on how you resolved it.',
  ].join('\n\n');
}
