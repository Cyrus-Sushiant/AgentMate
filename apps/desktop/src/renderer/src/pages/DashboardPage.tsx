import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as CountryFlags from 'country-flag-icons/react/3x2';
import {
  ArrowRight,
  Blocks,
  Check,
  CloudDownload,
  Cpu,
  FolderKanban,
  Globe,
  Gpu,
  GripVertical,
  HardDrive,
  MemoryStick,
  NetworkIcon,
  Pencil,
  Plus,
  RefreshCw,
  SatelliteDish,
  SettingsIcon,
  Sparkles,
  TerminalSquare,
  Trash2,
  FolderPlus,
} from '@/components/icons';
import {
  CLI_REGISTRY,
  DASHBOARD_COLUMN_OPTIONS,
  getUsageProvider,
  type CliDefinition,
  type DashboardColumns,
  type InstalledCli,
  type ProviderUsage,
} from '@agentmat/core';
import { CliLogo } from '@/components/cliLogos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { SparklineChart } from '@/components/dashboard/SparklineChart';
import { useSystemStatsHistory } from '@/hooks/useSystemStatsHistory';
import { useChartColors } from '@/lib/chartColors';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { DashboardUsageCard } from '@/components/usage/DashboardUsageCard';
import {
  useDashboardLayoutStore,
  usageProviderIdOf,
  type DashboardChartId,
  type DashboardItemId,
} from '@/stores/dashboardLayoutStore';

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function formatBytesPerSec(value: number): string {
  if (value < 1024) return `${value.toFixed(0)} B/s`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB/s`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatMs(value: number): string {
  return `${value.toFixed(0)} ms`;
}

function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

// Every chart card reserves the same stat/legend/chart layout (see the
// `h-8`/`h-6`/CHART_HEIGHT slots below) so cards are the same height no
// matter which ones end up paired in the grid after a reorder.
const CHART_HEIGHT = 88;

// Written out per option (never interpolated) so Tailwind's scanner still sees
// every class. Each step keeps the narrower fallbacks, so a 4-column row
// degrades to 2 and then 1 as the window shrinks instead of squeezing.
const GRID_COLUMN_CLASS: Record<DashboardColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4',
};

function EmptyChartState({ message }: { message: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height: CHART_HEIGHT }}
    >
      {message}
    </div>
  );
}

// Only the handle itself is draggable — the card underneath just listens for
// dragover/drop — so clicking buttons elsewhere in the card (e.g. the ping
// settings shortcut) never gets mistaken for a drag gesture.
function ChartDragHandle({
  onDragStart,
  onDragEnd,
}: {
  onDragStart: () => void;
  onDragEnd: () => void;
}): React.JSX.Element {
  return (
    <SimpleTooltip label="Drag to move between rows">
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        // Fires for drops outside any target too, so a cancelled drag doesn't
        // leave the card stuck at half opacity.
        onDragEnd={onDragEnd}
        className="cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
    </SimpleTooltip>
  );
}

// Rendered as an SVG component (not a Unicode flag emoji) since Windows'
// default emoji font doesn't reliably draw regional-indicator flag glyphs.
function CountryFlag({ countryCode, className }: { countryCode: string; className?: string }) {
  const Flag = CountryFlags[countryCode.toUpperCase() as keyof typeof CountryFlags];
  if (!Flag) return null;
  return <Flag className={className} />;
}

// Defers `ready` until the browser is idle after mount, so callers can hold
// off starting slow/network-bound work (IP lookup, CLI update checks) until
// the page's core content has already painted, instead of competing with it.
function useIdleAfterMount(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setReady(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

function CliUpdateRow({
  cli,
  status,
  latestVersion,
}: {
  cli: CliDefinition;
  status: InstalledCli;
  latestVersion: string;
}): React.JSX.Element {
  const openSession = useTerminalStore((s) => s.openSession);

  async function handleUpdate(): Promise<void> {
    const command = await window.agentmat.cli.getUpdateCommand(cli.id);
    if (!command) {
      toast.error(`No update command available for ${cli.name} on this OS.`);
      return;
    }
    openSession({ title: `Update ${cli.name}`, initialInput: command });
    toast.info(`Press Enter in the terminal to update ${cli.name}.`);
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <CliLogo cliId={cli.id} className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{cli.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{status.version ?? 'unknown version'}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-foreground">v{latestVersion}</span>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => void handleUpdate()}>
        <CloudDownload className="h-3.5 w-3.5" /> Update
      </Button>
    </div>
  );
}

// Only lists CLIs with a newer version available. The update checks are hoisted
// here (rather than living per-row) because the card can't know which rows to
// render until every check has come back.
function CliUpdatesCard({
  installed,
}: {
  installed: { cli: CliDefinition; status: InstalledCli }[];
}): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deferReady = useIdleAfterMount();

  const updateChecks = useQueries({
    queries: installed.map(({ cli, status }) => ({
      queryKey: queryKeys.cliUpdateCheck(cli.id, status.version),
      queryFn: () => window.agentmat.cli.checkForUpdate(cli.id, status.version),
      staleTime: 10 * 60_000,
      enabled: deferReady,
      // Re-checks refresh in place behind the header's spinning icon, so they
      // must not raise the full-page overlay.
      meta: { silentLoading: true },
    })),
  });

  const checking = updateChecks.some((q) => q.isPending || q.isFetching);
  const outdated = installed
    .map((entry, i) => {
      const result = updateChecks[i]?.data;
      return { ...entry, latestVersion: result?.updateAvailable ? result.latestVersion : null };
    })
    .filter(
      (entry): entry is typeof entry & { latestVersion: string } => entry.latestVersion != null,
    );
  const uncheckable = updateChecks.filter(
    (q) => q.isError || (q.data != null && (!q.data.supported || !q.data.latestVersion)),
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle>Update AI CLIs</CardTitle>
          {outdated.length > 0 && (
            <Badge variant="warning">
              {outdated.length} update{outdated.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <SimpleTooltip
          label="Re-check for updates"
          wrapTrigger={checking || installed.length === 0}
        >
          <Button
            variant="ghost"
            size="icon"
            disabled={checking || installed.length === 0}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['cli-update-check'] });
              toast.info('Checking installed CLIs for updates…');
            }}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
          </Button>
        </SimpleTooltip>
      </CardHeader>
      <CardContent className="space-y-2">
        {installed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AI CLIs detected yet. Visit the{' '}
            <button
              className="underline underline-offset-2"
              onClick={() => navigate('/cli-manager')}
            >
              CLI Manager
            </button>{' '}
            to install one.
          </p>
        ) : (
          <>
            {outdated.map(({ cli, status, latestVersion }) => (
              <CliUpdateRow key={cli.id} cli={cli} status={status} latestVersion={latestVersion} />
            ))}
            {checking && outdated.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Checking {installed.length} installed CLI{installed.length > 1 ? 's' : ''} for
                updates…
              </p>
            )}
            {!checking && outdated.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All {installed.length} installed CLI{installed.length > 1 ? 's are' : ' is'} up to
                date.
              </p>
            )}
            {!checking && uncheckable > 0 && (
              <p className="text-xs text-muted-foreground">
                {uncheckable} CLI{uncheckable > 1 ? 's' : ''} couldn't be checked automatically.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cliQuery = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const reposQuery = useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => window.agentmat.skills.listRepositories(),
  });
  const ipGeoDeferReady = useIdleAfterMount();
  const ipGeoQuery = useQuery({
    queryKey: queryKeys.ipGeo,
    queryFn: () => window.agentmat.ipGeo.lookup(),
    staleTime: Infinity,
    retry: false,
    enabled: ipGeoDeferReady,
    meta: { silentLoading: true },
  });

  const installedClis = CLI_REGISTRY.flatMap((cli) => {
    const status = cliQuery.data?.find((c) => c.id === cli.id);
    return status?.installed ? [{ cli, status }] : [];
  });
  const installedCount = installedClis.length;

  const statsHistory = useSystemStatsHistory();
  const chartColors = useChartColors();
  const timestamps = statsHistory.map((s) => s.timestamp);
  const latest = statsHistory.at(-1);
  const pings = latest?.pings ?? [];
  const disks = latest?.disks ?? [];
  const gpus = latest?.gpus ?? [];
  const totalDiskBytesPerSec = disks.reduce(
    (sum, d) => sum + d.readBytesPerSec + d.writeBytesPerSec,
    0,
  );
  const avgGpuPercent =
    gpus.length > 0 ? gpus.reduce((sum, g) => sum + g.percent, 0) / gpus.length : 0;
  const aliveTargetCount = pings.filter((p) => p.alive).length;

  const rows = useDashboardLayoutStore((s) => s.rows);
  const usageCards = useDashboardLayoutStore((s) => s.usageCards);
  const toggleUsageCard = useDashboardLayoutStore((s) => s.toggleUsageCard);
  const editing = useDashboardLayoutStore((s) => s.editing);
  const setEditing = useDashboardLayoutStore((s) => s.setEditing);
  const setRowColumns = useDashboardLayoutStore((s) => s.setRowColumns);
  const addRow = useDashboardLayoutStore((s) => s.addRow);
  const removeRow = useDashboardLayoutStore((s) => s.removeRow);
  const moveItem = useDashboardLayoutStore((s) => s.moveItem);
  const [dragChartId, setDragChartId] = useState<DashboardItemId | null>(null);

  // Token Usage cards the user added to the dashboard read the same list (and
  // the same tokens/plan-limits choice) the Usage page does.
  const usageQuery = useQuery({
    queryKey: queryKeys.usageList,
    queryFn: () => window.agentmat.usage.list(),
    refetchInterval: 45_000,
    enabled: usageCards.length > 0,
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
    enabled: usageCards.length > 0,
  });
  const usageById = useMemo(() => {
    const map = new Map<string, ProviderUsage>();
    for (const u of usageQuery.data ?? []) map.set(u.providerId, u);
    return map;
  }, [usageQuery.data]);
  const usageCardModes = settingsQuery.data?.usageCardModes ?? {};

  /** `beforeId` is the card the drop landed on, or null to append to the row. */
  function handleChartDrop(rowId: string, beforeId: DashboardItemId | null): void {
    if (dragChartId) moveItem(dragChartId, rowId, beforeId);
    setDragChartId(null);
  }

  function cardClass(id: DashboardItemId): string {
    return cn('h-full', dragChartId === id && 'opacity-50');
  }

  // Handles only exist in edit mode, so the everyday dashboard has no chrome
  // on its cards.
  function dragHandle(id: DashboardItemId): React.ReactNode {
    if (!editing) return null;
    return (
      <ChartDragHandle
        onDragStart={() => setDragChartId(id)}
        onDragEnd={() => setDragChartId(null)}
      />
    );
  }

  usePageHeader('Dashboard', 'Your AI CLIs, projects, and system health at a glance.');

  const chartCards: Record<DashboardChartId, React.ReactNode> = {
    cpu: (
      <Card className={cardClass('cpu')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" /> CPU Usage
          </CardTitle>
          {dragHandle('cpu')}
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {latest ? formatPercent(latest.cpuPercent) : '—'}
            </span>
          </div>
          <div className="mb-2 h-6" />
          <SparklineChart
            height={CHART_HEIGHT}
            timestamps={timestamps}
            domainMin={0}
            domainMax={100}
            formatValue={formatPercent}
            formatTime={formatClockTime}
            series={[
              {
                key: 'cpu',
                label: 'CPU',
                color: 'hsl(var(--primary))',
                values: statsHistory.map((s) => s.cpuPercent),
              },
            ]}
          />
        </CardContent>
      </Card>
    ),

    memory: (
      <Card className={cardClass('memory')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <MemoryStick className="h-3.5 w-3.5" /> Memory Usage
          </CardTitle>
          {dragHandle('memory')}
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {latest ? formatPercent(latest.memPercent) : '—'}
            </span>
            {latest && (
              <span className="text-xs text-muted-foreground">
                {formatBytes(latest.memUsedBytes)} / {formatBytes(latest.memTotalBytes)}
              </span>
            )}
          </div>
          <div className="mb-2 h-6" />
          <SparklineChart
            height={CHART_HEIGHT}
            timestamps={timestamps}
            domainMin={0}
            domainMax={100}
            formatValue={formatPercent}
            formatTime={formatClockTime}
            series={[
              {
                key: 'mem',
                label: 'Memory',
                color: 'hsl(var(--primary))',
                values: statsHistory.map((s) => s.memPercent),
              },
            ]}
          />
        </CardContent>
      </Card>
    ),

    disk: (
      <Card className={cardClass('disk')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" /> Disk I/O
          </CardTitle>
          {dragHandle('disk')}
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {formatBytesPerSec(totalDiskBytesPerSec)}
            </span>
            <span className="text-xs text-muted-foreground">combined read + write</span>
          </div>
          <div className="mb-2 flex h-6 items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
            {disks.map((d, i) => (
              <div key={d.id} className="flex shrink-0 items-center gap-1.5 text-sm">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: chartColors.categorical[i % chartColors.categorical.length],
                  }}
                />
                <span className="font-medium">{d.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytesPerSec(d.readBytesPerSec + d.writeBytesPerSec)}
                </span>
              </div>
            ))}
          </div>
          {disks.length === 0 ? (
            <EmptyChartState message="No disk activity detected." />
          ) : (
            <SparklineChart
              height={CHART_HEIGHT}
              timestamps={timestamps}
              domainMin={0}
              formatValue={formatBytesPerSec}
              formatTime={formatClockTime}
              series={disks.map((d, i) => ({
                key: d.id,
                label: d.label,
                color: chartColors.categorical[i % chartColors.categorical.length],
                values: statsHistory.map((s) => {
                  const found = s.disks.find((x) => x.id === d.id);
                  return found ? found.readBytesPerSec + found.writeBytesPerSec : 0;
                }),
              }))}
            />
          )}
        </CardContent>
      </Card>
    ),

    gpu: (
      <Card className={cardClass('gpu')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gpu className="h-3.5 w-3.5" /> GPU Usage
          </CardTitle>
          {dragHandle('gpu')}
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {gpus.length > 0 ? formatPercent(avgGpuPercent) : '—'}
            </span>
            {gpus.length > 1 && (
              <span className="text-xs text-muted-foreground">avg across {gpus.length} GPUs</span>
            )}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {gpus.map((g, i) => (
              <div key={g.id} className="flex items-center gap-1.5 text-sm">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: chartColors.categorical[i % chartColors.categorical.length],
                  }}
                />
                <span className="font-medium">{g.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatPercent(g.percent)} · {formatBytes(g.memUsedBytes)}/
                  {formatBytes(g.memTotalBytes)}
                </span>
              </div>
            ))}
          </div>
          {gpus.length === 0 ? (
            <EmptyChartState message="No supported GPU detected." />
          ) : (
            <SparklineChart
              height={CHART_HEIGHT}
              timestamps={timestamps}
              domainMin={0}
              domainMax={100}
              formatValue={formatPercent}
              formatTime={formatClockTime}
              series={gpus.map((g, i) => ({
                key: g.id,
                label: g.label,
                color: chartColors.categorical[i % chartColors.categorical.length],
                values: statsHistory.map((s) => s.gpus.find((x) => x.id === g.id)?.percent ?? 0),
              }))}
            />
          )}
        </CardContent>
      </Card>
    ),

    network: (
      <Card className={cardClass('network')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <NetworkIcon className="h-3.5 w-3.5" /> Network Throughput
          </CardTitle>
          {dragHandle('network')}
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {latest ? formatBytesPerSec(latest.netRxBytesPerSec) : '—'}
            </span>
            <span className="text-xs text-muted-foreground">down</span>
          </div>
          <div className="mb-2 flex h-6 items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap text-xs text-muted-foreground">
            <span className="flex shrink-0 items-center gap-1">
              <span
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: chartColors.green }}
              />
              Download
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: chartColors.blue }}
              />
              Upload
            </span>
          </div>
          <SparklineChart
            height={CHART_HEIGHT}
            timestamps={timestamps}
            domainMin={0}
            formatValue={formatBytesPerSec}
            formatTime={formatClockTime}
            series={[
              {
                key: 'rx',
                label: 'Download',
                color: chartColors.green,
                values: statsHistory.map((s) => s.netRxBytesPerSec),
              },
              {
                key: 'tx',
                label: 'Upload',
                color: chartColors.blue,
                values: statsHistory.map((s) => s.netTxBytesPerSec),
              },
            ]}
          />
        </CardContent>
      </Card>
    ),

    pings: (
      <Card className={cardClass('pings')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <SatelliteDish className="h-3.5 w-3.5" /> Network Status
          </CardTitle>
          <div className="flex items-center gap-2">
            {dragHandle('pings')}
            <SimpleTooltip label="Manage ping targets">
              <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
                <SettingsIcon className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {pings.length > 0 ? `${aliveTargetCount}/${pings.length}` : '—'}
            </span>
            {pings.length > 0 && (
              <span className="text-xs text-muted-foreground">targets online</span>
            )}
          </div>
          <div className="mb-2 flex h-6 items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
            {pings.map((p, i) => (
              <div key={p.host} className="flex shrink-0 items-center gap-1.5 text-sm">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: chartColors.categorical[i % chartColors.categorical.length],
                  }}
                />
                <span className="font-medium">{p.host}</span>
                <span className="text-xs text-muted-foreground">
                  {p.latencyMs != null ? formatMs(p.latencyMs) : '—'}
                </span>
                <Badge variant={p.alive ? 'success' : 'destructive'}>
                  {p.alive ? 'Online' : 'Offline'}
                </Badge>
              </div>
            ))}
          </div>
          {pings.length === 0 ? (
            <EmptyChartState
              message={
                <>
                  No ping targets configured. Add one in{' '}
                  <button
                    className="underline underline-offset-2"
                    onClick={() => navigate('/settings')}
                  >
                    Settings
                  </button>
                  .
                </>
              }
            />
          ) : (
            <SparklineChart
              height={CHART_HEIGHT}
              timestamps={timestamps}
              domainMin={0}
              formatValue={formatMs}
              formatTime={formatClockTime}
              series={pings.map((p, i) => ({
                key: p.host,
                label: p.host,
                color: chartColors.categorical[i % chartColors.categorical.length],
                values: statsHistory.map(
                  (s) => s.pings.find((x) => x.host === p.host)?.latencyMs ?? 0,
                ),
              }))}
            />
          )}
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/projects?new=1')}>
          <FolderPlus /> New Project
        </Button>
        <Button variant="secondary" onClick={() => navigate('/prompt-builder')}>
          <Sparkles /> Open Prompt Builder
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.cliStatus });
            toast.info('Re-scanning installed CLIs…');
          }}
        >
          <RefreshCw /> Scan CLIs
        </Button>

        <SimpleTooltip label={editing ? 'Done editing' : 'Edit layout'}>
          <Button
            variant={editing ? 'default' : 'outline'}
            size="icon"
            className="ml-auto"
            aria-label={editing ? 'Done editing' : 'Edit layout'}
            onClick={() => setEditing(!editing)}
          >
            {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </SimpleTooltip>
      </div>

      {editing && (
        <p className="text-sm text-muted-foreground">
          Drag a card by its handle to move it within a row or into another one, choose how many
          columns each row uses, and remove Token Usage cards you no longer want.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <TerminalSquare className="h-3.5 w-3.5" /> Installed CLIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {installedCount}/{CLI_REGISTRY.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" /> Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{projectsQuery.data?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <Blocks className="h-3.5 w-3.5" /> Skill Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{reposQuery.data?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> Your Location
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void ipGeoQuery.refetch()}
              disabled={ipGeoQuery.isFetching}
            >
              <RefreshCw
                className={ipGeoQuery.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              />
            </Button>
          </CardHeader>
          <CardContent>
            {ipGeoQuery.isPending ? (
              <div className="text-sm text-muted-foreground">Looking up…</div>
            ) : ipGeoQuery.isError || !ipGeoQuery.data ? (
              <div className="text-sm text-destructive">Unavailable</div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <SimpleTooltip label={ipGeoQuery.data.country}>
                  <span className="shrink-0">
                    <CountryFlag
                      countryCode={ipGeoQuery.data.countryCode}
                      className="h-4 w-6 rounded-[2px]"
                    />
                  </span>
                </SimpleTooltip>
                <span className="truncate font-mono text-lg font-semibold">
                  {ipGeoQuery.data.ip || '—'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          // Rows the user emptied are kept as drop targets while editing, but
          // leave no gap on the finished dashboard.
          if (!editing && row.items.length === 0) return null;
          return (
            <div
              key={row.id}
              className={cn(editing && 'rounded-xl border border-dashed border-border p-3')}
            >
              {editing && (
                <div className="mb-3 flex flex-wrap items-center gap-1">
                  <span className="mr-auto text-xs text-muted-foreground">
                    {row.items.length === 0
                      ? 'Empty row'
                      : `${row.items.length} card${row.items.length > 1 ? 's' : ''}`}
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
                    <span className="px-1.5 text-xs text-muted-foreground">Columns</span>
                    {DASHBOARD_COLUMN_OPTIONS.map((count) => (
                      <SimpleTooltip key={count} label={`${count} per row`}>
                        <Button
                          variant={row.columns === count ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-7 w-8 px-0"
                          aria-pressed={row.columns === count}
                          onClick={() => setRowColumns(row.id, count)}
                        >
                          {count}
                        </Button>
                      </SimpleTooltip>
                    ))}
                  </div>
                  <SimpleTooltip
                    label={
                      rows.length > 1
                        ? 'Remove row — its cards move to the row above'
                        : 'The last row stays, so there is always somewhere to drop a card'
                    }
                    wrapTrigger={rows.length === 1}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={rows.length === 1}
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </SimpleTooltip>
                </div>
              )}

              <div className={cn('grid gap-4', GRID_COLUMN_CLASS[row.columns])}>
                {row.items.map((rawId) => {
                  const id = rawId as DashboardItemId;
                  const providerId = usageProviderIdOf(id);
                  return (
                    <motion.div
                      key={id}
                      layout
                      className="h-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleChartDrop(row.id, id)}
                    >
                      {providerId ? (
                        <DashboardUsageCard
                          providerId={providerId}
                          usage={usageById.get(providerId)}
                          mode={usageCardModes[providerId] ?? 'tokens'}
                          loading={usageQuery.isPending}
                          className={cardClass(id)}
                          onRemove={
                            editing
                              ? () => {
                                  toggleUsageCard(providerId);
                                  toast.info(
                                    `${getUsageProvider(providerId)?.name ?? 'Card'} removed from the dashboard.`,
                                  );
                                }
                              : undefined
                          }
                          dragHandle={dragHandle(id)}
                        />
                      ) : (
                        chartCards[id as DashboardChartId]
                      )}
                    </motion.div>
                  );
                })}

                {/* Appending to a row needs a target of its own — dropping on a
                    card always inserts before it. */}
                {editing && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleChartDrop(row.id, null)}
                    className={cn(
                      'flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border px-3 text-center text-xs text-muted-foreground',
                      row.items.length === 0 && 'col-span-full',
                    )}
                  >
                    Drop a card here
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {editing && (
          <Button variant="outline" onClick={addRow}>
            <Plus /> Add row
          </Button>
        )}
      </div>

      <CliUpdatesCard installed={installedClis} />
    </div>
  );
}
