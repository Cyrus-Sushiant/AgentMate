import type { Project } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Github } from '@/components/icons';
import { RunStatusIcon, runTone } from '@/components/pipelines/runStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminalStore';

const RANK: Record<string, number> = {
  failed: 0,
  running: 1,
  queued: 2,
  passed: 3,
  cancelled: 4,
  other: 5,
};

/** GitHub Actions for the project: each workflow's latest run, failures first. */
export function PipelinesSection({ project }: { project: Project }): React.JSX.Element {
  const navigate = useNavigate();
  const openSession = useTerminalStore((s) => s.openSession);
  const status = useQuery({
    queryKey: queryKeys.pipelineStatus(project.id),
    queryFn: () => window.agentmat.pipelines.status(project.id),
    refetchInterval: 30_000,
    meta: { silentLoading: true },
  });

  if (status.isPending) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-3.5 flex-1 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const data = status.data;
  const notice = (title: string, body: string, action?: { label: string; run: () => void }) => (
    <div className="flex flex-col items-center gap-1.5 px-5 py-5 text-center">
      <Github className="h-4 w-4 text-muted-foreground" />
      <p className="text-xs font-medium">{title}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="mt-1 text-[11px] font-medium text-primary hover:underline"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );

  if (!data || data.error) {
    return notice('Could not load pipelines', data?.error ?? 'Try again in a moment.', {
      label: 'Retry',
      run: () => void status.refetch(),
    });
  }
  if (!data.cliAvailable) {
    return notice('GitHub CLI not found', 'Install gh to see workflow runs here.', {
      label: 'Open Agent Tools',
      run: () => navigate('/tools'),
    });
  }
  if (!data.authenticated) {
    return notice('Sign in to GitHub', 'gh needs to be signed in to read workflow runs.', {
      label: 'Run gh auth login',
      run: () => openSession({ title: 'GitHub sign in', initialInput: 'gh auth login' }),
    });
  }
  if (!data.github) {
    return notice('No GitHub remote', 'This repository is not hosted on GitHub.');
  }
  if (data.workflows.length === 0) {
    return notice(
      'No workflows yet',
      `${data.github.owner}/${data.github.repo} has no GitHub Actions.`,
    );
  }

  const rows = data.workflows
    .map((workflow) => {
      const run = data.runsByWorkflowId[workflow.id] ?? null;
      const tone = run ? runTone(run) : null;
      return { workflow, run, tone };
    })
    .sort(
      (a, b) => (RANK[a.tone?.outcome ?? 'other'] ?? 9) - (RANK[b.tone?.outcome ?? 'other'] ?? 9),
    );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-1">
      {rows.map(({ workflow, run, tone }) => (
        <button
          key={workflow.id}
          type="button"
          onClick={() => void window.agentmat.shell.openExternal(run?.htmlUrl ?? workflow.htmlUrl)}
          className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05]"
        >
          {tone ? (
            <RunStatusIcon tone={tone} className="h-6 w-6 shrink-0" />
          ) : (
            <span className="h-6 w-6 shrink-0 rounded-md bg-foreground/[0.06]" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium">{workflow.name}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {run
                ? `${run.displayTitle} · ${run.headBranch} · ${timeAgo(run.updatedAt)}`
                : 'Never run'}
            </span>
          </span>
          {tone ? (
            <span
              className={cn(
                'shrink-0 text-[10px] font-medium',
                tone.outcome === 'failed'
                  ? 'text-destructive'
                  : tone.outcome === 'passed'
                    ? 'text-success'
                    : 'text-muted-foreground',
              )}
            >
              {tone.label}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
