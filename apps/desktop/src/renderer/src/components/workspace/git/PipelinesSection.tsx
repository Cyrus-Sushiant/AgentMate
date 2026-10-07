import type { Project } from '@agentmat/core';
import type { GithubActionsRunErrorInput, ProjectPipelineStatus } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Spinner, Wand2 } from '@/components/icons';
import { Chip } from '@/components/pageKit';
import { RunStatusIcon, type RunTone, runTone } from '@/components/pipelines/runStatus';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminalStore';
import { FixRunDialog } from './FixRunDialog';
import { PanelNotice } from './PanelNotice';

const RANK: Record<string, number> = {
  failed: 0,
  running: 1,
  queued: 2,
  passed: 3,
  cancelled: 4,
  other: 5,
};

/** A run's outcome as a small tinted chip, live runs with a pulsing dot. */
export function RunChip({ tone }: { tone: RunTone }): React.JSX.Element {
  const live = tone.outcome === 'running' || tone.outcome === 'queued';
  const chipTone =
    tone.outcome === 'failed'
      ? 'destructive'
      : tone.warned || live
        ? 'warning'
        : tone.outcome === 'passed'
          ? 'success'
          : 'neutral';
  return (
    <Chip
      tone={chipTone}
      dot={live}
      pulse={tone.outcome === 'running'}
      className="h-[18px] px-1.5 text-[10px]"
    >
      {tone.label}
    </Chip>
  );
}

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

  // A refresh that fails (offline, rate limited) must not replace rows the user is working with.
  // Swapping them for the error notice unmounts every row, and with it an open Fix with AI dialog.
  const lastGood = useRef<ProjectPipelineStatus | null>(null);
  if (status.data && !status.data.error) lastGood.current = status.data;

  if (status.isPending) {
    return (
      <div className="space-y-1 px-2 py-1.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" style={{ width: `${96 - i * 10}%` }} />
        ))}
      </div>
    );
  }

  const data = status.data?.error || !status.data ? (lastGood.current ?? status.data) : status.data;
  const notice = (
    title: string,
    body: React.ReactNode,
    action?: { label: string; run: () => void },
  ) => <PanelNotice title={title} body={body} action={action} />;

  if (!data || data.error) {
    return notice(
      'Could not load pipelines',
      data?.error ? (
        <SimpleTooltip label={data.error} className="max-w-sm" wrapTrigger>
          <span className="cursor-help underline decoration-dotted underline-offset-4">
            Could not connect to GitHub.
          </span>
        </SimpleTooltip>
      ) : (
        'Try again in a moment.'
      ),
      {
        label: 'Retry',
        run: () => void status.refetch(),
      },
    );
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
    <div className="min-h-0 flex-1 space-y-px overflow-y-auto py-1">
      {rows.map(({ workflow, run, tone }) => {
        const failed = tone?.outcome === 'failed' && run;
        return (
          <div
            key={workflow.id}
            className={cn(
              'group/run mx-1.5 rounded-lg transition-colors',
              failed
                ? 'bg-destructive/[0.05] ring-1 ring-inset ring-destructive/15'
                : 'hover:bg-foreground/[0.06]',
            )}
          >
            <button
              type="button"
              onClick={() =>
                void window.agentmat.shell.openExternal(run?.htmlUrl ?? workflow.htmlUrl)
              }
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {tone ? (
                <RunStatusIcon tone={tone} className="h-6 w-6 shrink-0 rounded-md" />
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
              {tone ? <RunChip tone={tone} /> : null}
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

/** Copy the failure, or hand it to an agent to fix. Also used by the Pull request tab's checks. */
export function FailedRunActions({
  project,
  run,
  className,
}: {
  project: Project;
  run: GithubActionsRunErrorInput;
  className?: string;
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
    <div className={cn('flex items-center gap-1 pb-1.5 pl-[2.625rem] pr-2', className)}>
      <Button type="button" variant="tint" size="xs" onClick={() => setFixing(true)}>
        <Wand2 />
        Fix with AI
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => void copy()}
        disabled={copying}
        className="text-muted-foreground"
      >
        {copying ? <Spinner className="animate-spin" /> : <Copy />}
        Copy error
      </Button>
      {fixing ? (
        <FixRunDialog project={project} run={run} open={fixing} onOpenChange={setFixing} />
      ) : null}
    </div>
  );
}
