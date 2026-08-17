import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as CountryFlags from 'country-flag-icons/react/3x2';
import {
  ArrowRight,
  Blocks,
  Bolt,
  ChartColumn,
  Check,
  CloudDownload,
  Cpu,
  ExternalLink,
  FolderKanban,
  Globe,
  Gpu,
  GripVertical,
  HardDrive,
  ListUnordered,
  MemoryStick,
  NetworkIcon,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Route,
  SatelliteDish,
  SettingsIcon,
  Sparkles,
  TerminalSquare,
  Trash2,
  FolderPlus,
  Wrench,
  X,
} from '@/components/icons';
import {
  AGENT_TOOL_REGISTRY,
  ALL_AGENTS_WIDGET_ID,
  CLI_REGISTRY,
  DASHBOARD_CHART_IDS,
  DASHBOARD_COLUMN_OPTIONS,
  DASHBOARD_STAT_IDS,
  DASHBOARD_USAGE_SUMMARY_IDS,
  getUsageProvider,
  type AgentToolDefinition,
  type CliDefinition,
  type DashboardColumns,
  type DashboardStatId,
  type DashboardUsageSummaryId,
  type InstalledAgentTool,
  type InstalledCli,
  type ProviderUsage,
} from '@agentmat/core';
import { CliLogo } from '@/components/cliLogos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GithubActionsCard } from '@/components/dashboard/GithubActionsCard';
import { GithubActivityCard } from '@/components/dashboard/GithubActivityCard';
import { SparklineChart } from '@/components/dashboard/SparklineChart';
import { TopResourceAppsDialog } from '@/components/dashboard/TopResourceAppsDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSystemStatsHistory } from '@/hooks/useSystemStatsHistory';
import { useUsageSummary } from '@/hooks/useUsageSummary';
import { useChartColors } from '@/lib/chartColors';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { formatCost, formatPercent, formatTokens } from '@/lib/usageFormat';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { DashboardUsageCard } from '@/components/usage/DashboardUsageCard';
import { AllAgentsCharts } from '@/components/usage/AllAgentsCharts';
import {
  useDashboardLayoutStore,
  usageProviderIdOf,
  statIdOf,
  statItemId,
  summaryIdOf,
  summaryItemId,
  type DashboardChartId,
  type DashboardItemId,
} from '@/stores/dashboardLayoutStore';

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

function formatDurationShort(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function getNetworkQualityInfo(percent: number): {
  label: string;
  variant: 'success' | 'warning' | 'destructive';
} {
  if (percent >= 99) return { label: 'Excellent', variant: 'success' };
  if (percent >= 90) return { label: 'Good', variant: 'success' };
  if (percent >= 75) return { label: 'Fair', variant: 'warning' };
  return { label: 'Poor', variant: 'destructive' };
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

/** Labels for the "Add card" menu, which re-shows hidden built-in charts. */
const CHART_LABELS: Record<DashboardChartId, string> = {
  cpu: 'CPU Usage',
  memory: 'Memory Usage',
  disk: 'Disk I/O',
  gpu: 'GPU Usage',
  network: 'Network Throughput',
  pings: 'Network Status',
  github: 'GitHub Activity',
  'github-actions': 'GitHub Actions',
};

/** Labels for the "Add card" menu, which re-shows hidden built-in stat tiles. */
const STAT_LABELS: Record<DashboardStatId, string> = {
  'installed-clis': 'Installed CLIs',
  'active-projects': 'Active Projects',
  'skill-repos': 'Skill Repositories',
  location: 'Your Location',
};

/** Labels for the "Add card" menu, which re-pins hidden Token Usage summary tiles. */
const SUMMARY_LABELS: Record<DashboardUsageSummaryId, string> = {
  'tokens-today': 'Tokens today',
  'tokens-week': 'Tokens (7 days)',
  'cost-today': 'Cost today',
  'providers-tracked': 'Providers tracked',
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

// Stands in for the plot until the first sample lands, filling the exact chart
// slot so the card doesn't resize once the line appears. Each card carries its
// own; the page never waits on all of them together.
function ChartSkeleton(): React.JSX.Element {
  return <Skeleton className="w-full" style={{ height: CHART_HEIGHT }} />;
}

// The headline number's slot while it has nothing to show. `self-center`
// because the stat rows align on the text baseline, which a blank block has no
// sensible answer for.
function StatSkeleton({ className }: { className?: string }): React.JSX.Element {
  return <Skeleton className={cn('h-8 w-20 self-center', className)} />;
}

// Only the handle itself is draggable. The card underneath just listens for
// dragover/drop, so clicking buttons elsewhere in the card (e.g. the ping
// settings shortcut) never gets mistaken for a drag gesture.
function ChartDragHandle({
  onDragStart,
  onDragEnd,
  label = 'Drag to move between rows',
}: {
  onDragStart: () => void;
  onDragEnd: () => void;
  label?: string;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label}>
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

function ToolUpdateRow({
  tool,
  status,
  latestVersion,
}: {
  tool: AgentToolDefinition;
  status: InstalledAgentTool;
  latestVersion: string;
}): React.JSX.Element {
  const openSession = useTerminalStore((s) => s.openSession);

  async function handleUpdate(): Promise<void> {
    const command = await window.agentmat.tools.getUpdateCommand(tool.id);
    if (!command) {
      toast.error(`No update command available for ${tool.name} on this OS.`);
      return;
    }
    openSession({ title: `Update ${tool.name}`, initialInput: command });
    toast.info(`Press Enter in the terminal to update ${tool.name}.`);
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{tool.name}</div>
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

// Only lists CLIs and agent tools with a newer version available. The update checks
// are hoisted here (rather than living per-row) because the card can't know which
// rows to render until every check has come back.
function UpdatesCard({
  installedClis,
}: {
  installedClis: { cli: CliDefinition; status: InstalledCli }[];
}): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deferReady = useIdleAfterMount();

  // Re-checks refresh in place behind the header's spinning icon, so nothing here
  // may raise the full-page overlay.
  const toolsQuery = useQuery({
    queryKey: queryKeys.toolsStatus,
    queryFn: () => window.agentmat.tools.detectAll(),
    staleTime: 10 * 60_000,
    enabled: deferReady,
    meta: { silentLoading: true },
  });
  const installedTools = AGENT_TOOL_REGISTRY.flatMap((tool) => {
    const status = toolsQuery.data?.find((t) => t.id === tool.id);
    return tool.updateCheck && status?.installed ? [{ tool, status }] : [];
  });

  const cliChecks = useQueries({
    queries: installedClis.map(({ cli, status }) => ({
      queryKey: queryKeys.cliUpdateCheck(cli.id, status.version),
      queryFn: () => window.agentmat.cli.checkForUpdate(cli.id, status.version),
      staleTime: 10 * 60_000,
      enabled: deferReady,
      meta: { silentLoading: true },
    })),
  });
  const toolChecks = useQueries({
    queries: installedTools.map(({ tool, status }) => ({
      queryKey: queryKeys.toolUpdateCheck(tool.id, status.version),
      queryFn: () => window.agentmat.tools.checkForUpdate(tool.id, status.version),
      staleTime: 10 * 60_000,
      meta: { silentLoading: true },
    })),
  });

  const allChecks = [...cliChecks, ...toolChecks];
  // Nothing is known to be up to date until the tool scan lands, so the idle wait
  // and the scan itself both count as "still checking".
  const checking =
    !deferReady ||
    toolsQuery.isPending ||
    toolsQuery.isFetching ||
    allChecks.some((q) => q.isPending || q.isFetching);
  const installedCount = installedClis.length + installedTools.length;

  const outdatedClis = installedClis
    .map((entry, i) => {
      const result = cliChecks[i]?.data;
      return { ...entry, latestVersion: result?.updateAvailable ? result.latestVersion : null };
    })
    .filter(
      (entry): entry is typeof entry & { latestVersion: string } => entry.latestVersion != null,
    );
  const outdatedTools = installedTools
    .map((entry, i) => {
      const result = toolChecks[i]?.data;
      return { ...entry, latestVersion: result?.updateAvailable ? result.latestVersion : null };
    })
    .filter(
      (entry): entry is typeof entry & { latestVersion: string } => entry.latestVersion != null,
    );
  const outdatedCount = outdatedClis.length + outdatedTools.length;
  const uncheckable = allChecks.filter(
    (q) => q.isError || (q.data != null && (!q.data.supported || !q.data.latestVersion)),
  ).length;

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle>Update AI CLIs & tools</CardTitle>
          {outdatedCount > 0 && (
            <Badge variant="warning">
              {outdatedCount} update{outdatedCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <SimpleTooltip label="Re-check for updates" wrapTrigger={checking || installedCount === 0}>
          <Button
            variant="ghost"
            size="icon"
            disabled={checking || installedCount === 0}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['cli-update-check'] });
              void queryClient.invalidateQueries({ queryKey: ['tool-update-check'] });
              toast.info('Checking installed CLIs and tools for updates…');
            }}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
          </Button>
        </SimpleTooltip>
      </CardHeader>
      <CardContent className="space-y-2">
        {installedCount === 0 && !checking ? (
          <p className="text-sm text-muted-foreground">
            No AI CLIs or agent tools detected yet. Visit the{' '}
            <button
              className="underline underline-offset-2"
              onClick={() => navigate('/cli-manager')}
            >
              CLI Manager
            </button>{' '}
            or{' '}
            <button className="underline underline-offset-2" onClick={() => navigate('/tools')}>
              Agent Tools
            </button>{' '}
            to install one.
          </p>
        ) : (
          <>
            {outdatedClis.map(({ cli, status, latestVersion }) => (
              <CliUpdateRow key={cli.id} cli={cli} status={status} latestVersion={latestVersion} />
            ))}
            {outdatedTools.map(({ tool, status, latestVersion }) => (
              <ToolUpdateRow
                key={tool.id}
                tool={tool}
                status={status}
                latestVersion={latestVersion}
              />
            ))}
            {checking && outdatedCount === 0 && (
              <p className="text-sm text-muted-foreground">
                Checking installed CLIs and agent tools for updates…
              </p>
            )}
            {!checking && outdatedCount === 0 && (
              <p className="text-sm text-muted-foreground">
                All {installedCount} installed CLI{installedCount === 1 ? '' : 's'} and agent tool
                {installedCount === 1 ? ' is' : 's are'} up to date.
              </p>
            )}
            {!checking && uncheckable > 0 && (
              <p className="text-xs text-muted-foreground">
                {uncheckable} of them couldn't be checked automatically.
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
  const openSession = useTerminalStore((s) => s.openSession);
  const [diagnoseHost, setDiagnoseHost] = useState<string | null>(null);
  const [speedTestOpen, setSpeedTestOpen] = useState(false);

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
  const historyPingSamples = statsHistory.flatMap((s) => s.pings);
  const pingQualityPercent =
    historyPingSamples.length > 0
      ? (historyPingSamples.filter((p) => p.alive).length / historyPingSamples.length) * 100
      : null;
  const historyDurationMs =
    timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
  const networkQualityInfo =
    pingQualityPercent != null ? getNetworkQualityInfo(pingQualityPercent) : null;

  const rows = useDashboardLayoutStore((s) => s.rows);
  const chartCardsShown = useDashboardLayoutStore((s) => s.chartCards);
  const toggleChartCard = useDashboardLayoutStore((s) => s.toggleChartCard);
  const usageCards = useDashboardLayoutStore((s) => s.usageCards);
  const toggleUsageCard = useDashboardLayoutStore((s) => s.toggleUsageCard);
  const statCards = useDashboardLayoutStore((s) => s.statCards);
  const toggleStatCard = useDashboardLayoutStore((s) => s.toggleStatCard);
  const summaryCards = useDashboardLayoutStore((s) => s.summaryCards);
  const toggleSummaryCard = useDashboardLayoutStore((s) => s.toggleSummaryCard);
  const editing = useDashboardLayoutStore((s) => s.editing);
  const setEditing = useDashboardLayoutStore((s) => s.setEditing);
  const setRowColumns = useDashboardLayoutStore((s) => s.setRowColumns);
  const addRow = useDashboardLayoutStore((s) => s.addRow);
  const removeRow = useDashboardLayoutStore((s) => s.removeRow);
  const moveItem = useDashboardLayoutStore((s) => s.moveItem);
  const moveRow = useDashboardLayoutStore((s) => s.moveRow);
  const [dragChartId, setDragChartId] = useState<DashboardItemId | null>(null);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [cpuView, setCpuView] = useState<'total' | 'cores'>('total');
  const [topAppsOpen, setTopAppsOpen] = useState(false);
  const [topAppsResource, setTopAppsResource] = useState<'cpu' | 'gpu' | 'memory' | 'disk'>('cpu');

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

  // The Token Usage summary tiles pinned here read the same aggregate totals
  // the Usage page itself shows, independent of whether that page is mounted.
  const usageSummary = useUsageSummary(summaryCards.length > 0);

  function handlePingHost(host: string): void {
    openSession({ title: `Ping ${host}`, initialInput: `ping -t ${host}` });
    toast.info(`Press Enter in the terminal to start pinging ${host}.`);
    setDiagnoseHost(null);
  }

  function handleTracerouteHost(host: string): void {
    openSession({ title: `Traceroute ${host}`, initialInput: `tracert -d ${host}` });
    toast.info(`Press Enter in the terminal to trace the route to ${host}.`);
    setDiagnoseHost(null);
  }

  /** `beforeId` is the card the drop landed on, or null to append to the row. */
  function handleChartDrop(rowId: string, beforeId: DashboardItemId | null): void {
    if (dragChartId) moveItem(dragChartId, rowId, beforeId);
    setDragChartId(null);
  }

  /** `beforeRowId` is the row the drop landed on, or null to move to the end. */
  function handleRowDrop(beforeRowId: string | null): void {
    if (dragRowId) moveRow(dragRowId, beforeRowId);
    setDragRowId(null);
  }

  function cardClass(id: DashboardItemId): string {
    return cn('glass h-full', dragChartId === id && 'opacity-50');
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

  /** Hides a built-in chart; brought back from the "Add card" menu below. */
  function removeChartCard(id: DashboardChartId, label: string): void {
    toggleChartCard(id);
    toast.info(`${label} removed from the dashboard.`);
  }

  function chartRemove(id: DashboardChartId): React.ReactNode {
    if (!editing) return null;
    return (
      <SimpleTooltip label="Remove from dashboard">
        <Button variant="ghost" size="icon" onClick={() => removeChartCard(id, CHART_LABELS[id])}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
    );
  }

  /** Hides a built-in stat tile; brought back from the "Add card" menu below. */
  function removeStatCard(id: DashboardStatId, label: string): void {
    toggleStatCard(id);
    toast.info(`${label} removed from the dashboard.`);
  }

  /** Unpins a Token Usage summary tile; re-pin here or from the Token Usage page. */
  function removeSummaryCard(id: DashboardUsageSummaryId, label: string): void {
    toggleSummaryCard(id);
    toast.info(`${label} removed from the dashboard.`);
  }

  usePageHeader('Dashboard', 'Your AI CLIs, projects, and system health at a glance.');

  const chartCards: Record<DashboardChartId, React.ReactNode> = {
    cpu: (
      <Card className={cardClass('cpu')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" /> CPU Usage
          </CardTitle>
          <div className="flex items-center gap-2">
            <SimpleTooltip label="Top apps using CPU">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setTopAppsResource('cpu');
                  setTopAppsOpen(true);
                }}
              >
                <ListUnordered className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
            {latest && latest.cpuCoreCount > 1 && (
              <Tabs value={cpuView} onValueChange={(v) => setCpuView(v as 'total' | 'cores')}>
                <TabsList
                  containerClassName="border-b-0"
                  className="mb-0 h-6 w-auto border-none bg-foreground/[0.06] p-0.5 rounded-md"
                >
                  <TabsTrigger
                    value="total"
                    className="h-5 rounded-sm border-none px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Total
                  </TabsTrigger>
                  <TabsTrigger
                    value="cores"
                    className="h-5 rounded-sm border-none px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Per core
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            {dragHandle('cpu')}
            {chartRemove('cpu')}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            {latest ? (
              <>
                <span className="text-2xl font-semibold">{formatPercent(latest.cpuPercent)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {latest.cpuModel} · {latest.cpuCoreCount} cores
                </span>
              </>
            ) : (
              <>
                <StatSkeleton className="w-16" />
                <Skeleton className="h-3 w-40 self-center" />
              </>
            )}
          </div>
          {latest && cpuView === 'cores' ? (
            <div className="mb-2 grid grid-cols-4 gap-x-2 gap-y-1 sm:grid-cols-6">
              {latest.cpuCorePercents.map((p, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: chartColors.categorical[i % chartColors.categorical.length],
                    }}
                  />
                  <span className="truncate text-muted-foreground">
                    C{i} <span className="font-medium text-foreground">{formatPercent(p)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-2 h-6" />
          )}
          {latest ? (
            <SparklineChart
              height={CHART_HEIGHT}
              timestamps={timestamps}
              domainMin={0}
              domainMax={100}
              formatValue={formatPercent}
              formatTime={formatClockTime}
              series={
                cpuView === 'cores'
                  ? latest.cpuCorePercents.map((_, i) => ({
                      key: `core-${i}`,
                      label: `Core ${i}`,
                      color: chartColors.categorical[i % chartColors.categorical.length],
                      values: statsHistory.map((s) => s.cpuCorePercents[i] ?? 0),
                    }))
                  : [
                      {
                        key: 'cpu',
                        label: 'CPU',
                        color: 'hsl(var(--primary))',
                        values: statsHistory.map((s) => s.cpuPercent),
                      },
                    ]
              }
            />
          ) : (
            <ChartSkeleton />
          )}
        </CardContent>
      </Card>
    ),

    memory: (
      <Card className={cardClass('memory')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <MemoryStick className="h-3.5 w-3.5" /> Memory Usage
          </CardTitle>
          <div className="flex items-center gap-2">
            <SimpleTooltip label="Top apps using memory">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setTopAppsResource('memory');
                  setTopAppsOpen(true);
                }}
              >
                <ListUnordered className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
            {dragHandle('memory')}
            {chartRemove('memory')}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            {latest ? (
              <>
                <span className="text-2xl font-semibold">{formatPercent(latest.memPercent)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(latest.memUsedBytes)} / {formatBytes(latest.memTotalBytes)}
                </span>
              </>
            ) : (
              <>
                <StatSkeleton className="w-16" />
                <Skeleton className="h-3 w-24 self-center" />
              </>
            )}
          </div>
          <div className="mb-2 h-6" />
          {latest ? (
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
          ) : (
            <ChartSkeleton />
          )}
        </CardContent>
      </Card>
    ),

    disk: (
      <Card className={cardClass('disk')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" /> Disk I/O
          </CardTitle>
          <div className="flex items-center gap-2">
            <SimpleTooltip label="Top apps using disk">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setTopAppsResource('disk');
                  setTopAppsOpen(true);
                }}
              >
                <ListUnordered className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
            {dragHandle('disk')}
            {chartRemove('disk')}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            {latest ? (
              <>
                <span className="text-2xl font-semibold">
                  {formatBytesPerSec(totalDiskBytesPerSec)}
                </span>
                <span className="text-xs text-muted-foreground">combined read + write</span>
              </>
            ) : (
              <>
                <StatSkeleton className="w-24" />
                <Skeleton className="h-3 w-28 self-center" />
              </>
            )}
          </div>
          <div className="mb-2 flex h-6 items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
            {!latest && <Skeleton className="h-3 w-32" />}
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
          {!latest ? (
            <ChartSkeleton />
          ) : disks.length === 0 ? (
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
          <div className="flex items-center gap-2">
            <SimpleTooltip label="Top apps using GPU">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setTopAppsResource('gpu');
                  setTopAppsOpen(true);
                }}
              >
                <ListUnordered className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
            {dragHandle('gpu')}
            {chartRemove('gpu')}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            {!latest ? (
              <StatSkeleton className="w-16" />
            ) : (
              <>
                <span className="text-2xl font-semibold">
                  {gpus.length > 0 ? formatPercent(avgGpuPercent) : 'N/A'}
                </span>
                {gpus.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    avg across {gpus.length} GPUs
                  </span>
                )}
              </>
            )}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {!latest && <Skeleton className="h-4 w-40" />}
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
          {!latest ? (
            <ChartSkeleton />
          ) : gpus.length === 0 ? (
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
          <div className="flex items-center gap-2">
            {dragHandle('network')}
            {chartRemove('network')}
            <SimpleTooltip label="Test network speed">
              <Button variant="ghost" size="icon" onClick={() => setSpeedTestOpen(true)}>
                <Bolt className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            {latest ? (
              <>
                <span className="text-2xl font-semibold">
                  {formatBytesPerSec(latest.netRxBytesPerSec)}
                </span>
                <span className="text-xs text-muted-foreground">down</span>
              </>
            ) : (
              <StatSkeleton className="w-24" />
            )}
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
          {latest ? (
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
          ) : (
            <ChartSkeleton />
          )}
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
            {chartRemove('pings')}
            <SimpleTooltip label="Manage ping targets">
              <Button variant="ghost" size="icon" onClick={() => navigate('/settings?tab=data')}>
                <SettingsIcon className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            {!latest ? (
              <StatSkeleton className="w-16" />
            ) : (
              <>
                <span className="text-2xl font-semibold">
                  {pings.length > 0 ? `${aliveTargetCount}/${pings.length}` : 'N/A'}
                </span>
                {pings.length > 0 && (
                  <span className="text-xs text-muted-foreground">targets online</span>
                )}
                {pings.length > 0 && pingQualityPercent != null && networkQualityInfo && (
                  <SimpleTooltip
                    label={`${formatPercent(pingQualityPercent)} quality over last ${formatDurationShort(historyDurationMs)}`}
                  >
                    <Badge variant={networkQualityInfo.variant}>{networkQualityInfo.label}</Badge>
                  </SimpleTooltip>
                )}
              </>
            )}
          </div>
          <div className="mb-2 flex h-6 items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
            {!latest && <Skeleton className="h-3 w-36" />}
            {pings.map((p, i) => (
              <div key={p.host} className="flex shrink-0 items-center gap-1.5 text-sm">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: chartColors.categorical[i % chartColors.categorical.length],
                  }}
                />
                <button
                  type="button"
                  className="font-medium underline-offset-2 hover:underline"
                  onClick={() => setDiagnoseHost(p.host)}
                >
                  {p.host}
                </button>
                <span className="text-xs text-muted-foreground">
                  {p.latencyMs != null ? formatMs(p.latencyMs) : 'N/A'}
                </span>
                <Badge variant={p.alive ? 'success' : 'destructive'}>
                  {p.alive ? 'Online' : 'Offline'}
                </Badge>
              </div>
            ))}
          </div>
          {!latest ? (
            <ChartSkeleton />
          ) : pings.length === 0 ? (
            <EmptyChartState
              message={
                <>
                  No ping targets configured. Add one in{' '}
                  <button
                    className="underline underline-offset-2"
                    onClick={() => navigate('/settings?tab=data')}
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

    github: (
      <GithubActivityCard
        className={cardClass('github')}
        dragHandle={dragHandle('github')}
        onRemove={editing ? () => removeChartCard('github', CHART_LABELS.github) : undefined}
        chartHeight={CHART_HEIGHT}
      />
    ),

    'github-actions': (
      <GithubActionsCard
        className={cardClass('github-actions')}
        dragHandle={dragHandle('github-actions')}
        onRemove={
          editing
            ? () => removeChartCard('github-actions', CHART_LABELS['github-actions'])
            : undefined
        }
        chartHeight={CHART_HEIGHT}
      />
    ),
  };

  const statTiles: Record<DashboardStatId, React.ReactNode> = {
    'installed-clis': (
      <StatTile
        className={cardClass(statItemId('installed-clis'))}
        icon={<TerminalSquare className="h-3.5 w-3.5" />}
        label="Installed CLIs"
        dragHandle={dragHandle(statItemId('installed-clis'))}
        onRemove={editing ? () => removeStatCard('installed-clis', 'Installed CLIs') : undefined}
        value={
          cliQuery.isPending ? (
            <StatSkeleton className="w-16" />
          ) : (
            `${installedCount}/${CLI_REGISTRY.length}`
          )
        }
      />
    ),
    'active-projects': (
      <StatTile
        className={cardClass(statItemId('active-projects'))}
        icon={<FolderKanban className="h-3.5 w-3.5" />}
        label="Active Projects"
        dragHandle={dragHandle(statItemId('active-projects'))}
        onRemove={editing ? () => removeStatCard('active-projects', 'Active Projects') : undefined}
        value={
          projectsQuery.isPending ? (
            <StatSkeleton className="w-10" />
          ) : (
            (projectsQuery.data?.length ?? 0)
          )
        }
      />
    ),
    'skill-repos': (
      <StatTile
        className={cardClass(statItemId('skill-repos'))}
        icon={<Blocks className="h-3.5 w-3.5" />}
        label="Skill Repositories"
        dragHandle={dragHandle(statItemId('skill-repos'))}
        onRemove={editing ? () => removeStatCard('skill-repos', 'Skill Repositories') : undefined}
        value={
          reposQuery.isPending ? <StatSkeleton className="w-10" /> : (reposQuery.data?.length ?? 0)
        }
      />
    ),
    location: (
      <StatTile
        className={cardClass(statItemId('location'))}
        icon={<Globe className="h-3.5 w-3.5" />}
        label="Your Location"
        dragHandle={dragHandle(statItemId('location'))}
        onRemove={editing ? () => removeStatCard('location', 'Your Location') : undefined}
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => void ipGeoQuery.refetch()}
            disabled={ipGeoQuery.isFetching}
          >
            <RefreshCw className={ipGeoQuery.isFetching ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
          </Button>
        }
        value={
          ipGeoQuery.isPending ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : ipGeoQuery.isError || !ipGeoQuery.data ? (
            <span className="text-sm text-destructive">Unavailable</span>
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
              {ipGeoQuery.data.ip ? (
                <SimpleTooltip label="Copy IP address">
                  <button
                    type="button"
                    className="truncate rounded font-mono text-lg font-semibold transition-colors hover:text-primary"
                    onClick={() => {
                      void navigator.clipboard.writeText(ipGeoQuery.data.ip);
                      toast.success('IP address copied.');
                    }}
                  >
                    {ipGeoQuery.data.ip}
                  </button>
                </SimpleTooltip>
              ) : (
                <span className="truncate font-mono text-lg font-semibold">N/A</span>
              )}
            </div>
          )
        }
      />
    ),
  };

  const summaryTiles: Record<DashboardUsageSummaryId, React.ReactNode> = {
    'tokens-today': (
      <StatTile
        className={cardClass(summaryItemId('tokens-today'))}
        icon={<ChartColumn className="h-3.5 w-3.5" />}
        label="Tokens today"
        dragHandle={dragHandle(summaryItemId('tokens-today'))}
        onRemove={editing ? () => removeSummaryCard('tokens-today', 'Tokens today') : undefined}
        value={
          usageSummary.isPending ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            formatTokens(usageSummary.todayTokens)
          )
        }
      />
    ),
    'tokens-week': (
      <StatTile
        className={cardClass(summaryItemId('tokens-week'))}
        icon={<Bolt className="h-3.5 w-3.5" />}
        label="Tokens (7 days)"
        dragHandle={dragHandle(summaryItemId('tokens-week'))}
        onRemove={editing ? () => removeSummaryCard('tokens-week', 'Tokens (7 days)') : undefined}
        value={
          usageSummary.isPending ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            formatTokens(usageSummary.weekTokens)
          )
        }
      />
    ),
    'cost-today': (
      <StatTile
        className={cardClass(summaryItemId('cost-today'))}
        icon={<ChartColumn className="h-3.5 w-3.5" />}
        label="Cost today"
        dragHandle={dragHandle(summaryItemId('cost-today'))}
        onRemove={editing ? () => removeSummaryCard('cost-today', 'Cost today') : undefined}
        value={
          usageSummary.isPending ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            (formatCost(usageSummary.cost) ?? '$0.00')
          )
        }
      />
    ),
    'providers-tracked': (
      <StatTile
        className={cardClass(summaryItemId('providers-tracked'))}
        icon={<Pin className="h-3.5 w-3.5" />}
        label="Providers tracked"
        dragHandle={dragHandle(summaryItemId('providers-tracked'))}
        onRemove={
          editing ? () => removeSummaryCard('providers-tracked', 'Providers tracked') : undefined
        }
        value={
          usageSummary.isPending ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            `${usageSummary.trackedCount}/${usageSummary.totalCount}`
          )
        }
      />
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
        {editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                <Plus /> Add card
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Charts</DropdownMenuLabel>
              {DASHBOARD_CHART_IDS.map((id) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={chartCardsShown.includes(id)}
                  onCheckedChange={() => toggleChartCard(id)}
                >
                  {CHART_LABELS[id]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Dashboard stats</DropdownMenuLabel>
              {DASHBOARD_STAT_IDS.map((id) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={statCards.includes(id)}
                  onCheckedChange={() => toggleStatCard(id)}
                >
                  {STAT_LABELS[id]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Token Usage</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={usageCards.includes(ALL_AGENTS_WIDGET_ID)}
                onCheckedChange={() => {
                  const added = toggleUsageCard(ALL_AGENTS_WIDGET_ID);
                  if (added) toast.success('All agents added to your dashboard.');
                  else toast.info('All agents removed from the dashboard.');
                }}
              >
                All agents
              </DropdownMenuCheckboxItem>
              {DASHBOARD_USAGE_SUMMARY_IDS.map((id) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={summaryCards.includes(id)}
                  onCheckedChange={() => toggleSummaryCard(id)}
                >
                  {SUMMARY_LABELS[id]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <SimpleTooltip label={editing ? 'Done editing' : 'Edit layout'}>
          <Button
            variant={editing ? 'default' : 'outline'}
            size="icon"
            className={editing ? undefined : 'ml-auto'}
            aria-label={editing ? 'Done editing' : 'Edit layout'}
            onClick={() => setEditing(!editing)}
          >
            {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </SimpleTooltip>
      </div>

      {editing && (
        <p className="text-sm text-muted-foreground">
          Drag a card by its handle to move it within a row or into another one, drag a row by its
          handle to reorder rows, choose how many columns each row uses, hide cards you don't want,
          and bring them back from "Add card".
        </p>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          // Rows the user emptied are kept as drop targets while editing, but
          // leave no gap on the finished dashboard.
          if (!editing && row.items.length === 0) return null;
          return (
            <div
              key={row.id}
              className={cn(
                editing && 'rounded-xl border border-dashed border-border p-3',
                dragRowId === row.id && 'opacity-50',
              )}
              onDragOver={(e) => {
                if (dragRowId) e.preventDefault();
              }}
              onDrop={() => {
                if (dragRowId) handleRowDrop(row.id);
              }}
            >
              {editing && (
                <div className="mb-3 flex flex-wrap items-center gap-1">
                  <ChartDragHandle
                    label="Drag to reorder rows"
                    onDragStart={() => setDragRowId(row.id)}
                    onDragEnd={() => setDragRowId(null)}
                  />
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
                        ? 'Remove row; its cards move to the row above'
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
                  const statId = statIdOf(id);
                  const summaryId = summaryIdOf(id);
                  return (
                    <motion.div
                      key={id}
                      layout
                      className="h-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleChartDrop(row.id, id)}
                    >
                      {providerId === ALL_AGENTS_WIDGET_ID ? (
                        <AllAgentsCharts
                          className={cardClass(id)}
                          actions={
                            <>
                              {dragHandle(id)}
                              <SimpleTooltip label="Open Token Usage">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate('/usage')}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </SimpleTooltip>
                              {editing && (
                                <SimpleTooltip label="Remove from dashboard">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      toggleUsageCard(ALL_AGENTS_WIDGET_ID);
                                      toast.info('All agents removed from the dashboard.');
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </SimpleTooltip>
                              )}
                            </>
                          }
                        />
                      ) : providerId ? (
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
                      ) : statId ? (
                        statTiles[statId]
                      ) : summaryId ? (
                        summaryTiles[summaryId]
                      ) : (
                        chartCards[id as DashboardChartId]
                      )}
                    </motion.div>
                  );
                })}

                {/* Appending to a row needs a target of its own; dropping on a
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

        {/* Only shown mid-drag: dropping on a row always moves it before that
            row, so moving one to the very end needs a target past the last row. */}
        {editing && dragRowId && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleRowDrop(null)}
            className="flex min-h-10 items-center justify-center rounded-xl border border-dashed border-border px-3 text-center text-xs text-muted-foreground"
          >
            Drop here to move row to the end
          </div>
        )}

        {editing && (
          <Button variant="outline" onClick={addRow}>
            <Plus /> Add row
          </Button>
        )}
      </div>

      <UpdatesCard installedClis={installedClis} />

      <Dialog open={diagnoseHost !== null} onOpenChange={(open) => !open && setDiagnoseHost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Diagnose {diagnoseHost}</DialogTitle>
            <DialogDescription>Open a terminal session to investigate this host.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => diagnoseHost && handlePingHost(diagnoseHost)}>
              <SatelliteDish className="h-3.5 w-3.5" /> Ping (ping -t)
            </Button>
            <Button onClick={() => diagnoseHost && handleTracerouteHost(diagnoseHost)}>
              <Route className="h-3.5 w-3.5" /> Traceroute (tracert -d)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TopResourceAppsDialog
        open={topAppsOpen}
        onOpenChange={setTopAppsOpen}
        resource={topAppsResource}
      />

      <Dialog open={speedTestOpen} onOpenChange={setSpeedTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Network Speed Test</DialogTitle>
            <DialogDescription>
              Measure ping, download, and upload speed on Cloudflare&apos;s speed test site.
            </DialogDescription>
          </DialogHeader>

          <p className="py-2 text-sm text-muted-foreground">
            This opens speed.cloudflare.com in your browser, which measures your connection far more
            accurately than a test run from inside the app.
          </p>

          <DialogFooter>
            <Button
              onClick={() => {
                void window.agentmat.shell.openExternal('https://speed.cloudflare.com/');
                setSpeedTestOpen(false);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open speed.cloudflare.com
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
