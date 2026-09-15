import type { GitChangeEntry } from '@agentmat/core';
import type { WorkspaceGitState } from '@shared/apiTypes';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

/**
 * The workspace changes panel's state for a project. While `watching`, main watches the
 * working tree and pushes every change, so this never polls.
 */
export function useWorkspaceGitState(projectId: string, watching: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.gitWorkspaceState(projectId),
    queryFn: () => window.agentmat.git.workspaceState(projectId),
    meta: { silentLoading: true },
    // Pushed updates keep it current; a refetch on its own would only duplicate them.
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    return window.agentmat.git.onWorkspaceState((id, state) => {
      if (id !== projectId) return;
      queryClient.setQueryData(queryKeys.gitWorkspaceState(projectId), state);
      // Open diffs and the project page's Git tab read the same tree.
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitFileDiffs(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
      // A file was added, removed or changed on disk; the explorer tree re-reads its open folders.
      void queryClient.invalidateQueries({ queryKey: ['workspace-explorer', projectId] });
    });
  }, [projectId, queryClient]);

  useEffect(() => {
    if (!watching) return;
    void window.agentmat.git.watchWorkingTree(projectId);
    return () => {
      void window.agentmat.git.unwatchWorkingTree(projectId);
    };
  }, [projectId, watching]);

  return query;
}

function without(entries: GitChangeEntry[], paths: Set<string>): GitChangeEntry[] {
  return entries.filter((entry) => !paths.has(entry.path));
}

/** Moves rows between sections straight away; the state main pushes back settles the details. */
function optimistic(
  queryClient: QueryClient,
  projectId: string,
  change: (state: WorkspaceGitState) => WorkspaceGitState,
): void {
  queryClient.setQueryData<WorkspaceGitState>(queryKeys.gitWorkspaceState(projectId), (state) =>
    state ? change(state) : state,
  );
}

export interface GitActions {
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  discard: (paths: string[], side: 'unstaged' | 'untracked') => Promise<void>;
  resolve: (path: string, pick: 'ours' | 'theirs') => Promise<void>;
  abort: () => Promise<void>;
  commit: (message: string, push: boolean) => Promise<boolean>;
}

export function useGitActions(projectId: string): GitActions {
  const queryClient = useQueryClient();
  return useMemo<GitActions>(() => {
    const git = window.agentmat.git;
    const resync = (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitWorkspaceState(projectId) });
    };

    return {
      stage: async (paths) => {
        const set = new Set(paths);
        optimistic(queryClient, projectId, (state) => {
          const moved = [...state.unstaged, ...state.untracked, ...state.conflicts]
            .filter(
              (entry) => set.has(entry.path) && !state.staged.some((s) => s.path === entry.path),
            )
            .map((entry) => ({
              path: entry.path,
              status:
                entry.status === '?'
                  ? ('A' as const)
                  : entry.status === 'U'
                    ? ('M' as const)
                    : entry.status,
              additions: entry.additions,
              deletions: entry.deletions,
            }));
          return {
            ...state,
            staged: [...state.staged, ...moved].sort((a, b) => a.path.localeCompare(b.path)),
            unstaged: without(state.unstaged, set),
            untracked: without(state.untracked, set),
            conflicts: without(state.conflicts, set),
          };
        });
        const result = await git.stage(projectId, paths);
        if (!result.ok) {
          toast.error('Could not stage', { description: result.message });
          resync();
        }
      },

      unstage: async (paths) => {
        const set = new Set(paths);
        optimistic(queryClient, projectId, (state) => {
          const leaving = state.staged.filter((entry) => set.has(entry.path));
          const toUntracked = leaving
            .filter((entry) => entry.status === 'A')
            .map((entry) => ({ path: entry.path, status: '?' as const }));
          const toUnstaged = leaving
            .filter(
              (entry) => entry.status !== 'A' && !state.unstaged.some((u) => u.path === entry.path),
            )
            .map((entry) => ({ ...entry, origPath: undefined }));
          const byPath = (a: GitChangeEntry, b: GitChangeEntry): number =>
            a.path.localeCompare(b.path);
          return {
            ...state,
            staged: without(state.staged, set),
            unstaged: [...state.unstaged, ...toUnstaged].sort(byPath),
            untracked: [...state.untracked, ...toUntracked].sort(byPath),
          };
        });
        const result = await git.unstage(projectId, paths);
        if (!result.ok) {
          toast.error('Could not unstage', { description: result.message });
          resync();
        }
      },

      discard: async (paths, side) => {
        const set = new Set(paths);
        optimistic(queryClient, projectId, (state) =>
          side === 'untracked'
            ? { ...state, untracked: without(state.untracked, set) }
            : { ...state, unstaged: without(state.unstaged, set) },
        );
        const result = await git.discard(projectId, paths, side);
        if (!result.ok) {
          toast.error('Could not discard', { description: result.message });
          resync();
          return;
        }
        const token = result.undoToken;
        toast.success(result.message, {
          action: token
            ? {
                label: 'Undo',
                onClick: () => {
                  void git.undoDiscard(projectId, token).then((undo) => {
                    if (!undo.ok) toast.error('Could not undo', { description: undo.message });
                  });
                },
              }
            : undefined,
        });
      },

      resolve: async (path, pick) => {
        const result = await git.resolveConflict(projectId, path, pick);
        if (result.ok) toast.success(result.message);
        else toast.error('Could not resolve the conflict', { description: result.message });
      },

      abort: async () => {
        const result = await git.abortOperation(projectId);
        if (result.ok) toast.success(result.message);
        else toast.error('Could not abort', { description: result.message });
      },

      commit: async (message, push) => {
        const result = await git.commitStaged(projectId, message, push);
        if (!result.ok) {
          toast.error(push ? 'Commit and push failed' : 'Commit failed', {
            description: result.message,
          });
          return false;
        }
        const firstLine = message.split('\n')[0];
        toast.success(push ? 'Committed and pushed' : 'Committed', { description: firstLine });
        return true;
      },
    };
  }, [projectId, queryClient]);
}
