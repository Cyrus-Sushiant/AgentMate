import { type PullRequestInfo, summarizeChecks } from '@agentmat/core';
import type { PullRequestStatus } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { GitPullRequest } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** What on an open PR is waiting on the user: failed checks plus unresolved threads. */
export function pullRequestAttention(pr: PullRequestInfo | null | undefined): {
  count: number;
  failing: boolean;
} {
  if (!pr || pr.state !== 'OPEN') return { count: 0, failing: false };
  const failed = summarizeChecks(pr.checks).failed;
  const open = pr.threads.filter((thread) => !thread.isResolved).length;
  return { count: failed + open, failing: failed > 0 };
}

/**
 * `#42` next to the branch name, coloured by the PR's state. Reads whatever the Pull request tab
 * last loaded, so it never starts a gh call of its own.
 */
export function BranchPrPill({ projectId }: { projectId: string }): React.JSX.Element | null {
  const revealPanelSection = useWorkspaceStore((s) => s.revealPanelSection);
  const { data } = useQuery<PullRequestStatus>({
    queryKey: queryKeys.pullRequest(projectId),
    queryFn: () => window.agentmat.pullRequests.status(projectId),
    enabled: false,
  });
  const pr = data?.pr;
  if (!pr) return null;
  const { failing } = pullRequestAttention(pr);
  const running = pr.state === 'OPEN' && summarizeChecks(pr.checks).running > 0;
  const label =
    pr.state === 'MERGED'
      ? 'merged'
      : pr.state === 'CLOSED'
        ? 'closed'
        : failing
          ? 'checks failing'
          : running
            ? 'checks running'
            : pr.isDraft
              ? 'draft'
              : 'open';

  return (
    <SimpleTooltip label={`Pull request #${pr.number}, ${label}. Click to open the pull request`}>
      <button
        type="button"
        onClick={() => revealPanelSection('pullRequest')}
        className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-foreground/[0.06] px-1.5 text-[10.5px] font-medium tabular-nums transition-colors hover:bg-foreground/[0.1]"
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            pr.state === 'MERGED'
              ? 'bg-violet-500'
              : pr.state === 'CLOSED' || failing
                ? 'bg-destructive'
                : running
                  ? 'bg-amber-500'
                  : pr.isDraft
                    ? 'bg-muted-foreground'
                    : 'bg-success',
          )}
        />
        <GitPullRequest className="h-2.5 w-2.5 text-muted-foreground" />#{pr.number}
      </button>
    </SimpleTooltip>
  );
}
