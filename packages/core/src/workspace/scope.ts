/**
 * A workspace belongs either to a project's own checkout (keyed by the project id) or to one of
 * its git worktrees (keyed by a scope id that carries both). Everything that keys state by
 * project, from the workspace store to the git handlers, takes a scope id unchanged.
 */

/** Project ids are UUIDs, so this can never appear inside one. It is also safe in a URL. */
const SEPARATOR = '~';

export interface ParsedScope {
  projectId: string;
  /** Null for the project's main checkout. */
  worktreeId: string | null;
}

export function worktreeScopeId(projectId: string, worktreeId: string): string {
  if (
    !projectId ||
    projectId.includes(SEPARATOR) ||
    !worktreeId ||
    worktreeId.includes(SEPARATOR)
  ) {
    throw new Error(`Cannot build a worktree scope from "${projectId}" and "${worktreeId}"`);
  }
  return `${projectId}${SEPARATOR}${worktreeId}`;
}

export function parseScopeId(scopeId: string): ParsedScope {
  const index = scopeId.indexOf(SEPARATOR);
  if (index === -1) return { projectId: scopeId, worktreeId: null };
  return { projectId: scopeId.slice(0, index), worktreeId: scopeId.slice(index + 1) || null };
}

export function isWorktreeScope(scopeId: string): boolean {
  return parseScopeId(scopeId).worktreeId !== null;
}
