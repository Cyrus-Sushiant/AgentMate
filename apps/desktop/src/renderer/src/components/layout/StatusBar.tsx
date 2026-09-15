import type { AgentStatus, Project } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CliLogo } from '@/components/cliLogos';
import { Cpu, MemoryStick, Wifi } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { AGENT_STATUS_LABEL, AgentStatusDot } from '@/components/workspace/AgentStatusDot';
import { useSystemStatsHistory } from '@/hooks/useSystemStatsHistory';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useAgentStatusStore } from '@/stores/agentStatusStore';
import { terminalTabLabel, useWorkspaceStore } from '@/stores/workspaceStore';

/** Sampling shells out to the OS, so the status bar asks less often than the dashboard. */
const SAMPLE_INTERVAL_MS = 4000;

interface AgentTab {
  id: string;
  projectId: string;
  title: string;
  cliId?: string;
}

const ATTENTION_ORDER: AgentStatus[] = ['needs-input', 'working', 'done'];

function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 10 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`;
}

function Segment({
  children,
  tooltip,
  onClick,
  className,
}: {
  children: React.ReactNode;
  tooltip: React.ReactNode;
  onClick?: () => void;
  className?: string;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={tooltip} side="top" delayDuration={250}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex h-full items-center gap-1.5 rounded px-2 transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          !onClick && 'cursor-default',
          className,
        )}
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}

/** A thin meter under a number, filled to `percent`. */
function Meter({ percent }: { percent: number }): React.JSX.Element {
  const tone = percent >= 90 ? 'bg-destructive' : percent >= 70 ? 'bg-warning' : 'bg-primary';
  return (
    <span className="relative h-1 w-8 overflow-hidden rounded-full bg-foreground/10">
      <span
        className={cn(
          'absolute inset-y-0 left-0 rounded-full transition-[width] duration-500',
          tone,
        )}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </span>
  );
}

function AgentSegments(): React.JSX.Element {
  const navigate = useNavigate();
  // The selector returns a string so an unrelated store update does not re-render the bar; a
  // fresh array of fresh objects would never compare equal and would loop.
  const signature = useWorkspaceStore((s) =>
    JSON.stringify(
      Object.entries(s.workspaces).flatMap(([projectId, ws]) =>
        Object.values(ws.tabs).flatMap((tab) =>
          tab.kind === 'terminal' && tab.cliId
            ? [[tab.id, projectId, terminalTabLabel(tab), tab.cliId]]
            : [],
        ),
      ),
    ),
  );
  const tabs = useMemo<AgentTab[]>(
    () =>
      (JSON.parse(signature) as string[][]).map(([id, projectId, title, cliId]) => ({
        id,
        projectId,
        title,
        cliId,
      })),
    [signature],
  );
  const statuses = useAgentStatusStore((s) => s.statuses);
  const projectsQuery = useQuery<Project[]>({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const projectName = (id: string): string =>
    projectsQuery.data?.find((p) => p.id === id)?.name ?? 'Project';

  const live = tabs.filter((tab) => statuses[tab.id] !== 'exited');
  if (live.length === 0) {
    return (
      <Segment tooltip="Open the Workspace to run agents" onClick={() => navigate('/workspace')}>
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/25" />
        No agents running
      </Segment>
    );
  }

  const groups = ATTENTION_ORDER.map((status) => ({
    status,
    tabs: live.filter((tab) => (statuses[tab.id] ?? 'idle') === status),
  })).filter((group) => group.tabs.length > 0);
  const idleCount = live.filter((tab) => {
    const status = statuses[tab.id] ?? 'idle';
    return status === 'idle';
  }).length;

  const list = (items: AgentTab[]): React.ReactNode => (
    <span className="flex flex-col gap-1">
      {items.slice(0, 8).map((tab) => (
        <span key={tab.id} className="flex items-center gap-1.5">
          {tab.cliId ? <CliLogo cliId={tab.cliId} className="h-3 w-3" /> : null}
          <span className="font-medium">{tab.title}</span>
          <span className="text-muted-foreground">in {projectName(tab.projectId)}</span>
        </span>
      ))}
      {items.length > 8 ? (
        <span className="text-muted-foreground">and {items.length - 8} more</span>
      ) : null}
    </span>
  );

  const open = (tab: AgentTab): void => {
    void navigate(`/workspace/${tab.projectId}?session=${encodeURIComponent(tab.id)}`);
  };

  const noun = (status: AgentStatus, count: number): string => {
    if (status === 'needs-input') return `${count} waiting on you`;
    if (status === 'working') return `${count} working`;
    return `${count} finished`;
  };

  return (
    <>
      {groups.map((group) => (
        <Segment
          key={group.status}
          tooltip={
            <span className="flex flex-col gap-1.5">
              <span className="font-semibold">{AGENT_STATUS_LABEL[group.status]}</span>
              {list(group.tabs)}
              <span className="text-[10px] text-muted-foreground">Click to open the first one</span>
            </span>
          }
          onClick={() => {
            const first = group.tabs[0];
            if (first) open(first);
          }}
          className={cn(group.status === 'needs-input' && 'text-warning hover:text-warning')}
        >
          <AgentStatusDot status={group.status} className="scale-90" />
          {noun(group.status, group.tabs.length)}
        </Segment>
      ))}
      {idleCount > 0 ? (
        <Segment
          tooltip={
            <span className="flex flex-col gap-1.5">
              <span className="font-semibold">Idle</span>
              {list(live.filter((tab) => (statuses[tab.id] ?? 'idle') === 'idle'))}
            </span>
          }
          onClick={() => navigate('/workspace')}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
          {idleCount} idle
        </Segment>
      ) : null}
    </>
  );
}

function SystemSegments(): React.JSX.Element {
  const navigate = useNavigate();
  const history = useSystemStatsHistory({ intervalMs: SAMPLE_INTERVAL_MS, maxSamples: 15 });
  const latest = history.at(-1);

  if (!latest) {
    return (
      <span className="flex items-center gap-3 px-2">
        <span className="shimmer h-2 w-14 rounded" />
        <span className="shimmer h-2 w-16 rounded" />
        <span className="shimmer h-2 w-12 rounded" />
      </span>
    );
  }

  const pings = latest.pings ?? [];
  const alive = pings.filter((p) => p.alive);
  const latencies = alive.flatMap((p) => (p.latencyMs == null ? [] : [p.latencyMs]));
  const latency = latencies.length ? Math.round(Math.min(...latencies)) : null;
  // Quality over the recent window, so one dropped ping does not flash the bar red.
  const recent = history.flatMap((sample) => sample.pings ?? []);
  const quality = recent.length ? recent.filter((p) => p.alive).length / recent.length : 1;
  const online = pings.length === 0 || alive.length > 0;
  // Plenty of networks drop ping while the connection works, so no replies only reads as
  // offline when the OS agrees.
  const offline = !online && !navigator.onLine;
  const netTone = offline
    ? 'text-destructive'
    : !online || quality < 0.8 || (latency ?? 0) > 250
      ? 'text-warning'
      : 'text-success';

  return (
    <>
      <Segment
        tooltip={
          <span className="flex flex-col">
            <span className="font-semibold">CPU {Math.round(latest.cpuPercent)}%</span>
            <span className="text-muted-foreground">
              {latest.cpuModel} · {latest.cpuCoreCount} threads
            </span>
          </span>
        }
        onClick={() => navigate('/')}
      >
        <Cpu className="h-2.5 w-2.5" />
        <span className="w-8 text-right tabular-nums">{Math.round(latest.cpuPercent)}%</span>
        <Meter percent={latest.cpuPercent} />
      </Segment>
      <Segment
        tooltip={
          <span className="flex flex-col">
            <span className="font-semibold">Memory {Math.round(latest.memPercent)}%</span>
            <span className="text-muted-foreground">
              {formatBytes(latest.memUsedBytes)} of {formatBytes(latest.memTotalBytes)} in use
            </span>
          </span>
        }
        onClick={() => navigate('/')}
      >
        <MemoryStick className="h-2.5 w-2.5" />
        <span className="tabular-nums">
          {formatBytes(latest.memUsedBytes)}
          <span className="text-muted-foreground/60"> / {formatBytes(latest.memTotalBytes)}</span>
        </span>
        <Meter percent={latest.memPercent} />
      </Segment>
      <Segment
        tooltip={
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {online
                ? `Online, ${Math.round(quality * 100)}% of recent pings answered`
                : offline
                  ? 'Offline'
                  : 'Connected, but pings get no reply'}
            </span>
            {pings.map((ping) => (
              <span key={ping.host} className="flex justify-between gap-4 text-muted-foreground">
                <span className="font-mono">{ping.host}</span>
                <span>{ping.alive ? `${Math.round(ping.latencyMs ?? 0)} ms` : 'no reply'}</span>
              </span>
            ))}
          </span>
        }
        onClick={() => navigate('/')}
        className={netTone}
      >
        <Wifi className="h-2.5 w-2.5" />
        <span className="tabular-nums">
          {offline ? 'Offline' : !online ? 'No ping' : latency != null ? `${latency} ms` : 'Online'}
        </span>
      </Segment>
    </>
  );
}

/** The strip along the bottom of the window: agents on the left, the machine on the right. */
export function StatusBar(): React.JSX.Element {
  return (
    <footer
      aria-label="Status bar"
      className="flex h-6 shrink-0 items-center justify-between gap-2 border-t border-border/70 bg-card/40 px-1 text-[11px] text-muted-foreground"
    >
      <div className="flex h-full min-w-0 items-center overflow-hidden">
        <AgentSegments />
      </div>
      <div className="flex h-full shrink-0 items-center">
        <SystemSegments />
      </div>
    </footer>
  );
}
