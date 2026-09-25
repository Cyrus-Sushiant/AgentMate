import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeWebContents } from '../../test/main/electronMock';
import { hasGit, initGitRepo, tempDir, writeTree } from '../../test/main/fixtures';

const send = vi.hoisted(() => ({ broadcastToWindows: vi.fn() }));
vi.mock('../ipc/send', () => send);

const { gitWatchTarget, isTracked, unwatchProjectRepo, watchProjectRepo } = await import(
  './repoWatcher'
);

function samePath(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase();
}

describe('isTracked', () => {
  it('follows the files a commit or checkout rewrites, and skips the rest', () => {
    expect(isTracked('HEAD')).toBe(true);
    expect(isTracked('refs/heads/main')).toBe(true);
    expect(isTracked('index.lock')).toBe(false);
    expect(isTracked('objects/ab/cdef')).toBe(false);
    expect(isTracked(null)).toBe(true);
  });

  it('for a worktree, follows its own HEAD and index plus the shared refs', () => {
    const prefix = 'worktrees/feat/';
    expect(isTracked('worktrees/feat/HEAD', prefix)).toBe(true);
    expect(isTracked('worktrees\\feat\\index', prefix)).toBe(true);
    expect(isTracked('refs/heads/feat', prefix)).toBe(true);
    expect(isTracked('packed-refs', prefix)).toBe(true);
    // The main checkout's own HEAD, and another worktree's, are someone else's business.
    expect(isTracked('HEAD', prefix)).toBe(false);
    expect(isTracked('worktrees/other/HEAD', prefix)).toBe(false);
  });
});

describe.runIf(hasGit())('gitWatchTarget', () => {
  it('watches .git for a normal checkout', () => {
    const repo = initGitRepo();
    const target = gitWatchTarget(repo.dir);
    expect(samePath(target?.root ?? '', join(repo.dir, '.git'))).toBe(true);
    expect(target?.prefix).toBe('');
  });

  it('watches the shared .git with a prefix for a worktree, whose .git is a file', () => {
    const repo = initGitRepo();
    const path = join(tempDir(), 'feat');
    repo.git('worktree', 'add', '-b', 'feat', path);
    const target = gitWatchTarget(path);
    expect(samePath(target?.root ?? '', join(repo.dir, '.git'))).toBe(true);
    expect(target?.prefix).toBe('worktrees/feat/');
  });

  it('gives up on a folder that is not a repository', () => {
    expect(gitWatchTarget(tempDir())).toBeNull();
  });
});

describe.runIf(hasGit())('watchProjectRepo in a worktree', () => {
  const sender = fakeWebContents();
  afterEach(() => unwatchProjectRepo('p1~wt-1', sender as never));

  it('refreshes when a commit lands in the worktree', async () => {
    const repo = initGitRepo();
    const path = join(tempDir(), 'feat');
    repo.git('worktree', 'add', '-b', 'feat', path);
    watchProjectRepo('p1~wt-1', path, sender as never);

    writeTree(path, { 'new.txt': 'x' });
    repo.git('-C', path, 'add', '.');
    repo.git('-C', path, 'commit', '-m', 'in the worktree');

    await vi.waitFor(
      () => expect(send.broadcastToWindows).toHaveBeenCalledWith(expect.any(String), 'p1~wt-1'),
      { timeout: 5000 },
    );
  });
});
