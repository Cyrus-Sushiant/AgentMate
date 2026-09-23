import type { PrCheck, PullRequestInfo } from '@agentmat/core';
import type { PullRequestStatus } from '@shared/apiTypes';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithProviders } from '../../../../../../test/renderer/renderWithProviders';
import {
  pullRequestRefetchInterval,
  usePullRequest,
  usePullRequestActions,
} from './usePullRequest';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

function check(status: string, conclusion: string | null = null): PrCheck {
  return { name: 'ci', workflow: 'CI', status, conclusion, detailsUrl: null, runId: null };
}

const PR: PullRequestInfo = {
  number: 7,
  title: 'Add it',
  url: 'https://github.com/acme/app/pull/7',
  state: 'OPEN',
  isDraft: false,
  base: 'master',
  head: 'feature',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  reviewDecision: null,
  additions: 1,
  deletions: 0,
  checks: [check('completed', 'success')],
  threads: [
    { id: 'T1', isResolved: false, isOutdated: false, path: 'a.ts', line: 1, comments: [] },
  ],
};

function status(overrides: Partial<PullRequestStatus> = {}): PullRequestStatus {
  return {
    cliAvailable: true,
    authenticated: true,
    github: { owner: 'acme', repo: 'app' },
    branch: 'feature',
    defaultBranch: 'master',
    onDefaultBranch: false,
    ahead: 0,
    hasUpstream: true,
    dirty: false,
    pr: PR,
    ...overrides,
  };
}

describe('pullRequestRefetchInterval', () => {
  it('polls quickly while checks run and slowly once they settle', () => {
    expect(
      pullRequestRefetchInterval(status({ pr: { ...PR, checks: [check('in_progress')] } })),
    ).toBe(15_000);
    expect(pullRequestRefetchInterval(status())).toBe(60_000);
  });

  it('does not poll when there is nothing GitHub could change', () => {
    expect(pullRequestRefetchInterval(undefined)).toBe(false);
    expect(pullRequestRefetchInterval(status({ cliAvailable: false }))).toBe(false);
    expect(pullRequestRefetchInterval(status({ github: null }))).toBe(false);
    expect(pullRequestRefetchInterval(status({ onDefaultBranch: true, pr: null }))).toBe(false);
    expect(pullRequestRefetchInterval(status({ pr: { ...PR, state: 'MERGED' } }))).toBe(false);
  });

  it('keeps watching a branch with no PR yet, in case one is opened on github.com', () => {
    expect(pullRequestRefetchInterval(status({ pr: null }))).toBe(60_000);
  });
});

describe('usePullRequest', () => {
  it('reads the status and reads it again when the branch moves', async () => {
    const { result, rerender, bridge } = renderHookWithProviders(
      ({ head }: { head: string }) =>
        usePullRequest('p1', { visible: true, branch: 'feature', head, ahead: 0 }),
      {
        initialProps: { head: 'aaa' },
        bridge: { 'pullRequests.status': status() },
      },
    );
    await waitFor(() => expect(result.current.data?.pr?.number).toBe(7));
    expect(bridge.$fn('pullRequests.status')).toHaveBeenCalledTimes(1);

    rerender({ head: 'bbb' });
    await waitFor(() => expect(bridge.$fn('pullRequests.status')).toHaveBeenCalledTimes(2));
  });

  it('stays idle while the tab is hidden', async () => {
    const { bridge } = renderHookWithProviders(
      () => usePullRequest('p1', { visible: false, branch: 'feature', head: 'a', ahead: 0 }),
      { bridge: { 'pullRequests.status': status() } },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    // $fn throws for a path nothing called, which is the point here.
    expect(() => bridge.$fn('pullRequests.status')).toThrow('has not been touched');
  });
});

describe('usePullRequestActions', () => {
  it('resolves a thread straight away and keeps it resolved when GitHub agrees', async () => {
    const { result, queryClient, bridge } = renderHookWithProviders(
      () => usePullRequestActions('p1'),
      { bridge: { 'pullRequests.resolveThread': { ok: true }, 'pullRequests.status': status() } },
    );
    queryClient.setQueryData(queryKeys.pullRequest('p1'), status());

    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.current.resolveThread('T1', true);
    });
    const cached = queryClient.getQueryData<PullRequestStatus>(queryKeys.pullRequest('p1'));
    expect(cached?.pr?.threads[0]?.isResolved).toBe(true);
    await act(async () => {
      expect(await pending).toBe(true);
    });
    expect(bridge.$fn('pullRequests.resolveThread')).toHaveBeenCalledWith({
      projectId: 'p1',
      threadId: 'T1',
      resolved: true,
    });
  });

  it('puts the thread back and says why when resolving fails', async () => {
    const { result, queryClient } = renderHookWithProviders(() => usePullRequestActions('p1'), {
      bridge: {
        'pullRequests.resolveThread': { ok: false, error: 'Resource not accessible' },
        'pullRequests.status': new Promise(() => {
          // Never settles: the refresh after an action stays in flight, so the cache is what is checked.
        }),
      },
    });
    queryClient.setQueryData(queryKeys.pullRequest('p1'), status());

    await act(async () => {
      expect(await result.current.resolveThread('T1', true)).toBe(false);
    });
    const cached = queryClient.getQueryData<PullRequestStatus>(queryKeys.pullRequest('p1'));
    expect(cached?.pr?.threads[0]?.isResolved).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Resource not accessible');
  });

  it('posts a comment and refreshes the PR', async () => {
    const { result, bridge } = renderHookWithProviders(() => usePullRequestActions('p1'), {
      bridge: { 'pullRequests.comment': { ok: true }, 'pullRequests.status': status() },
    });
    await act(async () => {
      expect(await result.current.comment(7, '@claude review')).toBe(true);
    });
    expect(bridge.$fn('pullRequests.comment')).toHaveBeenCalledWith({
      projectId: 'p1',
      number: 7,
      body: '@claude review',
    });
  });
});
