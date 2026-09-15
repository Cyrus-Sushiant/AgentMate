import type { Project } from '@agentmat/core';
import type { GitCommitInfo, WorkspaceGitState } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ChevronRight, Copy, GitCommit, Tag } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { changeStatusMeta, splitGitPath } from '@/lib/git';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function CommitFiles({
  project,
  commit,
}: {
  project: Project;
  commit: GitCommitInfo;
}): React.JSX.Element {
  const openDiff = useWorkspaceStore((s) => s.openDiff);
  const files = useQuery({
    queryKey: ['git-commit-files', project.id, commit.hash],
    queryFn: () => window.agentmat.git.commitFiles(project.id, commit.hash),
    staleTime: Number.POSITIVE_INFINITY,
    meta: { silentLoading: true },
  });

  if (files.isPending) {
    return (
      <div className="space-y-1 py-1 pl-8 pr-3">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <Skeleton className="h-3.5 w-1/2 rounded" />
      </div>
    );
  }
  if (!files.data?.length) {
    return <p className="py-1.5 pl-8 text-[11px] text-muted-foreground">No file changes.</p>;
  }
  return (
    <div className="pb-1">
      {files.data.map((entry) => {
        const { dir, name } = splitGitPath(entry.path);
        const meta = changeStatusMeta(entry.status);
        return (
          <button
            key={entry.path}
            type="button"
            onClick={() =>
              openDiff(project.id, {
                path: entry.path,
                origPath: entry.origPath,
                side: 'staged',
                commit: commit.hash,
              })
            }
            onDoubleClick={() =>
              openDiff(
                project.id,
                { path: entry.path, origPath: entry.origPath, side: 'staged', commit: commit.hash },
                { pin: true },
              )
            }
            className="mx-1 flex h-6 w-[calc(100%-0.5rem)] items-center gap-2 rounded-md pl-7 pr-2 text-left text-[12px] hover:bg-foreground/[0.05]"
          >
            <span className="min-w-0 shrink truncate">{name}</span>
            {dir ? (
              <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/80 [direction:rtl]">
                <bdi>{dir.replace(/\/$/, '')}</bdi>
              </span>
            ) : (
              <span className="flex-1" />
            )}
            {!entry.binary && (entry.additions || entry.deletions) ? (
              <span className="font-mono text-[10px] tabular-nums">
                <span className="text-success">+{entry.additions ?? 0}</span>{' '}
                <span className="text-destructive">−{entry.deletions ?? 0}</span>
              </span>
            ) : null}
            <span
              className={cn('w-3 text-center font-mono text-[10px] font-semibold', meta.className)}
            >
              {meta.letter}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The branch's recent history. Expanding a commit lists its files; a file opens its diff. */
export function CommitsSection({
  project,
  state,
}: {
  project: Project;
  state: WorkspaceGitState | undefined;
}): React.JSX.Element {
  const branch = state?.branch ?? null;
  const [expanded, setExpanded] = useState<string | null>(null);
  const history = useQuery({
    // HEAD in the key refreshes the list the moment a commit, pull or checkout lands.
    queryKey: [...queryKeys.gitBranchHistory(project.id, branch ?? 'HEAD'), state?.head ?? ''],
    queryFn: () => window.agentmat.git.branchHistory(project.id, branch ?? 'HEAD'),
    enabled: Boolean(state?.isRepo && state.head),
    meta: { silentLoading: true },
    placeholderData: (previous) => previous,
  });

  if (!state?.isRepo) {
    return <p className="p-3 text-xs text-muted-foreground">Not a git repository.</p>;
  }
  if (!state.head) {
    return <p className="p-3 text-xs text-muted-foreground">No commits yet on this branch.</p>;
  }
  if (history.isPending) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3.5 rounded" style={{ width: `${85 - i * 8}%` }} />
            <Skeleton className="h-2.5 w-1/3 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const commits = history.data?.commits ?? [];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-1">
      {commits.map((commit, index) => {
        const open = expanded === commit.hash;
        const unpushed = index < state.ahead;
        return (
          <div key={commit.hash}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded(open ? null : commit.hash)}
              className={cn(
                'group/commit relative mx-1 flex w-[calc(100%-0.5rem)] items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05]',
                open && 'bg-foreground/[0.04]',
              )}
            >
              <span className="relative mt-1 flex w-3 shrink-0 justify-center">
                {/* The line of history, with a hollow dot for commits not pushed yet. */}
                <span
                  className={cn(
                    'h-2 w-2 rounded-full border-2',
                    unpushed ? 'border-primary bg-transparent' : 'border-primary/70 bg-primary/70',
                  )}
                />
                {index < commits.length - 1 ? (
                  <span className="absolute top-3 h-[calc(100%+0.5rem)] w-px bg-border" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <ChevronRight
                    className={cn(
                      'h-2 w-2 shrink-0 text-muted-foreground transition-transform',
                      open && 'rotate-90',
                    )}
                  />
                  <span className="truncate text-[12px] font-medium">{commit.subject}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 pl-3.5 text-[10px] text-muted-foreground">
                  <span className="font-mono">{commit.shortHash}</span>
                  <span>·</span>
                  <span className="truncate">{commit.author}</span>
                  <span>·</span>
                  <span className="shrink-0">{timeAgo(commit.date)}</span>
                  {unpushed ? <span className="shrink-0 text-primary">not pushed</span> : null}
                </span>
                {commit.tags.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1 pl-3.5">
                    {commit.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] text-primary"
                      >
                        <Tag className="h-2 w-2" />
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
              <SimpleTooltip label="Copy commit id">
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Copy commit id"
                  onClick={(event) => {
                    event.stopPropagation();
                    void navigator.clipboard.writeText(commit.hash);
                  }}
                  className="mt-0.5 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground group-hover/commit:flex"
                >
                  <Copy className="h-2.5 w-2.5" />
                </span>
              </SimpleTooltip>
            </button>
            {open ? <CommitFiles project={project} commit={commit} /> : null}
          </div>
        );
      })}
      {commits.length >= 100 ? (
        <p className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-muted-foreground">
          <GitCommit className="h-2.5 w-2.5" /> Showing the latest 100 commits.
        </p>
      ) : null}
    </div>
  );
}
