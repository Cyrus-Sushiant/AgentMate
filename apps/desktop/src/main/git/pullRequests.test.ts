import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The gh and git boundaries are stubbed at the module level, so these tests are about what the
 * PR flow asks for and in what order: which merge flag, when cleanup stops, which errors count.
 */

const gh = vi.hoisted(() => ({
  runGh: vi.fn(),
  ghGraphql: vi.fn(),
}));
vi.mock('./githubCli', async (importOriginal) => ({
  ghErrorMessage: (await importOriginal<typeof import('./githubCli')>()).ghErrorMessage,
  ...gh,
}));

const plumbing = vi.hoisted(() => ({
  git: vi.fn(),
  checkoutBranch: vi.fn(),
  deleteBranch: vi.fn(),
}));
vi.mock('./plumbing', () => plumbing);

vi.mock('../pipelines/githubActions', () => ({
  githubRepoForFolder: async () => ({ owner: 'acme', repo: 'app' }),
}));

const {
  cleanupAfterMerge,
  commentOnPullRequest,
  markPullRequestReady,
  mergePullRequest,
  readBranchPullRequest,
  readPullRequestDiff,
  replyToReviewThread,
  setReviewThreadResolved,
} = await import('./pullRequests');

const CWD = 'C:/repo';

function ghFailure(stderr: string): Error {
  return Object.assign(new Error('Command failed'), { stderr });
}

beforeEach(() => {
  vi.resetAllMocks();
  plumbing.git.mockResolvedValue('');
  plumbing.checkoutBranch.mockResolvedValue("Switched to branch 'master'");
  plumbing.deleteBranch.mockResolvedValue(
    "Deleted local branch 'feature'. Deleted 'feature' on origin.",
  );
  gh.runGh.mockResolvedValue({ stdout: '', stderr: '' });
});

describe('readBranchPullRequest', () => {
  it('returns null when the branch has no pull request', async () => {
    gh.runGh.mockRejectedValue(ghFailure('no pull requests found for branch "feature"'));
    expect(await readBranchPullRequest(CWD, 'feature')).toBeNull();
  });

  it('rethrows any other gh failure', async () => {
    gh.runGh.mockRejectedValue(ghFailure('HTTP 401: Bad credentials'));
    await expect(readBranchPullRequest(CWD, 'feature')).rejects.toThrow();
  });

  it('reads the PR for the branch and its review threads', async () => {
    gh.runGh.mockResolvedValue({
      stdout: JSON.stringify({ number: 7, state: 'OPEN', title: 'T', headRefName: 'feature' }),
      stderr: '',
    });
    gh.ghGraphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              { id: 'T1', isResolved: false, path: 'a.ts', line: 1, comments: { nodes: [] } },
            ],
          },
        },
      },
    });

    const pr = await readBranchPullRequest(CWD, 'feature');

    const [args, options] = gh.runGh.mock.calls[0] ?? [];
    expect(args.slice(0, 4)).toEqual(['pr', 'view', 'feature', '--json']);
    expect(args[4]).toContain('statusCheckRollup');
    expect(options).toMatchObject({ cwd: CWD, readOnly: true });
    expect(gh.ghGraphql.mock.calls[0]?.[1]).toEqual({ owner: 'acme', repo: 'app', number: 7 });
    expect(pr?.number).toBe(7);
    expect(pr?.threads.map((t) => t.id)).toEqual(['T1']);
  });

  it('still shows the PR when the review threads cannot be read', async () => {
    gh.runGh.mockResolvedValue({ stdout: JSON.stringify({ number: 7 }), stderr: '' });
    gh.ghGraphql.mockRejectedValue(new Error('rate limited'));
    expect((await readBranchPullRequest(CWD, 'feature'))?.threads).toEqual([]);
  });
});

describe('review actions', () => {
  it('posts a PR comment with the body as one argument', async () => {
    await commentOnPullRequest(CWD, 7, '@claude review');
    expect(gh.runGh).toHaveBeenCalledWith(['pr', 'comment', '7', '--body', '@claude review'], {
      cwd: CWD,
    });
  });

  it('refuses an empty comment', async () => {
    await expect(commentOnPullRequest(CWD, 7, '   ')).rejects.toThrow(/empty/);
    expect(gh.runGh).not.toHaveBeenCalled();
  });

  it('replies to a thread through GraphQL variables, never string-built queries', async () => {
    gh.ghGraphql.mockResolvedValue({});
    await replyToReviewThread('T1', 'Fixed in "abc"');
    const [query, variables] = gh.ghGraphql.mock.calls[0] ?? [];
    expect(query).toContain('addPullRequestReviewThreadReply');
    expect(query).not.toContain('Fixed');
    expect(variables).toEqual({ threadId: 'T1', body: 'Fixed in "abc"' });
  });

  it('resolves and unresolves threads', async () => {
    gh.ghGraphql.mockResolvedValue({});
    await setReviewThreadResolved('T1', true);
    await setReviewThreadResolved('T1', false);
    expect(gh.ghGraphql.mock.calls[0]?.[0]).toContain('resolveReviewThread');
    expect(gh.ghGraphql.mock.calls[1]?.[0]).toContain('unresolveReviewThread');
    expect(gh.ghGraphql.mock.calls[0]?.[1]).toEqual({ threadId: 'T1' });
  });

  it('reads the diff without colour codes', async () => {
    gh.runGh.mockResolvedValue({ stdout: 'diff --git', stderr: '' });
    expect(await readPullRequestDiff(CWD, 7)).toBe('diff --git');
    expect(gh.runGh.mock.calls[0]?.[0]).toEqual(['pr', 'diff', '7', '--color', 'never']);
  });

  it('marks a draft ready for review', async () => {
    await markPullRequestReady(CWD, 7);
    expect(gh.runGh.mock.calls[0]?.[0]).toEqual(['pr', 'ready', '7']);
  });
});

describe('mergePullRequest', () => {
  const input = { number: 7, base: 'master', head: 'feature', cleanup: true } as const;

  it.each([
    ['squash', '--squash'],
    ['merge', '--merge'],
    ['rebase', '--rebase'],
  ] as const)('merges with %s', async (method, flag) => {
    await mergePullRequest(CWD, { ...input, method, cleanup: false });
    expect(gh.runGh.mock.calls[0]?.[0]).toEqual(['pr', 'merge', '7', flag]);
  });

  it('leaves branch deletion to its own step instead of gh --delete-branch', async () => {
    await mergePullRequest(CWD, { ...input, method: 'squash' });
    expect(gh.runGh.mock.calls[0]?.[0]).not.toContain('--delete-branch');
  });

  it('merges, switches to the base, pulls and deletes the branch, in that order', async () => {
    const order: string[] = [];
    gh.runGh.mockImplementation(async () => {
      order.push('merge');
      return { stdout: '', stderr: '' };
    });
    plumbing.git.mockImplementation(async (_cwd: string, args: string[]) => {
      order.push(args.join(' '));
      return '';
    });
    plumbing.checkoutBranch.mockImplementation(async () => {
      order.push('checkout');
      return '';
    });
    plumbing.deleteBranch.mockImplementation(async () => {
      order.push('delete');
      return 'Deleted.';
    });

    const result = await mergePullRequest(CWD, { ...input, method: 'squash' });

    expect(order).toEqual([
      'status --porcelain',
      'merge',
      'checkout',
      'pull --ff-only --prune',
      'delete',
    ]);
    expect(result.ok).toBe(true);
    expect(result.merged).toBe(true);
    expect(result.steps.map((s) => [s.step, s.ok])).toEqual([
      ['merge', true],
      ['checkout', true],
      ['pull', true],
      ['delete', true],
    ]);
    expect(plumbing.checkoutBranch).toHaveBeenCalledWith(CWD, 'master');
    // A squash merge leaves the branch looking unmerged to git, so -d would refuse.
    expect(plumbing.deleteBranch).toHaveBeenCalledWith(CWD, 'feature', {
      deleteRemote: true,
      force: true,
    });
  });

  it('refuses before merging when uncommitted changes would block the switch', async () => {
    plumbing.git.mockResolvedValueOnce(' M src/a.ts\n');
    const result = await mergePullRequest(CWD, { ...input, method: 'squash' });
    expect(gh.runGh).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, merged: false });
    expect(result.steps[0]?.message).toMatch(/uncommitted/);
  });

  it('does not look at the working tree when nothing local is touched', async () => {
    plumbing.git.mockResolvedValue(' M src/a.ts\n');
    const result = await mergePullRequest(CWD, { ...input, method: 'squash', cleanup: false });
    expect(result).toMatchObject({ ok: true, merged: true });
    expect(plumbing.checkoutBranch).not.toHaveBeenCalled();
  });

  it('stops at a failed merge with gh’s reason', async () => {
    gh.runGh.mockRejectedValue(ghFailure('Pull request is not mergeable: the base branch policy'));
    const result = await mergePullRequest(CWD, { ...input, method: 'squash' });
    expect(result).toMatchObject({ ok: false, merged: false });
    expect(result.steps).toEqual([
      {
        step: 'merge',
        ok: false,
        message: 'Pull request is not mergeable: the base branch policy',
      },
    ]);
    expect(plumbing.checkoutBranch).not.toHaveBeenCalled();
  });

  it('reports a partial failure and skips the delete once a step fails', async () => {
    plumbing.git.mockImplementation(async (_cwd: string, args: string[]) => {
      if (args[0] === 'pull') throw ghFailure('fatal: Not possible to fast-forward, aborting.');
      return '';
    });
    const result = await mergePullRequest(CWD, { ...input, method: 'squash' });
    expect(result.merged).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.steps.map((s) => [s.step, s.ok])).toEqual([
      ['merge', true],
      ['checkout', true],
      ['pull', false],
    ]);
    expect(plumbing.deleteBranch).not.toHaveBeenCalled();
  });
});

describe('cleanupAfterMerge', () => {
  it('counts a branch GitHub already deleted as done', async () => {
    plumbing.deleteBranch.mockRejectedValue(
      ghFailure("error: unable to delete 'feature': remote ref does not exist"),
    );
    const steps = await cleanupAfterMerge(CWD, { base: 'master', head: 'feature' });
    expect(steps.at(-1)).toMatchObject({ step: 'delete', ok: true });
    expect(steps.at(-1)?.message).toMatch(/already/);
  });

  it('counts a branch that is already gone locally and remotely as done', async () => {
    plumbing.deleteBranch.mockRejectedValue(new Error("Branch 'feature' was not found."));
    const steps = await cleanupAfterMerge(CWD, { base: 'master', head: 'feature' });
    expect(steps.at(-1)).toMatchObject({ step: 'delete', ok: true });
  });

  it('never deletes the branch it is merging into', async () => {
    const steps = await cleanupAfterMerge(CWD, { base: 'feature', head: 'feature' });
    expect(plumbing.deleteBranch).not.toHaveBeenCalled();
    expect(steps.at(-1)).toMatchObject({ step: 'delete', ok: false });
  });
});
