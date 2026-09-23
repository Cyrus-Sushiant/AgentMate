import { summarizeChecks } from '@agentmat/core';
import type {
  MergePullRequestIpcInput,
  MergePullRequestResult,
  MergeStepResult,
  PrActionResult,
  PullRequestStatus,
} from '@shared/apiTypes';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { queryKeys } from '@/lib/queryKeys';

export interface RecentMerge {
  number: number;
  base: string;
  head: string;
  steps: MergeStepResult[];
}

/**
 * The last merge made from the tab, per project. Cleanup switches to the default branch, which
 * turns the tab into its "start from a branch" state; this keeps the outcome on screen there.
 */
export const useRecentMerges = create<{
  byProject: Record<string, RecentMerge>;
  record: (projectId: string, merge: RecentMerge) => void;
  dismiss: (projectId: string) => void;
}>((set) => ({
  byProject: {},
  record: (projectId, merge) =>
    set((state) => ({ byProject: { ...state.byProject, [projectId]: merge } })),
  dismiss: (projectId) =>
    set((state) => {
      const { [projectId]: _gone, ...rest } = state.byProject;
      return { byProject: rest };
    }),
}));

const FAST_POLL_MS = 15_000;
const SLOW_POLL_MS = 60_000;

/**
 * How often to ask GitHub again. Running checks change by the minute, so they are watched
 * closely; nothing is polled when there is no PR GitHub could still change.
 */
export function pullRequestRefetchInterval(status: PullRequestStatus | undefined): number | false {
  if (!status?.cliAvailable || !status.authenticated || !status.github) return false;
  if (!status.branch || status.onDefaultBranch) return false;
  if (!status.pr) return SLOW_POLL_MS;
  if (status.pr.state !== 'OPEN') return false;
  return summarizeChecks(status.pr.checks).running > 0 ? FAST_POLL_MS : SLOW_POLL_MS;
}

/** The facts from the live git state that make the PR worth reading again when they change. */
export interface PullRequestWatch {
  visible: boolean;
  branch: string | null | undefined;
  head: string | null | undefined;
  ahead: number | undefined;
}

export function usePullRequest(projectId: string, watch: PullRequestWatch) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.pullRequest(projectId),
    queryFn: () => window.agentmat.pullRequests.status(projectId),
    enabled: watch.visible,
    refetchInterval: (q) => (watch.visible ? pullRequestRefetchInterval(q.state.data) : false),
    meta: { silentLoading: true },
  });

  // A commit, push, or branch switch changes what the tab should show; the first render is
  // already covered by the query itself.
  const fingerprint = `${watch.branch ?? ''}|${watch.head ?? ''}|${watch.ahead ?? ''}`;
  const seen = useRef(fingerprint);
  useEffect(() => {
    if (seen.current === fingerprint) return;
    seen.current = fingerprint;
    if (watch.visible) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(projectId) });
    }
  }, [fingerprint, projectId, queryClient, watch.visible]);

  return query;
}

function patchThreads(
  queryClient: QueryClient,
  projectId: string,
  threadId: string,
  resolved: boolean,
): void {
  queryClient.setQueryData<PullRequestStatus>(queryKeys.pullRequest(projectId), (status) =>
    status?.pr
      ? {
          ...status,
          pr: {
            ...status.pr,
            threads: status.pr.threads.map((thread) =>
              thread.id === threadId ? { ...thread, isResolved: resolved } : thread,
            ),
          },
        }
      : status,
  );
}

export interface PullRequestActions {
  comment: (number: number, body: string) => Promise<boolean>;
  reply: (threadId: string, body: string) => Promise<boolean>;
  resolveThread: (threadId: string, resolved: boolean) => Promise<boolean>;
  markReady: (number: number) => Promise<boolean>;
  merge: (input: Omit<MergePullRequestIpcInput, 'projectId'>) => Promise<MergePullRequestResult>;
  cleanup: (base: string, head: string) => Promise<MergePullRequestResult>;
  refresh: () => void;
}

export function usePullRequestActions(projectId: string): PullRequestActions {
  const queryClient = useQueryClient();
  return useMemo<PullRequestActions>(() => {
    const api = window.agentmat.pullRequests;
    const refresh = (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(projectId) });
    };
    const settle = (result: PrActionResult): boolean => {
      if (!result.ok) toast.error(result.error ?? 'GitHub did not accept that.');
      refresh();
      return result.ok;
    };
    const afterMerge = (result: MergePullRequestResult): MergePullRequestResult => {
      refresh();
      // The branch list, history and changes panel all describe a branch that may be gone.
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitWorkspaceState(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitBranchHistories(projectId) });
      return result;
    };

    return {
      refresh,
      comment: async (number, body) => settle(await api.comment({ projectId, number, body })),
      reply: async (threadId, body) => settle(await api.replyThread({ projectId, threadId, body })),
      resolveThread: async (threadId, resolved) => {
        patchThreads(queryClient, projectId, threadId, resolved);
        const result = await api.resolveThread({ projectId, threadId, resolved });
        if (!result.ok) patchThreads(queryClient, projectId, threadId, !resolved);
        return settle(result);
      },
      markReady: async (number) => settle(await api.markReady(projectId, number)),
      merge: async (input) => afterMerge(await api.merge({ projectId, ...input })),
      cleanup: async (base, head) => afterMerge(await api.cleanup({ projectId, base, head })),
    };
  }, [projectId, queryClient]);
}
