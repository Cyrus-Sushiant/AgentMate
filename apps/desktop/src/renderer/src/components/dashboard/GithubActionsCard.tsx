import type { GithubActionsHistoryItem } from '@shared/apiTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CircleCheck,
  ExternalLink,
  Github,
  History,
  Play,
  RefreshCw,
  Spinner,
  StopCircle,
  TriangleAlert,
  X,
} from '@/components/icons';
import { SparklineChart } from '@/components/dashboard/SparklineChart';
import { CopyRunErrorButton } from '@/components/pipelines/CopyRunErrorButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OverflowScroll } from '@/components/ui/overflow-scroll';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useChartColors } from '@/lib/chartColors';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { useTerminalStore } from '@/stores/terminalStore';

const GH_INSTALL_URL = 'https://cli.github.com/';
const QUERY_META = { silentLoading: true } as const;

function formatCount(value: number): string {
  return value.toLocaleString();
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function runTone(
  item: GithubActionsHistoryItem,
): { label: string; variant: 'success' | 'destructive' | 'warning' | 'outline' } {
  if (item.status !== 'completed') {
    if (item.status === 'queued' || item.status === 'waiting' || item.status === 'pending') {
      return { label: 'Queued', variant: 'warning' };
    }
    return { label: 'Running', variant: 'warning' };
  }
  if (item.conclusion === 'success') return { label: 'Passed', variant: 'success' };
  if (item.conclusion === 'failure' || item.conclusion === 'timed_out') {
    return { label: 'Failed', variant: 'destructive' };
  }
  if (item.conclusion === 'cancelled') return { label: 'Cancelled', variant: 'outline' };
  if (item.conclusion === 'skipped') return { label: 'Skipped', variant: 'outline' };
  return { label: item.conclusion ?? item.status, variant: 'outline' };
}

function GhSetupHint({
  cliAvailable,
  authenticated,
  repoCount,
  onInstall,
  onSignIn,
}: {
  cliAvailable: boolean;
  authenticated: boolean;
  repoCount: number;
  onInstall: () => void;
  onSignIn: () => void;
}): React.JSX.Element {
  if (!cliAvailable) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Install the{' '}
        <button type="button" className="underline underline-offset-2" onClick={onInstall}>
          GitHub CLI
        </button>{' '}
        to chart Actions.
      </p>
    );
  }
  if (!authenticated) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Run{' '}
        <button type="button" className="underline underline-offset-2" onClick={onSignIn}>
          gh auth login
        </button>{' '}
        to chart Actions across your repos.
      </p>
    );
  }
  if (repoCount === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Add a GitHub remote on a project to start charting Actions.
      </p>
    );
  }
  return (
    <p className="text-center text-sm text-muted-foreground">No workflow runs yet.</p>
  );
}

function StopRunButton({ item }: { item: GithubActionsHistoryItem }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function stopRun(): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Stop ${item.workflowName}?`,
      description: `Run #${item.runNumber} on ${item.repo} will be cancelled. Jobs already finished stay as they are.`,
      confirmLabel: 'Stop run',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const result = await window.agentmat.pipelines.cancelRun({ repo: item.repo, runId: item.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Asked GitHub to stop that run.');
      // GitHub takes a moment to flip the run to cancelled, so give it one beat first.
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.githubActionsActivity });
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not stop that run.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SimpleTooltip label="Stop this run">
      <Button
        variant="ghost"
        size="sm"
        className="mt-1.5 h-8 shrink-0 gap-1 px-2 text-xs hover:text-destructive"
        disabled={busy}
        aria-label="Stop run"
        onClick={() => void stopRun()}
      >
        {busy ? (
          <Spinner className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <StopCircle className="h-3.5 w-3.5" />
        )}
        Stop
      </Button>
    </SimpleTooltip>
  );
}

function HistoryRow({ item }: { item: GithubActionsHistoryItem }): React.JSX.Element {
  const tone = runTone(item);
  const failed = tone.variant === 'destructive';
  const passed = tone.variant === 'success';
  const running = tone.variant === 'warning';

  return (
    <div className="flex items-start gap-1 px-1 py-1">
      <button
        type="button"
        disabled={!item.htmlUrl}
        onClick={() => {
          if (item.htmlUrl) void window.agentmat.shell.openExternal(item.htmlUrl);
        }}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-foreground/[0.05] focus:outline-none focus-visible:bg-foreground/[0.06] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            failed
              ? 'bg-destructive/10 text-destructive'
              : passed
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : running
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-foreground/[0.06] text-muted-foreground',
          )}
        >
          {failed ? (
            <TriangleAlert className="h-3.5 w-3.5" />
          ) : running ? (
            <Play className="h-3.5 w-3.5" />
          ) : (
            <CircleCheck className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="line-clamp-2 text-sm font-medium leading-snug">
              {item.displayTitle || item.workflowName}
            </span>
            <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {timeAgo(item.updatedAt)}
            </span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="truncate font-mono text-[11px] text-muted-foreground">{item.repo}</span>
            <Badge variant={tone.variant} className="h-5 px-1.5 text-[10px] font-normal">
              {tone.label}
            </Badge>
            {item.headBranch ? (
              <span className="text-[11px] text-muted-foreground">{item.headBranch}</span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">{item.workflowName}</span>
          </span>
        </span>
        {item.htmlUrl ? (
          <ExternalLink className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        ) : null}
      </button>
      {failed ? (
        <CopyRunErrorButton
          className="mt-1.5"
          input={{
            repo: item.repo,
            runId: item.id,
            workflowName: item.workflowName,
            displayTitle: item.displayTitle,
            runNumber: item.runNumber,
            headBranch: item.headBranch,
          }}
        />
      ) : null}
      {item.status !== 'completed' ? <StopRunButton item={item} /> : null}
    </div>
  );
}

export function GithubActionsCard({
  className,
  dragHandle,
  onRemove,
  chartHeight,
}: {
  className?: string;
  dragHandle?: ReactNode;
  onRemove?: () => void;
  chartHeight: number;
}): React.JSX.Element {
  const colors = useChartColors();
  const queryClient = useQueryClient();
  const openSession = useTerminalStore((s) => s.openSession);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activityQuery = useQuery({
    queryKey: queryKeys.githubActionsActivity,
    queryFn: () => window.agentmat.pipelines.dashboardActivity(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    meta: QUERY_META,
  });

  const activity = activityQuery.data;
  const days = activity?.days ?? [];
  const runs = activity?.runs ?? [];
  const loading = activityQuery.isPending;
  const refreshing = activityQuery.isFetching;
  const connected = activity?.ok === true && activity.cliAvailable && activity.authenticated;
  const ready = connected && activity.repoCount > 0;

  const timestamps = useMemo(
    () => days.map((day) => parseLocalDate(day.date).getTime()),
    [days],
  );

  const series = useMemo(
    () => [
      {
        key: 'passed',
        label: 'Passed',
        color: colors.green,
        values: days.map((day) => day.passed),
      },
      {
        key: 'failed',
        label: 'Failed',
        color: colors.categorical[7],
        values: days.map((day) => day.failed),
      },
    ],
    [colors.categorical, colors.green, days],
  );

  function handleInstallGh(): void {
    void window.agentmat.shell.openExternal(GH_INSTALL_URL);
  }

  function handleSignIn(): void {
    openSession({ title: 'GitHub login', initialInput: 'gh auth login' });
    toast.info('Press Enter in the terminal to sign in to GitHub.');
  }

  const setupHint = (
    <GhSetupHint
      cliAvailable={activity?.cliAvailable !== false}
      authenticated={activity?.authenticated === true}
      repoCount={activity?.repoCount ?? 0}
      onInstall={handleInstallGh}
      onSignIn={handleSignIn}
    />
  );

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <Github className="h-3.5 w-3.5 shrink-0" /> GitHub Actions
          </CardTitle>
          <div className="flex items-center gap-1">
            <SimpleTooltip label="Actions history">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHistoryOpen(true)}
                aria-label="Actions history"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip label="Refresh GitHub Actions">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: queryKeys.githubActionsActivity });
                }}
                disabled={refreshing}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </Button>
            </SimpleTooltip>
            {dragHandle}
            {onRemove && (
              <SimpleTooltip label="Remove from dashboard">
                <Button variant="ghost" size="icon" onClick={onRemove}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </SimpleTooltip>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            {loading ? (
              <>
                <Skeleton className="h-8 w-16 self-center" />
                <Skeleton className="h-3 w-28 self-center" />
              </>
            ) : connected && activity ? (
              <>
                <span className="text-2xl font-semibold tabular-nums">
                  {formatCount(activity.weekPassed)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  passed this week
                  {activity.weekFailed > 0 ? ` · ${formatCount(activity.weekFailed)} failed` : ''}
                  {activity.runningCount > 0
                    ? ` · ${formatCount(activity.runningCount)} running`
                    : ''}
                </span>
              </>
            ) : (
              <span className="truncate text-sm text-muted-foreground">Not connected</span>
            )}
          </div>
          <div className="mb-2 flex h-6 items-center justify-between gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap text-xs text-muted-foreground">
            {ready && activity ? (
              <>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colors.green }}
                    />
                    Passed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colors.categorical[7] }}
                    />
                    Failed
                  </span>
                </span>
                <span className="shrink-0">
                  {formatCount(activity.repoCount)} repo{activity.repoCount === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <span className="h-6" />
            )}
          </div>
          {loading ? (
            <Skeleton className="w-full" style={{ height: chartHeight }} />
          ) : ready ? (
            <SparklineChart
              height={chartHeight}
              timestamps={timestamps}
              domainMin={0}
              formatValue={formatCount}
              formatTime={(timestamp) =>
                new Date(timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              }
              series={series}
            />
          ) : (
            <div className="flex items-center justify-center px-2" style={{ height: chartHeight }}>
              {setupHint}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (open) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.githubActionsActivity });
          }
        }}
      >
        <DialogContent
          className="max-w-lg gap-0 overflow-hidden p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="px-6 pb-3 pt-6">
            <DialogTitle>Actions history</DialogTitle>
            <DialogDescription>
              Recent workflow runs across your GitHub projects.
            </DialogDescription>
          </DialogHeader>
          <OverflowScroll className="max-h-[min(24rem,50vh)] px-3">
            {activityQuery.isPending ? (
              <div className="space-y-1 py-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !ready ? (
              <div className="px-3 py-8">{setupHint}</div>
            ) : runs.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No workflow runs yet.
              </p>
            ) : (
              <div className="divide-y divide-border/60 py-1">
                {runs.map((item) => (
                  <HistoryRow key={`${item.repo}-${item.id}`} item={item} />
                ))}
              </div>
            )}
          </OverflowScroll>
          <DialogFooter className="border-t border-border px-6 py-3 sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
