import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

/**
 * React Query invalidates by key prefix, so the shape of these arrays is behaviour: a key that
 * stops starting with its parent's root quietly stops being refreshed with it.
 */
function startsWith(key: readonly unknown[], prefix: readonly unknown[]): boolean {
  return prefix.every((part, index) => key[index] === part);
}

describe('queryKeys', () => {
  it('builds a per-argument key for the simple lookups', () => {
    expect(queryKeys.workspaceFile('E:\\a\\b.ts')).toEqual(['workspace-file', 'E:\\a\\b.ts']);
    expect(queryKeys.project('p1')).toEqual(['projects', 'p1']);
    expect(queryKeys.gitStatus('p1')).toEqual(['git-status', 'p1']);
  });

  it('nests a project is explorer listings under one root', () => {
    const root = queryKeys.workspaceExplorer('p1');
    expect(startsWith(queryKeys.workspaceExplorerDir('p1', 'src'), root)).toBe(true);
    expect(startsWith(queryKeys.workspaceExplorerIgnored('p1', 'src'), root)).toBe(true);
    // The ignored list hangs off the directory listing, so refreshing a folder covers it.
    expect(
      startsWith(
        queryKeys.workspaceExplorerIgnored('p1', 'src'),
        queryKeys.workspaceExplorerDir('p1', 'src'),
      ),
    ).toBe(true);
  });

  it('keeps another project is explorer out of that root', () => {
    expect(
      startsWith(queryKeys.workspaceExplorerDir('p2', 'src'), queryKeys.workspaceExplorer('p1')),
    ).toBe(false);
  });

  it('nests a single project under the projects list', () => {
    expect(startsWith(queryKeys.project('p1'), queryKeys.projects)).toBe(true);
  });

  it('nests every skill repository index under one root', () => {
    expect(startsWith(queryKeys.repositoryIndex('r1'), queryKeys.repositoryIndexes)).toBe(true);
    expect(
      startsWith(queryKeys.localSkillFolderPreview('/x'), queryKeys.localSkillFolderPreviews),
    ).toBe(true);
  });

  it('nests the per-skill audit lists under the audit root', () => {
    expect(startsWith(queryKeys.skillAuditsFor('s1'), queryKeys.skillAudits)).toBe(true);
    // The "latest" list is deliberately its own root, not a child of the history.
    expect(startsWith(queryKeys.skillAuditsLatest, queryKeys.skillAudits)).toBe(false);
  });

  it('nests every prompt history variant under the prompt history root', () => {
    expect(startsWith(queryKeys.promptHistorySearch('db'), queryKeys.promptHistory)).toBe(true);
    expect(startsWith(queryKeys.projectPromptHistory('p1'), queryKeys.promptHistory)).toBe(true);
  });

  it('nests a blueprint is revisions and agent file under the blueprint', () => {
    const root = queryKeys.blueprint('p1');
    expect(startsWith(queryKeys.blueprintRevisions('p1', 'step-2'), root)).toBe(true);
    expect(startsWith(queryKeys.blueprintAgentFile('p1'), root)).toBe(true);
  });

  it('names the final prompt is revisions when there is no step', () => {
    expect(queryKeys.blueprintRevisions('p1', null)).toEqual([
      'blueprint',
      'p1',
      'revisions',
      'final-prompt',
    ]);
  });

  it('nests every diff of a project under one prefix', () => {
    expect(
      startsWith(queryKeys.gitFileDiff('p1', 'unstaged', 'a.ts'), queryKeys.gitFileDiffs('p1')),
    ).toBe(true);
  });

  it('nests a tag series and every branch history under their project prefix', () => {
    expect(startsWith(queryKeys.gitTagsForPrefix('p1', 'v'), queryKeys.gitTags('p1'))).toBe(true);
    expect(
      startsWith(queryKeys.gitBranchHistory('p1', 'master'), queryKeys.gitBranchHistories('p1')),
    ).toBe(true);
  });

  it('nests everything decrypted from the vault under one root, so locking clears it all', () => {
    expect(startsWith(queryKeys.vaultEntries, queryKeys.vaultData)).toBe(true);
    expect(startsWith(queryKeys.vaultEntry('e1'), queryKeys.vaultData)).toBe(true);
    // The status is what the lock screen reads, so it must survive that same removal.
    expect(startsWith(queryKeys.vaultStatus, queryKeys.vaultData)).toBe(false);
  });

  it('separates a project docker listing from the global one', () => {
    expect(startsWith(queryKeys.dockerListForProject('p1'), queryKeys.dockerList)).toBe(true);
    expect(queryKeys.dockerListForProject('p1')).not.toEqual(queryKeys.dockerList);
  });

  it('keys an update check by the version it was asked about', () => {
    expect(queryKeys.cliUpdateCheck('claude-code', null)).toEqual([
      'cli-update-check',
      'claude-code',
      null,
    ]);
    expect(queryKeys.toolUpdateCheck('gh', '2.0.0')).toEqual(['tool-update-check', 'gh', '2.0.0']);
  });

  it('gives no two static keys the same root', () => {
    // Some entries are key builders (functions), the rest are the static keys this checks.
    const roots = Object.values(queryKeys)
      .filter((value) => Array.isArray(value))
      .map((key) => JSON.stringify(key));
    expect(new Set(roots).size).toBe(roots.length);
  });
});
