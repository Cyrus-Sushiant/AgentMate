import { describe, expect, it } from 'vitest';
import type { WorkspaceGitState } from './apiTypes';
import { buildFixConflictsPrompt, FIX_CONFLICTS_LIST_LIMIT } from './conflictPrompts';

type ConflictState = Parameters<typeof buildFixConflictsPrompt>[0];

const state = (patch: Partial<ConflictState> = {}): ConflictState => ({
  operation: 'merge',
  branch: 'main',
  projectPrefix: '',
  conflicts: [
    { path: 'src/app.ts', status: 'U', conflict: 'UU' },
    { path: 'docs/old.md', status: 'U', conflict: 'DU' },
  ] as WorkspaceGitState['conflicts'],
  ...patch,
});

describe('buildFixConflictsPrompt', () => {
  it('lists every conflicted file with the kind git reports', () => {
    const prompt = buildFixConflictsPrompt(state());
    expect(prompt).toContain('unresolved git conflicts in 2 files on the branch main.');
    expect(prompt).toContain('- src/app.ts (both modified)');
    expect(prompt).toContain('- docs/old.md (deleted by us)');
    expect(prompt).toContain('Paths are relative to the repository root.');
  });

  it('explains which side is which for a merge and for a rebase', () => {
    expect(buildFixConflictsPrompt(state())).toContain(
      'HEAD is the current branch, the other side is the branch being merged in.',
    );
    expect(buildFixConflictsPrompt(state({ operation: 'rebase' }))).toContain(
      'the HEAD side of each conflict is the branch being rebased onto',
    );
  });

  it('still works with no operation pending, as after a stash pop', () => {
    const prompt = buildFixConflictsPrompt(state({ operation: null, branch: null }));
    expect(prompt).toContain('unresolved git conflicts in 2 files.');
    expect(prompt).toContain('HEAD is the current branch.');
  });

  it('leaves the kind out when git gives no code, and counts a single file', () => {
    const prompt = buildFixConflictsPrompt(
      state({ conflicts: [{ path: 'a.ts', status: 'U' }] as WorkspaceGitState['conflicts'] }),
    );
    expect(prompt).toContain('in 1 file on');
    expect(prompt).toMatch(/^- a\.ts$/m);
  });

  it('tells the agent when it runs in a subfolder of the repository', () => {
    const prompt = buildFixConflictsPrompt(state({ projectPrefix: 'apps/web/' }));
    expect(prompt).toContain('Your working directory is its "apps/web" subfolder.');
  });

  it('stops listing past the limit and points at git status', () => {
    const conflicts = Array.from({ length: FIX_CONFLICTS_LIST_LIMIT + 3 }, (_, i) => ({
      path: `f${i}.ts`,
      status: 'U',
      conflict: 'UU',
    })) as WorkspaceGitState['conflicts'];
    const prompt = buildFixConflictsPrompt(state({ conflicts }));
    expect(prompt).toContain(`- f${FIX_CONFLICTS_LIST_LIMIT - 1}.ts`);
    expect(prompt).not.toContain(`- f${FIX_CONFLICTS_LIST_LIMIT}.ts`);
    expect(prompt).toContain('- and 3 more (run `git status` to see them all)');
  });

  it('has the agent stage what it resolves but leave the operation to the user', () => {
    const prompt = buildFixConflictsPrompt(state());
    expect(prompt).toContain('Run git add on each file as soon as it is resolved.');
    expect(prompt).toContain('Do not commit');
    expect(prompt).toContain('I will finish the operation myself.');
  });

  it('never uses an em dash', () => {
    expect(buildFixConflictsPrompt(state({ operation: 'cherry-pick' }))).not.toContain('—');
  });
});
