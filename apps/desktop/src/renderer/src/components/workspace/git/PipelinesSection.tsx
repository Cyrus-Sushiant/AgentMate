import type { Project } from '@agentmat/core';
import type { GithubActionsRunErrorInput } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Github, Spinner, Wand2 } from '@/components/icons';
import { RunStatusIcon, runTone } from '@/components/pipelines/runStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminalStore';
import { FixRunDialog } from './FixRunDialog';

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

  const repo = `${data.github.owner}/${data.github.repo}`;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-1">
      {rows.map(({ workflow, run, tone }) => {
        const failed = tone?.outcome === 'failed' && run;
        return (
          <div
            key={workflow.id}
            className={cn(
              'group/run mx-1 rounded-md transition-colors hover:bg-foreground/[0.05]',
              failed && 'bg-destructive/[0.04]',
            )}
          >
            <button
              type="button"
              onClick={() =>
                void window.agentmat.shell.openExternal(run?.htmlUrl ?? workflow.htmlUrl)
              }
              className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left"
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
            {failed ? (
              <FailedRunActions
                project={project}
                run={{
                  repo,
                  runId: run.id,
                  workflowName: workflow.name,
                  displayTitle: run.displayTitle,
                  runNumber: run.runNumber,
                  headBranch: run.headBranch,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Copy the failure, or hand it to an agent to fix. */
function FailedRunActions({
  project,
  run,
}: {
  project: Project;
  run: GithubActionsRunErrorInput;
}): React.JSX.Element {
  const [fixing, setFixing] = useState(false);
  const [copying, setCopying] = useState(false);

  async function copy(): Promise<void> {
    setCopying(true);
    try {
      const result = await window.agentmat.pipelines.runError(run);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      await navigator.clipboard.writeText(result.text);
      toast.success('Failure copied');
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex items-center gap-1 pb-1.5 pl-[2.625rem] pr-2">
      <button
        type="button"
        onClick={() => setFixing(true)}
        className="inline-flex h-6 items-center gap-1 rounded-md bg-primary/12 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
      >
        <Wand2 className="h-2.5 w-2.5" />
        Fix with AI
      </button>
      <button
        type="button"
        onClick={() => void copy()}
        disabled={copying}
        className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-60"
      >
        {copying ? (
          <Spinner className="h-2.5 w-2.5 animate-spin" />
        ) : (
          <Copy className="h-2.5 w-2.5" />
        )}
        Copy error
      </button>
      {fixing ? (
        <FixRunDialog project={project} run={run} open={fixing} onOpenChange={setFixing} />
      ) : null}
    </div>
  );
}
