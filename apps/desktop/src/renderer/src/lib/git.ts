import type { GitChangeStatus } from '@agentmat/core';

/** Splits a repo path into its folder (with the trailing slash) and file name. */
export function splitGitPath(path: string): { dir: string; name: string } {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (i < 0) return { dir: '', name: path };
  return { dir: path.slice(0, i + 1), name: path.slice(i + 1) };
}

/** A CLI's suggested commit message, without the code fences and quotes models like to add. */
export function sanitizeCommitMessage(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export interface ChangeStatusMeta {
  letter: string;
  label: string;
  /** Text colour for the status letter. */
  className: string;
}

const STATUS_META: Record<GitChangeStatus, ChangeStatusMeta> = {
  M: { letter: 'M', label: 'Modified', className: 'text-warning' },
  A: { letter: 'A', label: 'Added', className: 'text-success' },
  D: { letter: 'D', label: 'Deleted', className: 'text-destructive' },
  R: { letter: 'R', label: 'Renamed', className: 'text-sky-400' },
  C: { letter: 'C', label: 'Copied', className: 'text-sky-400' },
  T: { letter: 'T', label: 'Type changed', className: 'text-warning' },
  U: { letter: '!', label: 'Conflict', className: 'text-destructive' },
  '?': { letter: 'U', label: 'Untracked', className: 'text-success/80' },
};

export function changeStatusMeta(status: GitChangeStatus): ChangeStatusMeta {
  return STATUS_META[status];
}
