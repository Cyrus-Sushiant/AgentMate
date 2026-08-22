import type { AppNotification } from '@agentmat/core';
import type { GithubActionsActivity, GithubActionsHistoryItem } from '@shared/apiTypes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Check,
  ExternalLink,
  FolderKanban,
  Github,
  RefreshCw,
  Search,
  X,
} from '@/components/icons';
import { CopyRunErrorButton } from '@/components/pipelines/CopyRunErrorButton';
import {
  type RunOutcome,
  RunStatusIcon,
  runDuration,
  runTone,
} from '@/components/pipelines/runStatus';
import { StopRunButton } from '@/components/pipelines/StopRunButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';

const GH_INSTALL_URL = 'https://cli.github.com/';

type FilterKey = 'all' | 'running' | 'passed' | 'failed' | 'other';

const FILTERS: { key: FilterKey; label: string; matches: (outcome: RunOutcome) => boolean }[] = [
  { key: 'all', label: 'All', matches: () => true },
  {
    key: 'running',
    label: 'Running',
    matches: (outcome) => outcome === 'running' || outcome === 'queued',
  },
  { key: 'passed', label: 'Passed', matches: (outcome) => outcome === 'passed' },
  { key: 'failed', label: 'Failed', matches: (outcome) => outcome === 'failed' },
  {
    key: 'other',
    label: 'Cancelled',
    matches: (outcome) => outcome === 'cancelled' || outcome === 'other',
  },
];

function matchesSearch(item: GithubActionsHistoryItem, query: string): boolean {
  const haystack = [
    item.displayTitle,
    item.workflowName,
    item.repo,
    item.projectName,
    item.headBranch,
    `#${item.runNumber}`,
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** Whatever is standing between the user and a run list: no CLI, no login, no repos, no runs. */
function SetupHint({
  activity,
  onSignIn,
  onRetry,
  retrying,
}: {
  activity: GithubActionsActivity | undefined;
  onSignIn: () => void;
  onRetry: () => void;
  retrying: boolean;
}): React.JSX.Element {
  let body: React.ReactNode = 'No workflow runs yet.';
  // A network hiccup (TLS handshake, DNS, rate limit) is the one failure the user
  // can fix by simply asking again, so only that case gets a retry button.
  let failed = false;
  if (activity?.cliAvailable === false) {
    body = (
      <>
        Install the{' '}
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => void window.agentmat.shell.openExternal(GH_INSTALL_URL)}
        >
          GitHub CLI
        </button>{' '}
        to see your Actions history here.
      </>
    );
  } else if (activity?.authenticated === false) {
    body = (
      <>
        Run{' '}
        <button type="button" className="underline underline-offset-2" onClick={onSignIn}>
          gh auth login
        </button>{' '}
        to load runs from your repos.
      </>
    );
  } else if (activity?.error) {
    // The raw gh/API failure is long and unreadable in the middle of the page,
    // so it lives in a tooltip and the page just says the load did not work.
    body = (
      <SimpleTooltip label={activity.error} className="max-w-sm" wrapTrigger>
        <span className="cursor-help underline decoration-dotted underline-offset-4">
          Could not load runs from GitHub.
        </span>
      </SimpleTooltip>
    );
    failed = true;
  } else if ((activity?.repoCount ?? 0) === 0) {
    body = 'Add a GitHub remote on a project and its Actions runs show up here.';
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Github className="h-5 w-5" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {failed ? (
        <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
          <RefreshCw className={cn('h-3.5 w-3.5', retrying && 'animate-spin')} />
          {retrying ? 'Retrying...' : 'Try again'}
        </Button>
      ) : null}
    </div>
  );
}

function RunRow({
  item,
  unread,
  focused,
  rowRef,
  onOpen,
  onOpenProject,
}: {
  item: GithubActionsHistoryItem;
  unread: boolean;
  /** The run someone arrived here to see, e.g. from the desktop pet. */
  focused: boolean;
  rowRef: (node: HTMLLIElement | null) => void;
  onOpen: () => void;
  onOpenProject: () => void;
}): React.JSX.Element {
  const tone = runTone(item);
  const failed = tone.outcome === 'failed';
  const duration = runDuration(item);

  return (
    <li
      ref={rowRef}
      className={cn(
        'glass relative overflow-hidden rounded-xl transition-shadow',
        unread && 'ring-1 ring-destructive/35',
        focused && 'ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          tone.outcome === 'failed'
            ? 'bg-destructive'
            : tone.outcome === 'passed'
              ? 'bg-emerald-500'
              : tone.outcome === 'running' || tone.outcome === 'queued'
                ? 'bg-amber-500'
                : 'bg-border',
        )}
        aria-hidden
      />
      <div className="flex items-start gap-1 py-2 pl-2 pr-3">
        <button
          type="button"
          disabled={!item.htmlUrl}
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-foreground/[0.05] focus:outline-none focus-visible:bg-foreground/[0.06] disabled:cursor-default disabled:hover:bg-transparent"
        >
          <RunStatusIcon tone={tone} className="mt-0.5" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium leading-snug">
                {item.displayTitle || item.workflowName}
              </span>
              <Badge variant={tone.variant} className="h-5 px-1.5 text-[10px] font-normal">
                {tone.label}
              </Badge>
              {unread ? (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-normal">
                  New
                </Badge>
              ) : null}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <span className="truncate font-mono">{item.repo}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{item.workflowName}</span>
              {item.headBranch ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate">{item.headBranch}</span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span className="tabular-nums">#{item.runNumber}</span>
              {duration ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{duration}</span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span className="tabular-nums">{timeAgo(item.updatedAt)}</span>
            </span>
          </span>
          {item.htmlUrl ? (
            <ExternalLink className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-1 pt-1.5">
          {failed ? (
            <CopyRunErrorButton
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
          {item.projectId ? (
            <SimpleTooltip label={`Open ${item.projectName}`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Open ${item.projectName}`}
                onClick={onOpenProject}
              >
                <FolderKanban className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function PipelinesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const openSession = useTerminalStore((s) => s.openSession);
  usePageHeader('Pipelines', 'Every GitHub Actions run across your projects.');

  const [filter, setFilter] = useState<FilterKey>('all');
  const [repo, setRepo] = useState('');
  const [search, setSearch] = useState('');
  /** A run asked for by a deep link, waiting for the list to load. */
  const [pendingFocus, setPendingFocus] = useState<{ runId: number; repo: string } | null>(null);
  const [focusedRunId, setFocusedRunId] = useState<number | null>(null);
  const rowNodes = useRef(new Map<number, HTMLLIElement>());

  const bindRow = useCallback((runId: number) => {
    return (node: HTMLLIElement | null): void => {
      if (node) rowNodes.current.set(runId, node);
      else rowNodes.current.delete(runId);
    };
  }, []);

  const activityQuery = useQuery({
    queryKey: queryKeys.githubActionsActivity,
    queryFn: () => window.agentmat.pipelines.dashboardActivity(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const notificationsQuery = useQuery({
    queryKey: queryKeys.appNotifications,
    queryFn: () => window.agentmat.appNotifications.list(),
  });

  useEffect(() => {
    return window.agentmat.appNotifications.onChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.githubActionsActivity });
    });
  }, [queryClient]);

  // `/pipelines?run=123&repo=owner/name`, the route the desktop pet opens after
  // announcing a failure. Filters get cleared so the run cannot be hidden by
  // whatever was set last time, and the query string is dropped once it is read
  // so a later refresh does not jump around again. The list is refreshed first:
  // a run that failed seconds ago is not in a cached response yet, and without
  // that it would look like it had dropped off.
  useEffect(() => {
    const runId = Number(searchParams.get('run'));
    if (!Number.isInteger(runId) || runId <= 0) return;
    const wanted = { runId, repo: searchParams.get('repo') ?? '' };
    setFilter('all');
    setRepo('');
    setSearch('');
    setSearchParams({}, { replace: true });
    let live = true;
    void queryClient
      .refetchQueries({ queryKey: queryKeys.githubActionsActivity })
      .catch(() => undefined)
      .finally(() => {
        if (live) setPendingFocus(wanted);
      });
    return () => {
      live = false;
    };
  }, [queryClient, searchParams, setSearchParams]);

  const markRead = useMutation({
    mutationFn: (id: string) => window.agentmat.appNotifications.markRead(id),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.appNotifications, items);
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => window.agentmat.appNotifications.markAllRead(),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.appNotifications, items);
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
    },
  });

  const activity = activityQuery.data;
  const runs = useMemo(() => activity?.runs ?? [], [activity]);
  const notifications: AppNotification[] = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read).length;

  /** Failure notices the watcher raised, keyed by run URL so a row can show its unread state. */
  const unreadByUrl = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of notifications) {
      if (!item.read && item.htmlUrl) map.set(item.htmlUrl, item.id);
    }
    return map;
  }, [notifications]);

  const counts = useMemo(() => {
    const tally: Record<FilterKey, number> = {
      all: runs.length,
      running: 0,
      passed: 0,
      failed: 0,
      other: 0,
    };
    for (const run of runs) {
      const { outcome } = runTone(run);
      for (const entry of FILTERS) {
        if (entry.key !== 'all' && entry.matches(outcome)) tally[entry.key] += 1;
      }
    }
    return tally;
  }, [runs]);

  const repoOptions: ComboboxOption[] = useMemo(() => {
    const names = [...new Set(runs.map((run) => run.repo))].sort((a, b) => a.localeCompare(b));
    return names.map((name) => ({ value: name, label: name }));
  }, [runs]);

  const visible = useMemo(() => {
    const entry = FILTERS.find((item) => item.key === filter) ?? FILTERS[0];
    const query = search.trim();
    return runs.filter((run) => {
      if (!entry.matches(runTone(run).outcome)) return false;
      if (repo && run.repo !== repo) return false;
      if (query && !matchesSearch(run, query)) return false;
      return true;
    });
  }, [filter, repo, runs, search]);

  // The list is in by now, so scroll the requested run into view and ring it.
  // The frame wait lets the rows the filter reset just brought back mount.
  useEffect(() => {
    if (!pendingFocus) return;
    const match = runs.find(
      (run) =>
        run.id === pendingFocus.runId && (!pendingFocus.repo || run.repo === pendingFocus.repo),
    );
    setPendingFocus(null);
    if (!match) {
      // With no runs at all the page already explains itself, so stay quiet.
      if (runs.length > 0) toast.info('That run has dropped off the recent list.');
      return;
    }
    setFocusedRunId(match.id);
    const frame = requestAnimationFrame(() => {
      rowNodes.current.get(match.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingFocus, runs]);

  // The ring is a "here it is" pointer, not a state, so it fades on its own.
  useEffect(() => {
    if (focusedRunId === null) return;
    const timer = setTimeout(() => setFocusedRunId(null), 6000);
    return () => clearTimeout(timer);
  }, [focusedRunId]);

  const loading = activityQuery.isPending;
  const connected = activity?.ok === true && activity.cliAvailable && activity.authenticated;
  const ready = connected && runs.length > 0;
  const filtersDirty = filter !== 'all' || repo !== '' || search.trim() !== '';

  function handleSignIn(): void {
    openSession({ title: 'GitHub login', initialInput: 'gh auth login' });
    toast.info('Press Enter in the terminal to sign in to GitHub.');
  }

  function handleRefresh(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.githubActionsActivity });
  }

  function handleOpenRun(item: GithubActionsHistoryItem): void {
    const notificationId = item.htmlUrl ? unreadByUrl.get(item.htmlUrl) : undefined;
    if (notificationId) markRead.mutate(notificationId);
    if (item.htmlUrl) void window.agentmat.shell.openExternal(item.htmlUrl);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border p-1">
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                filter === entry.key
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
              )}
            >
              {entry.label}
              <span className="tabular-nums opacity-70">{counts[entry.key]}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search runs"
              className="h-9 w-52 pl-8"
            />
          </div>
          <Combobox
            options={repoOptions}
            value={repo}
            onChange={setRepo}
            placeholder="All repos"
            searchPlaceholder="Search repos…"
            emptyText="No repos found."
            className="w-56"
            clearable
          />
          {filtersDirty ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilter('all');
                setRepo('');
                setSearch('');
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
          {unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <Check className="h-3.5 w-3.5" /> Mark all read
            </Button>
          ) : null}
          <SimpleTooltip label="Refresh runs">
            <Button
              variant="ghost"
              size="icon"
              disabled={activityQuery.isFetching}
              aria-label="Refresh runs"
              onClick={handleRefresh}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', activityQuery.isFetching && 'animate-spin')}
              />
            </Button>
          </SimpleTooltip>
        </div>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="glass rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-80" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : !ready ? (
        <SetupHint
          activity={activity}
          onSignIn={handleSignIn}
          onRetry={handleRefresh}
          retrying={activityQuery.isFetching}
        />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No runs match these filters</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {runs.length} run{runs.length === 1 ? '' : 's'} loaded across {activity?.repoCount ?? 0}{' '}
            repo{activity?.repoCount === 1 ? '' : 's'}.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((item) => (
              <RunRow
                key={`${item.repo}-${item.id}`}
                item={item}
                unread={item.htmlUrl ? unreadByUrl.has(item.htmlUrl) : false}
                focused={focusedRunId === item.id}
                rowRef={bindRow(item.id)}
                onOpen={() => handleOpenRun(item)}
                onOpenProject={() => {
                  if (item.projectId) navigate(`/projects/${item.projectId}?tab=git`);
                }}
              />
            ))}
          </ul>
          <p className="pb-2 text-center text-xs text-muted-foreground">
            Showing {visible.length} of {runs.length} runs across {activity?.repoCount ?? 0} repo
            {activity?.repoCount === 1 ? '' : 's'}.
          </p>
        </>
      )}
    </div>
  );
}
