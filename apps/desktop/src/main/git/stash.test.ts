import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasGit, initGitRepo } from '../../test/main/fixtures';
import {
  assertStashRef,
  listStashes,
  readWorkspaceGitState,
  stashDrop,
  stashPush,
  stashRestore,
} from './workspaceGit';

/**
 * The stash menu in the workspace's Changes section ("Stash All (--include-untracked)",
 * "Stash All and Keep Staged (--keep-index)") and the Stashes section's pop/apply/drop,
 * covered against a real repository.
 */

const git = hasGit();

describe.runIf(git)('stashPush and listStashes', () => {
  it('stashes tracked changes and lists the stash newest first', async () => {
    const repo = initGitRepo({ 'app.ts': 'const a = 1;\n' });
    writeFileSync(join(repo.dir, 'app.ts'), 'const a = 2;\n');

    await stashPush(repo.dir, { includeUntracked: false, keepIndex: false });
    const stashes = await listStashes(repo.dir);
    expect(stashes).toHaveLength(1);
    expect(stashes[0]).toMatchObject({ ref: 'stash@{0}', index: 0 });
    expect(stashes[0]?.message).toContain('WIP on');

    // The working tree is clean again once everything is stashed.
    const state = await readWorkspaceGitState(repo.dir);
    expect([...state.staged, ...state.unstaged, ...state.untracked]).toHaveLength(0);
  });

  it('leaves untracked files behind unless asked to include them', async () => {
    const repo = initGitRepo({ 'app.ts': 'const a = 1;\n' });
    writeFileSync(join(repo.dir, 'app.ts'), 'const a = 2;\n');
    writeFileSync(join(repo.dir, 'fresh.ts'), 'const b = 2;\n');

    await stashPush(repo.dir, { includeUntracked: false, keepIndex: false });
    expect(await listStashes(repo.dir)).toHaveLength(1);
    expect((await readWorkspaceGitState(repo.dir)).untracked.map((e) => e.path)).toEqual([
      'fresh.ts',
    ]);
  });

  it('takes untracked files along with --include-untracked', async () => {
    const repo = initGitRepo({ 'app.ts': 'const a = 1;\n' });
    writeFileSync(join(repo.dir, 'fresh.ts'), 'const b = 2;\n');

    await stashPush(repo.dir, { includeUntracked: true, keepIndex: false });
    expect(await listStashes(repo.dir)).toHaveLength(1);
    expect((await readWorkspaceGitState(repo.dir)).untracked).toHaveLength(0);
  });

  it('keeps staged changes in place with --keep-index', async () => {
    const repo = initGitRepo({ 'app.ts': 'const a = 1;\n' });
    writeFileSync(join(repo.dir, 'app.ts'), 'const a = 2;\n');
    repo.git('add', 'app.ts');
    writeFileSync(join(repo.dir, 'app.ts'), 'const a = 3;\n');

    await stashPush(repo.dir, { includeUntracked: false, keepIndex: true });
    const state = await readWorkspaceGitState(repo.dir);
    expect(state.staged.map((e) => e.path)).toEqual(['app.ts']);
  });

  it('refuses to stash a clean tree', async () => {
    const repo = initGitRepo();
    await expect(
      stashPush(repo.dir, { includeUntracked: false, keepIndex: false }),
    ).rejects.toThrow('There are no changes to stash.');
  });
});

describe.runIf(git)('stashRestore and stashDrop', () => {
  it('pops the newest stash by default, restoring the changes and dropping it', async () => {
    const repo = initGitRepo({ 'app.ts': 'const a = 1;\n' });
    writeFileSync(join(repo.dir, 'app.ts'), 'const a = 2;\n');
    await stashPush(repo.dir, {
      includeUntracked: false,
      keepIndex: false,
      message: 'my changes',
    });

    await stashRestore(repo.dir, 'stash@{0}', 'pop');
    expect(await listStashes(repo.dir)).toHaveLength(0);
    expect((await readWorkspaceGitState(repo.dir)).unstaged.map((e) => e.path)).toEqual(['app.ts']);
  });

  it('apply keeps the stash around for a second restore', async () => {
    const repo = initGitRepo({ 'app.ts': 'const a = 1;\n' });
    writeFileSync(join(repo.dir, 'app.ts'), 'const a = 2;\n');
    await stashPush(repo.dir, { includeUntracked: false, keepIndex: false });

    await stashRestore(repo.dir, 'stash@{0}', 'apply');
    expect(await listStashes(repo.dir)).toHaveLength(1);

    await stashDrop(repo.dir, 'stash@{0}');
    expect(await listStashes(repo.dir)).toHaveLength(0);
  });
});

describe('assertStashRef', () => {
  it('accepts a stash ref and reads its index', () => {
    expect(assertStashRef('stash@{2}')).toEqual({ ref: 'stash@{2}', index: 2 });
  });

  it('refuses anything that is not a stash ref', () => {
    for (const ref of ['main', 'HEAD', 'stash@{x}', '', null, undefined, 'stash@{-1}']) {
      expect(() => assertStashRef(ref)).toThrow('That is not a stash.');
    }
  });
});
