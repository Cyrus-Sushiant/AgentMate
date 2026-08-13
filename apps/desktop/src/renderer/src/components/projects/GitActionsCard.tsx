import type { ProjectGithubAction } from '@agentmat/core';
import type { GithubWorkflowInfo, GithubWorkflowRunInfo } from '@shared/apiTypes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CircleCheck,
  ExternalLink,
  Github,
  RefreshCw,
  Spinner,
  TriangleAlert,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminalStore';

const GH_INSTALL_URL = 'https://cli.github.com/';
const QUERY_META = { silentLoading: true } as const;

function runTone(
  run: GithubWorkflowRunInfo | null | undefined,
): { label: string; variant: 'success' | 'destructive' | 'warning' | 'outline' } {
  if (!run) return { label: 'Never run', variant: 'outline' };
  if (run.status !== 'completed') {
    if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') {
      return { label: 'Queued', variant: 'warning' };
    }
    return { label: 'Running', variant: 'warning' };
  }
  if (run.conclusion === 'success') return { label: 'Passing', variant: 'success' };
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
    return { label: 'Failed', variant: 'destructive' };
  }
  if (run.conclusion === 'cancelled') return { label: 'Cancelled', variant: 'outline' };
  if (run.conclusion === 'skipped') return { label: 'Skipped', variant: 'outline' };
  return { label: run.conclusion ?? 'Completed', variant: 'outline' };
}

function workflowFileName(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/');
  return parts[parts.length - 1] || path;
}

export function GitActionsCard({
  projectId,
  watched,
}: {
  projectId: string;
  watched: ProjectGithubAction[];
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);

  const statusQuery = useQuery({
    queryKey: queryKeys.pipelineStatus(projectId),
    queryFn: () => window.agentmat.pipelines.status(projectId),
    refetchInterval: 30_000,
    meta: QUERY_META,
  });

  const watchMutation = useMutation({
    mutationFn: (actions: ProjectGithubAction[]) =>
      window.agentmat.pipelines.setWatched(projectId, actions),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.pipelineStatus(projectId), status);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not update watched workflows.');
    },
  });

  const status = statusQuery.data;
  const effectiveWatched = watchMutation.isPending && watchMutation.variables
    ? watchMutation.variables
    : watched;
  const watchedIds = new Set(effectiveWatched.map((item) => item.workflowId));

  function handleInstallGh(): void {
    void window.agentmat.shell.openExternal(GH_INSTALL_URL);
  }

  function handleSignIn(): void {
    openSession({ title: 'GitHub login', initialInput: 'gh auth login' });
    toast.info('Press Enter in the terminal to sign in to GitHub.');
  }

  function toggleWatch(workflow: GithubWorkflowInfo, enabled: boolean): void {
    const next = enabled
      ? [
          ...effectiveWatched.filter((item) => item.workflowId !== workflow.id),
          { workflowId: workflow.id, path: workflow.path, name: workflow.name },
        ]
      : effectiveWatched.filter((item) => item.workflowId !== workflow.id);
    watchMutation.mutate(next);
  }

  return (
    <div className="glass space-y-3 rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Github className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">GitHub Actions</p>
            <p className="text-xs text-muted-foreground">
              Connect workflows to this repo to watch pipeline status. Failures go to Notifications.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={statusQuery.isFetching}
          onClick={() => void statusQuery.refetch()}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', statusQuery.isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {statusQuery.isPending && !status ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-3.5 w-3.5 animate-spin" />
          Reading workflows…
        </div>
      ) : status?.error ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          <p>{status.error}</p>
          {!status.cliAvailable ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleInstallGh}>
              Install GitHub CLI
            </Button>
          ) : !status.authenticated ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleSignIn}>
              Sign in with gh
            </Button>
          ) : null}
        </div>
      ) : !status || status.workflows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No GitHub Actions workflows in this repository yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {status.workflows.map((workflow) => (
            <WorkflowRow
              key={workflow.id}
              workflow={workflow}
              run={status.runsByWorkflowId[workflow.id]}
              watched={watchedIds.has(workflow.id)}
              pending={watchMutation.isPending}
              onToggle={(enabled) => toggleWatch(workflow, enabled)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowRow({
  workflow,
  run,
  watched,
  pending,
  onToggle,
}: {
  workflow: GithubWorkflowInfo;
  run: GithubWorkflowRunInfo | null | undefined;
  watched: boolean;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
}): React.JSX.Element {
  const tone = runTone(run);
  const running = run != null && run.status !== 'completed';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5',
        watched ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-background/30',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          tone.variant === 'success' && 'bg-success/15 text-success',
          tone.variant === 'destructive' && 'bg-destructive/15 text-destructive',
          tone.variant === 'warning' && 'bg-warning/15 text-warning',
          tone.variant === 'outline' && 'bg-foreground/[0.06] text-muted-foreground',
        )}
      >
        {running ? (
          <Spinner className="h-3.5 w-3.5 animate-spin" />
        ) : tone.variant === 'success' ? (
          <CircleCheck className="h-3.5 w-3.5" />
        ) : tone.variant === 'destructive' ? (
          <TriangleAlert className="h-3.5 w-3.5" />
        ) : (
          <Github className="h-3.5 w-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{workflow.name}</p>
          <Badge variant={tone.variant} className="shrink-0">
            {tone.label}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="font-mono">{workflowFileName(workflow.path)}</span>
          {run?.headBranch ? ` · ${run.headBranch}` : ''}
          {run?.updatedAt ? ` · ${timeAgo(run.updatedAt)}` : ''}
        </p>
      </div>
      {run?.htmlUrl ? (
        <SimpleTooltip label="Open this run on GitHub">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => void window.agentmat.shell.openExternal(run.htmlUrl)}
            aria-label="Open run on GitHub"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
      ) : null}
      <SimpleTooltip label={watched ? 'Stop watching this pipeline' : 'Watch this pipeline'}>
        <div className="shrink-0">
          <Switch
            checked={watched}
            disabled={pending}
            onCheckedChange={onToggle}
            aria-label={watched ? `Stop watching ${workflow.name}` : `Watch ${workflow.name}`}
          />
        </div>
      </SimpleTooltip>
    </div>
  );
}
