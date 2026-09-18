import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasGit, initGitRepo } from '../../test/main/fixtures';
import { readWorkspaceGitState } from './workspaceGit';

/**
 * The changes panel's totals only add up if every side carries line counts. Git hands them over
 * for the staged and unstaged diffs; untracked files are in no diff, so this reads them off disk
 * instead, and that half is what these cover against a real repository.
 */

const git = hasGit();
const lines = (count: number, text = 'line'): string =>
  Array.from({ length: count }, (_, i) => `${text} ${i}`).join('\n') + '\n';

describe.runIf(git)('readWorkspaceGitState line counts', () => {
  it('counts the lines in an untracked file', async () => {
    const repo = initGitRepo({ 'README.md': '# test\n' });
    writeFileSync(join(repo.dir, 'fresh.ts'), lines(137));

    const state = await readWorkspaceGitState(repo.dir);
    expect(state.untracked).toHaveLength(1);
    expect(state.untracked[0]).toMatchObject({
      path: 'fresh.ts',
      additions: 137,
      deletions: 0,
      binary: false,
    });
  });

  it('counts a last line with no newline after it, and nothing in an empty file', async () => {
    const repo = initGitRepo({ 'README.md': '# test\n' });
    writeFileSync(join(repo.dir, 'no-newline.txt'), 'one\ntwo\nthree');
    writeFileSync(join(repo.dir, 'empty.txt'), '');

    const state = await readWorkspaceGitState(repo.dir);
    const counts = Object.fromEntries(
      state.untracked.map((entry) => [entry.path, entry.additions]),
    );
    expect(counts['no-newline.txt']).toBe(3);
    expect(counts['empty.txt']).toBe(0);
  });

  it('marks an untracked binary file rather than counting it', async () => {
    const repo = initGitRepo({ 'README.md': '# test\n' });
    writeFileSync(join(repo.dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a]));

    const state = await readWorkspaceGitState(repo.dir);
    expect(state.untracked[0]).toMatchObject({ binary: true, additions: 0 });
  });

  it('re-reads a file once it changes, and leaves the count alone when it has not', async () => {
    const repo = initGitRepo({ 'README.md': '# test\n' });
    const file = join(repo.dir, 'fresh.ts');
    writeFileSync(file, lines(10));
    expect((await readWorkspaceGitState(repo.dir)).untracked[0]?.additions).toBe(10);

    writeFileSync(file, lines(25));
    expect((await readWorkspaceGitState(repo.dir)).untracked[0]?.additions).toBe(25);
    expect((await readWorkspaceGitState(repo.dir)).untracked[0]?.additions).toBe(25);
  });

  it('still gets its counts from git for the staged and unstaged sides', async () => {
    const repo = initGitRepo({ 'app.ts': lines(30) });
    writeFileSync(join(repo.dir, 'app.ts'), lines(30, 'changed'));
    repo.git('add', 'app.ts');
    writeFileSync(join(repo.dir, 'app.ts'), lines(30, 'changed') + 'one more\n');

    const state = await readWorkspaceGitState(repo.dir);
    expect(state.staged[0]).toMatchObject({ path: 'app.ts', additions: 30, deletions: 30 });
    expect(state.unstaged[0]).toMatchObject({ path: 'app.ts', additions: 1, deletions: 0 });
  });
});
