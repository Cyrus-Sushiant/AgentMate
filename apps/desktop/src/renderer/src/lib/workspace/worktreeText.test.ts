import { describe, expect, it } from 'vitest';
import { mergeBlockerMessage, removeWarnings, statusSummary } from './worktreeText';

describe('mergeBlockerMessage', () => {
  it('says what is in the way and what to do about it', () => {
    expect(mergeBlockerMessage({ kind: 'worktree-dirty', changes: 4 }, 'feat', 'main')).toBe(
      'Commit or discard the 4 changes in this worktree first.',
    );
    expect(mergeBlockerMessage({ kind: 'worktree-dirty', changes: 1 }, 'feat', 'main')).toBe(
      'Commit or discard the 1 change in this worktree first.',
    );
    expect(mergeBlockerMessage({ kind: 'main-dirty', changes: 2 }, 'feat', 'main')).toBe(
      'The main checkout has 2 uncommitted changes. Commit or stash them there first.',
    );
    expect(mergeBlockerMessage({ kind: 'main-not-on-base', current: 'dev' }, 'feat', 'main')).toBe(
      'The main checkout is on dev, not main. Switch it to main first.',
    );
    expect(mergeBlockerMessage({ kind: 'main-not-on-base', current: null }, 'feat', 'main')).toBe(
      'The main checkout is not on a branch. Switch it to main first.',
    );
    expect(mergeBlockerMessage({ kind: 'nothing-to-merge' }, 'feat', 'main')).toBe(
      'Nothing to merge: main already has everything on feat.',
    );
  });
});

describe('statusSummary', () => {
  it('reads as short badges', () => {
    const base = { changes: 0, ahead: 0, behind: 0, merged: true, unpushed: null };
    expect(statusSummary(base)).toEqual([]);
    expect(statusSummary({ ...base, changes: 3, ahead: 2, behind: 1, merged: false })).toEqual([
      { kind: 'changes', text: '3 changes' },
      { kind: 'ahead', text: '↑2' },
      { kind: 'behind', text: '↓1' },
    ]);
    expect(statusSummary({ ...base, changes: 1 })).toEqual([{ kind: 'changes', text: '1 change' }]);
  });
});

describe('removeWarnings', () => {
  const clean = {
    branch: 'feat',
    baseBranch: 'main',
    missing: false,
    changes: 0,
    ahead: 0,
    unpushed: null,
    merged: true,
  };

  it('says nothing when there is nothing to lose', () => {
    expect(removeWarnings(clean, { terminals: 0, working: 0 })).toEqual([]);
  });

  it('lists what would be lost, the worst first', () => {
    expect(
      removeWarnings(
        { ...clean, changes: 4, ahead: 3, merged: false, unpushed: 3 },
        { terminals: 2, working: 1 },
      ),
    ).toEqual([
      { tone: 'danger', text: '4 uncommitted changes will be lost.' },
      { tone: 'warning', text: '3 commits are not merged into main or pushed.' },
      { tone: 'info', text: '2 terminals will be stopped (1 agent is still working).' },
    ]);
  });

  it('counts pushed commits as safe', () => {
    expect(
      removeWarnings(
        { ...clean, ahead: 2, merged: false, unpushed: 0 },
        { terminals: 1, working: 0 },
      ),
    ).toEqual([
      { tone: 'info', text: '2 commits are not merged into main, but they are pushed.' },
      { tone: 'info', text: '1 terminal will be stopped.' },
    ]);
  });

  it('mentions a folder that is already gone', () => {
    expect(removeWarnings({ ...clean, missing: true }, { terminals: 0, working: 0 })).toEqual([
      { tone: 'info', text: 'Its folder is already gone, so this only tidies up git.' },
    ]);
  });
});
