import {
  type MergeMethod,
  type PrReviewThread,
  type PullRequestInfo,
  parsePrView,
  parseReviewThreads,
} from '@agentmat/core';
import type { MergeStep, MergeStepResult } from '../../shared/apiTypes';
import { githubRepoForFolder } from '../pipelines/githubActions';
import { ghErrorMessage, ghGraphql, runGh } from './githubCli';
import { checkoutBranch, deleteBranch, git } from './plumbing';

/** What `gh pr view` is asked for; everything the Pull request tab shows comes from this. */
const PR_FIELDS = [
  'number',
  'title',
  'url',
  'state',
  'isDraft',
  'baseRefName',
  'headRefName',
  'mergeable',
  'mergeStateStatus',
  'reviewDecision',
  'additions',
  'deletions',
  'statusCheckRollup',
].join(',');

const THREADS_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id isResolved isOutdated path line
          comments(first: 50) { nodes { author { login } body createdAt url } }
        }
      }
    }
  }
}`;

const REPLY_MUTATION = `mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment { id }
  }
}`;

const RESOLVE_MUTATION = `mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } }
}`;

const UNRESOLVE_MUTATION = `mutation($threadId: ID!) {
  unresolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } }
}`;

/** Merging, checking out and pulling can each wait on the network. */
const PR_WRITE_TIMEOUT_MS = 120_000;

/** The newest PR for the branch (open, merged or closed), or null when it never had one. */
export async function readBranchPullRequest(
  cwd: string,
  branch: string,
): Promise<PullRequestInfo | null> {
  let stdout: string;
  try {
    ({ stdout } = await runGh(['pr', 'view', branch, '--json', PR_FIELDS], {
      cwd,
      readOnly: true,
    }));
  } catch (error) {
    if (/no (open )?pull requests? found/i.test(ghErrorMessage(error))) return null;
    throw error;
  }
  const pr = parsePrView(JSON.parse(stdout));
  // Threads come from a second call; a PR whose threads can't be read is still worth showing.
  pr.threads = await readReviewThreads(cwd, pr.number).catch(() => []);
  return pr;
}

export async function readReviewThreads(cwd: string, number: number): Promise<PrReviewThread[]> {
  const repo = await githubRepoForFolder(cwd);
  if (!repo) return [];
  const data = await ghGraphql<unknown>(THREADS_QUERY, { ...repo, number });
  return parseReviewThreads({ data });
}

export async function commentOnPullRequest(
  cwd: string,
  number: number,
  body: string,
): Promise<void> {
  if (!body.trim()) throw new Error('The comment is empty.');
  await runGh(['pr', 'comment', String(number), '--body', body], { cwd });
}

export async function replyToReviewThread(threadId: string, body: string): Promise<void> {
  if (!body.trim()) throw new Error('The reply is empty.');
  await ghGraphql(REPLY_MUTATION, { threadId, body });
}

export async function setReviewThreadResolved(threadId: string, resolved: boolean): Promise<void> {
  await ghGraphql(resolved ? RESOLVE_MUTATION : UNRESOLVE_MUTATION, { threadId });
}

export async function readPullRequestDiff(cwd: string, number: number): Promise<string> {
  const { stdout } = await runGh(['pr', 'diff', String(number), '--color', 'never'], {
    cwd,
    readOnly: true,
  });
  return stdout;
}

export async function markPullRequestReady(cwd: string, number: number): Promise<void> {
  await runGh(['pr', 'ready', String(number)], { cwd });
}

function failure(step: MergeStep, error: unknown): MergeStepResult {
  return { step, ok: false, message: ghErrorMessage(error) };
}

/**
 * After a merge: switch to the base branch, bring it up to date, and delete the merged branch
 * here and on GitHub. Stops at the first step that fails, since each needs the one before it.
 */
export async function cleanupAfterMerge(
  cwd: string,
  { base, head }: { base: string; head: string },
): Promise<MergeStepResult[]> {
  const steps: MergeStepResult[] = [];
  try {
    await checkoutBranch(cwd, base);
    steps.push({ step: 'checkout', ok: true, message: `Switched to ${base}.` });
  } catch (error) {
    steps.push(failure('checkout', error));
    return steps;
  }

  try {
    // --prune drops the remote-tracking ref GitHub may have deleted on merge.
    await git(cwd, ['pull', '--ff-only', '--prune'], PR_WRITE_TIMEOUT_MS);
    steps.push({ step: 'pull', ok: true, message: `${base} is up to date.` });
  } catch (error) {
    steps.push(failure('pull', error));
    return steps;
  }

  if (head === base) {
    steps.push({
      step: 'delete',
      ok: false,
      message: `Not deleting ${head}, it is the base branch.`,
    });
    return steps;
  }
  try {
    // Forced: a squash or rebase merge leaves the branch looking unmerged to git.
    const message = await deleteBranch(cwd, head, { deleteRemote: true, force: true });
    steps.push({ step: 'delete', ok: true, message });
  } catch (error) {
    const reason = ghErrorMessage(error);
    if (/remote ref does not exist|was not found/i.test(reason)) {
      steps.push({ step: 'delete', ok: true, message: `${head} was already deleted.` });
    } else {
      steps.push({ step: 'delete', ok: false, message: reason });
    }
  }
  return steps;
}

export interface MergePullRequestInput {
  number: number;
  base: string;
  head: string;
  method: MergeMethod;
  /** Switch to the base, pull, and delete the branch locally and on GitHub afterwards. */
  cleanup: boolean;
}

export async function mergePullRequest(
  cwd: string,
  input: MergePullRequestInput,
): Promise<{ ok: boolean; merged: boolean; steps: MergeStepResult[] }> {
  // Checked first: merging and then failing to switch branches would leave the user on a
  // branch that no longer exists on GitHub, with their changes in the way.
  if (input.cleanup) {
    const dirty = (await git(cwd, ['status', '--porcelain'])).trim();
    if (dirty) {
      return {
        ok: false,
        merged: false,
        steps: [
          {
            step: 'merge',
            ok: false,
            message:
              'You have uncommitted changes. Commit or discard them first, so switching branches after the merge cannot lose them.',
          },
        ],
      };
    }
  }

  try {
    await runGh(['pr', 'merge', String(input.number), `--${input.method}`], {
      cwd,
      timeout: PR_WRITE_TIMEOUT_MS,
    });
  } catch (error) {
    return { ok: false, merged: false, steps: [failure('merge', error)] };
  }
  const merged: MergeStepResult = {
    step: 'merge',
    ok: true,
    message: `Merged #${input.number} into ${input.base}.`,
  };
  if (!input.cleanup) return { ok: true, merged: true, steps: [merged] };

  const cleanup = await cleanupAfterMerge(cwd, input);
  return {
    ok: cleanup.every((step) => step.ok),
    merged: true,
    steps: [merged, ...cleanup],
  };
}
