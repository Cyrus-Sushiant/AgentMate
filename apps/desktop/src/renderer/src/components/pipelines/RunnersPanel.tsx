import type {
  GithubActionsHistoryItem,
  GithubRunner,
  GithubRunnerState,
  GithubRunnersResult,
  GithubRunnerWaitingJob,
} from '@shared/apiTypes';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CircleInfo,
  GitBranch,
  Key,
  RefreshCw,
  Server,
  TriangleAlert,
  Users,
  X,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { ipcErrorMessage } from '@/components/projects/environments/ipcError';
import { Button } from '@/components/ui/button';
import { SimpleTooltip, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLastGoodData } from '@/hooks/useLastGoodData';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

/** Where a click on a busy runner or a waiting job should take the user. */
export interface RunnerRunTarget {
  runId: number;
  repo: string;
  htmlUrl: string;
}

const COLLAPSED_KEY = 'agentmate:runners-panel-collapsed';
const DISMISSED_KEY = 'agentmate:runners-dismissed-orgs';

/** More than this and the grid gets a "Show all" toggle, so a big fleet does not push the runs off screen. */
const VISIBLE_TILES = 8;

/** Busy first since that is what people come to check, offline last since it is the least actionable. */
const STATE_ORDER: Record<GithubRunnerState, number> = { busy: 0, idle: 1, seen: 2, offline: 3 };

const STATE_LABEL: Record<GithubRunnerState, string> = {
  busy: 'Busy',
  idle: 'Idle',
  offline: 'Offline',
  seen: 'Live status unknown',
};

const DOT_CLASS: Record<GithubRunnerState, string> = {
  idle: 'bg-emerald-500 ring-2 ring-emerald-500/20',
  busy: 'bg-amber-500 ring-2 ring-amber-500/25 motion-safe:animate-pulse',
  offline: 'border-[1.5px] border-muted-foreground/60',
  seen: 'border-[1.5px] border-sky-500 bg-sky-500/15 dark:border-sky-400',
};

const GRANT_HINT =
  'Opens a terminal with gh auth refresh -s admin:org. You also need to be an admin of the org.';

const CHECK_HINT = 'Once you have approved the new scope, ask GitHub for the runner list again.';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {
    // Blocked storage only means the panel opens expanded next time.
  }
}

function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissed(orgs: string[]): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(orgs));
  } catch {
    // The hint stays hidden for this session at least.
  }
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function sortRunners(runners: GithubRunner[]): GithubRunner[] {
  return [...runners].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      a.name.localeCompare(b.name) ||
      a.scope.name.localeCompare(b.scope.name),
  );
}

/** "7 min", "1 h 5 min". Empty when the timestamp makes no sense. */
function waitedFor(queuedAt: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(queuedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

function oldestFirst(a: GithubRunnerWaitingJob, b: GithubRunnerWaitingJob): number {
  return Date.parse(a.queuedAt) - Date.parse(b.queuedAt);
}

/**
 * Waiting jobs that ask for the same labels and share the same certainty, so three matrix legs
 * stuck on one GPU runner read as one alert rather than three.
 */
function groupWaiting(jobs: GithubRunnerWaitingJob[]): GithubRunnerWaitingJob[][] {
  const groups = new Map<string, GithubRunnerWaitingJob[]>();
  for (const job of [...jobs].sort(oldestFirst)) {
    const key = `${job.liveStatusKnown}|${job.labels.join('\n')}`;
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.values()];
}

function platformOf(runner: GithubRunner): string {
  return [runner.os, runner.arch].filter(Boolean).join(' · ');
}

/** The runs the main process should read jobs from. Only the unfinished ones can change a runner's state. */
function activeRunsKey(runs: GithubActionsHistoryItem[]): string {
  return runs
    .filter((run) => run.status !== 'completed')
    .map((run) => `${run.repo}#${run.id}`)
    .sort()
    .join(',');
}

function StatusDot({ state }: { state: GithubRunnerState }): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={STATE_LABEL[state]}
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', DOT_CLASS[state])}
    />
  );
}

/** The runner's name, with a tooltip for the full name only when the tile cut it short. */
function RunnerName({ name }: { name: string }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      open={open}
      delayDuration={300}
      onOpenChange={(next) => {
        const node = ref.current;
        setOpen(next && node !== null && node.scrollWidth > node.clientWidth);
      }}
    >
      <TooltipTrigger asChild>
        <span ref={ref} className="min-w-0 truncate font-mono text-xs font-medium">
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent className="font-mono">{name}</TooltipContent>
    </Tooltip>
  );
}

function SummaryChip({
  count,
  label,
  dotClassName,
  className,
}: {
  count: number;
  label: string;
  dotClassName: string;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-foreground/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground',
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClassName)} />
      <span className="tabular-nums">{`${count} ${label}`}</span>
    </span>
  );
}

/** Labels as small chips, with commas a screen reader can hear but nobody has to see. */
function LabelChips({ labels }: { labels: string[] }): React.JSX.Element {
  return (
    <>
      {labels.map((label, index) => (
        <span key={label}>
          {index > 0 ? (
            <>
              <span className="sr-only">,</span>{' '}
            </>
          ) : null}
          <span className="rounded bg-foreground/[0.07] px-1 py-px font-mono text-[10.5px] text-foreground">
            {label}
          </span>
        </span>
      ))}
    </>
  );
}

function WaitingAlert({
  jobs,
  onFocusRun,
}: {
  /** Oldest first, all asking for the same labels. */
  jobs: GithubRunnerWaitingJob[];
  onFocusRun: (run: RunnerRunTarget) => void;
}): React.JSX.Element {
  const [oldest] = jobs;
  const count = jobs.length;
  const known = oldest.liveStatusKnown;
  const waited = waitedFor(oldest.queuedAt);
  const lead = known
    ? `${count} ${plural(count, 'job is', 'jobs are')} waiting`
    : `${count} ${plural(count, 'job has', 'jobs have')} been waiting${waited ? ` ${waited}` : ''}`;

  return (
    <button
      type="button"
      onClick={() =>
        onFocusRun({ runId: oldest.runId, repo: oldest.repo, htmlUrl: oldest.htmlUrl })
      }
      className="group flex w-full cursor-pointer items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/[0.08] px-3 py-2 text-left text-xs leading-relaxed text-foreground transition-colors hover:bg-warning/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/60"
    >
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{lead}</span> for a{' '}
        {oldest.labels.length > 0 ? (
          <>
            runner labeled <LabelChips labels={oldest.labels} />
          </>
        ) : (
          'self-hosted runner'
        )}
        .{' '}
        <span className="text-muted-foreground">
          {known ? 'No online runner matches.' : 'The runner may be offline.'}
        </span>
      </span>
      <span className="mt-px flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        {plural(count, 'Show job', 'Show oldest')}
        <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}

function StatusLine({
  runner,
  onFocusRun,
}: {
  runner: GithubRunner;
  onFocusRun: (run: RunnerRunTarget) => void;
}): React.JSX.Element {
  const job = runner.currentJob;
  if (runner.state === 'busy' && job) {
    const text = `${job.workflowName} · ${job.jobName}`;
    return (
      <SimpleTooltip label={`${text}\n${job.repo}`} className="whitespace-pre-line font-normal">
        <button
          type="button"
          onClick={() => onFocusRun({ runId: job.runId, repo: job.repo, htmlUrl: job.htmlUrl })}
          className="-mx-1.5 flex min-w-0 max-w-[calc(100%+0.75rem)] cursor-pointer items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-300"
        >
          <span className="truncate">{text}</span>
          <ArrowRight className="h-2.5 w-2.5 shrink-0 opacity-70" />
        </button>
      </SimpleTooltip>
    );
  }
  if (runner.state === 'busy') {
    return <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Busy</span>;
  }
  if (runner.state === 'idle') {
    return (
      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Idle</span>
    );
  }
  if (runner.state === 'offline') {
    return <span className="text-[11px] text-muted-foreground">Offline</span>;
  }
  const why =
    runner.scope.kind === 'org'
      ? `Live status needs org admin access to ${runner.scope.name}.`
      : 'GitHub only says when this runner last ran a job.';
  return (
    <SimpleTooltip label={why} className="max-w-xs">
      {/* Focusable so keyboard users can open the tooltip too. */}
      <span
        tabIndex={0}
        className="cursor-help self-start rounded-sm text-[11px] text-muted-foreground underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {runner.lastSeenAt ? `Last job ${timeAgo(runner.lastSeenAt)}` : 'Ran a job recently'}
      </span>
    </SimpleTooltip>
  );
}

function RunnerTile({
  runner,
  onFocusRun,
}: {
  runner: GithubRunner;
  onFocusRun: (run: RunnerRunTarget) => void;
}): React.JSX.Element {
  const platform = platformOf(runner);
  const ScopeIcon = runner.scope.kind === 'org' ? Users : GitBranch;
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-colors',
        runner.state === 'busy'
          ? 'border-amber-500/35 bg-amber-500/[0.06]'
          : 'border-border/70 bg-foreground/[0.02]',
        runner.state === 'offline' && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot state={runner.state} />
        <RunnerName name={runner.name} />
        {platform ? (
          <span className="ml-auto shrink-0 pl-1 text-[11px] text-muted-foreground">
            {platform}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <ScopeIcon className="h-2.5 w-2.5 shrink-0 opacity-70" />
        <span className="truncate font-mono">{runner.scope.name}</span>
      </div>
      <StatusLine runner={runner} onFocusRun={onFocusRun} />
      {runner.customLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {runner.customLabels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="h-[18px] px-1.5 font-mono text-[10px] font-normal text-muted-foreground"
            >
              {label}
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function PanelTitle(): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <Server className="h-3.5 w-3.5" />
      </span>
      <h2 className="text-sm font-semibold">Self-hosted runners</h2>
    </div>
  );
}

/**
 * The self-hosted runners behind the listed runs: who is busy with what, who is idle or offline,
 * and the jobs stuck waiting for a runner that is not there. Renders nothing for the many people
 * who only use GitHub-hosted runners.
 */
export function RunnersPanel({
  runs,
  refreshCount = 0,
  onFocusRun,
  onGrantAccess,
}: {
  /** The activity list, newest first. */
  runs: GithubActionsHistoryItem[];
  /**
   * Goes up each time the user refreshes the page. The panel then asks once with `fresh`, so an
   * org GitHub refused a minute ago gets asked again instead of waiting out the main process.
   */
  refreshCount?: number;
  onFocusRun: (run: RunnerRunTarget) => void;
  onGrantAccess: (org: string) => void;
}): React.JSX.Element | null {
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showAll, setShowAll] = useState(false);
  /** Orgs the user just went to grant access for, whose button now offers to check again. */
  const [granted, setGranted] = useState<string[]>([]);
  /** Read and cleared by the next lookup, so only that one call skips the refusal memory. */
  const askFresh = useRef(false);

  // Keyed on the unfinished runs, so a run starting or ending asks again straight away. The
  // previous answer stays on screen meanwhile instead of the panel dropping back to a skeleton.
  const activeKey = useMemo(() => activeRunsKey(runs), [runs]);
  const query = useQuery({
    queryKey: [...queryKeys.githubRunners, activeKey],
    queryFn: async (): Promise<GithubRunnersResult> => {
      const fresh = askFresh.current;
      askFresh.current = false;
      try {
        return await window.agentmat.pipelines.runners({
          runs: runs.map((run) => ({
            repo: run.repo,
            runId: run.id,
            workflowName: run.workflowName,
            completed: run.status === 'completed',
          })),
          ...(fresh ? { fresh: true } : {}),
        });
      } catch (error) {
        // Turned into a failed answer so it goes through the same "is anyone looking" check.
        return { ok: false, error: ipcErrorMessage(error, 'Could not look up the runners.') };
      }
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Set further down from what is on screen. failureOf runs inside the hook, before those
  // values exist for this render, so it reads the previous render's answer through this ref.
  const hasContent = useRef(false);
  const lastGood = useLastGoodData<GithubRunnersResult>({
    storageKey: 'github-runners',
    query,
    failureOf: (result) => {
      if (result?.ok) return null;
      // With nothing on screen the panel is invisible, so a toast about it would come out of
      // nowhere. The failed answer simply takes the empty one's place.
      if (!hasContent.current) return null;
      return result?.error || 'GitHub did not return the runner list.';
    },
    title: 'Could not refresh runners',
  });
  const { refresh } = lastGood;

  // Skips the first render: only a change means the user asked for a refresh.
  const seenRefreshCount = useRef(refreshCount);
  useEffect(() => {
    if (refreshCount === seenRefreshCount.current) return;
    seenRefreshCount.current = refreshCount;
    askFresh.current = true;
    refresh();
  }, [refreshCount, refresh]);

  const result = lastGood.data?.ok ? lastGood.data : null;
  const runners = useMemo(() => sortRunners(result?.runners ?? []), [result]);
  const waitingGroups = useMemo(() => groupWaiting(result?.waiting ?? []), [result]);
  const hiddenOrgs = (result?.hiddenOrgs ?? []).filter((org) => !dismissed.includes(org));
  const showing = runners.length > 0 || waitingGroups.length > 0 || hiddenOrgs.length > 0;
  hasContent.current = showing;

  function grantAccess(org: string): void {
    onGrantAccess(org);
    setGranted((current) => [...new Set([...current, org])]);
  }

  /** Once the new scope is approved, GitHub should list the org's runners straight away. */
  function checkAgain(): void {
    askFresh.current = true;
    refresh();
  }

  function toggleCollapsed(): void {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  }

  function dismissOrg(org: string): void {
    const next = [...new Set([...dismissed, org])];
    setDismissed(next);
    writeDismissed(next);
  }

  // No placeholder on the very first lookup: most people have no self-hosted runners, and a
  // skeleton that then vanishes would shove the run list down and back up. Later visits start
  // from the answer useLastGoodData saved, so the panel is there straight away.
  if (!result || !showing) return null;
  const waitingCount = result.waiting.length;

  const counts = { idle: 0, busy: 0, offline: 0, seen: 0 };
  for (const runner of runners) counts[runner.state] += 1;
  const overflow = runners.length > VISIBLE_TILES;
  const shown = overflow && !showAll ? runners.slice(0, VISIBLE_TILES) : runners;

  return (
    <section aria-label="Self-hosted runners" className="glass rounded-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <PanelTitle />
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {/* Zero counts are left out: "0 busy, 0 offline" next to one seen runner is just noise. */}
          {counts.idle > 0 ? (
            <SummaryChip count={counts.idle} label="idle" dotClassName="bg-emerald-500" />
          ) : null}
          {counts.busy > 0 ? (
            <SummaryChip count={counts.busy} label="busy" dotClassName="bg-amber-500" />
          ) : null}
          {counts.offline > 0 ? (
            <SummaryChip
              count={counts.offline}
              label="offline"
              dotClassName="border border-muted-foreground/70"
            />
          ) : null}
          {counts.seen > 0 ? (
            <SummaryChip
              count={counts.seen}
              label="seen"
              dotClassName="border border-sky-500 dark:border-sky-400"
            />
          ) : null}
          {waitingCount > 0 ? (
            <SummaryChip
              count={waitingCount}
              label="waiting"
              dotClassName="bg-warning"
              className="border-warning/35 bg-warning/[0.08] text-foreground"
            />
          ) : null}
        </div>
        <SimpleTooltip label={collapsed ? 'Show runners' : 'Hide runners'}>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 shrink-0"
            aria-label={collapsed ? 'Show runners' : 'Hide runners'}
            aria-expanded={!collapsed}
            aria-controls={collapsed ? undefined : bodyId}
            onClick={toggleCollapsed}
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                collapsed ? 'rotate-0' : 'rotate-180',
              )}
            />
          </Button>
        </SimpleTooltip>
      </div>

      {collapsed ? null : (
        <div id={bodyId} className="space-y-2.5 px-4 pb-4">
          {waitingGroups.map((jobs) => (
            <WaitingAlert
              key={`${jobs[0].liveStatusKnown}|${jobs[0].labels.join(',')}`}
              jobs={jobs}
              onFocusRun={onFocusRun}
            />
          ))}

          {shown.length > 0 ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
              {shown.map((runner) => (
                <RunnerTile
                  key={`${runner.scope.name}/${runner.name}`}
                  runner={runner}
                  onFocusRun={onFocusRun}
                />
              ))}
            </ul>
          ) : null}

          {overflow ? (
            <div className="flex justify-center">
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showAll ? 'Show fewer' : `Show all ${runners.length}`}
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform',
                    showAll ? 'rotate-180' : 'rotate-0',
                  )}
                />
              </button>
            </div>
          ) : null}

          {hiddenOrgs.map((org) => (
            <div
              key={org}
              className="flex items-center gap-2.5 rounded-lg border border-dashed border-border/80 py-1.5 pl-3 pr-1.5 text-[11px] text-muted-foreground"
            >
              <CircleInfo className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {`Live status for ${org} runners needs org admin access.`}
              </span>
              {granted.includes(org) ? (
                <SimpleTooltip label={CHECK_HINT} className="max-w-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3"
                    onClick={checkAgain}
                  >
                    <RefreshCw className={cn('h-3 w-3', query.isFetching && 'animate-spin')} />
                    Check again
                  </Button>
                </SimpleTooltip>
              ) : (
                <SimpleTooltip label={GRANT_HINT} className="max-w-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3"
                    onClick={() => grantAccess(org)}
                  >
                    <Key className="h-3 w-3" />
                    Grant access
                  </Button>
                </SimpleTooltip>
              )}
              <SimpleTooltip label="Hide this hint">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 [&_svg]:size-3"
                  aria-label={`Dismiss the ${org} hint`}
                  onClick={() => dismissOrg(org)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </SimpleTooltip>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
