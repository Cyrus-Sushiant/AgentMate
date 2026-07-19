import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as CountryFlags from 'country-flag-icons/react/3x2';
import {
  Blocks,
  CloudDownload,
  Cpu,
  FolderKanban,
  Globe,
  Gpu,
  GripVertical,
  HardDrive,
  MemoryStick,
  NetworkIcon,
  RefreshCw,
  SatelliteDish,
  SettingsIcon,
  Sparkles,
  TerminalSquare,
  FolderPlus,
} from '@/components/icons';
import { CLI_REGISTRY, type CliDefinition, type InstalledCli } from '@agentmat/core';
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
import { timeAgo } from '@/lib/time';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useTerminalStore } from '@/stores/terminalStore';
import {
  useDashboardOrderStore,
  type DashboardChartId,
} from '@/stores/dashboardOrderStore';

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
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

// Every chart card reserves the same stat/legend/chart layout (see the
// `h-8`/`h-6`/CHART_HEIGHT slots below) so cards are the same height no
// matter which ones end up paired in the grid after a reorder.
const CHART_HEIGHT = 88;

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
function ChartDragHandle({ onDragStart }: { onDragStart: () => void }): React.JSX.Element {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      className="cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
      title="Drag to reorder"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </span>
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

function CliUpdateRow({ cli, status }: { cli: CliDefinition; status: InstalledCli }): React.JSX.Element {
  const openSession = useTerminalStore((s) => s.openSession);
  const deferReady = useIdleAfterMount();
  const updateQuery = useQuery({
    queryKey: queryKeys.cliUpdateCheck(cli.id, status.version),
    queryFn: () => window.agentmat.cli.checkForUpdate(cli.id, status.version),
    staleTime: 10 * 60_000,
    enabled: deferReady,
  });

  async function handleUpdate(): Promise<void> {
    const command = await window.agentmat.cli.getUpdateCommand(cli.id);
    if (!command) {
      toast.error(`No update command available for ${cli.name} on this OS.`);
      return;
    }
    openSession({ title: `Update ${cli.name}`, initialInput: command });
    toast.info(`Press Enter in the terminal to update ${cli.name}.`);
  }

  const result = updateQuery.data;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <CliLogo cliId={cli.id} className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{cli.name}</div>
          <div className="text-xs text-muted-foreground">{status.version ?? 'unknown version'}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {updateQuery.isPending ? (
          <Badge variant="outline">Checking…</Badge>
        ) : !result?.supported ? (
          <Badge variant="outline">No update check</Badge>
        ) : !result.latestVersion ? (
          <Badge variant="outline">Check failed</Badge>
        ) : result.updateAvailable ? (
          <>
            <Badge variant="warning">v{result.latestVersion} available</Badge>
            <Button size="sm" variant="outline" onClick={() => void handleUpdate()}>
              <CloudDownload className="h-3.5 w-3.5" /> Update
            </Button>
          </>
        ) : (
          <Badge variant="success">Up to date</Badge>
        )}
      </div>
    </div>
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
  const activityQuery = useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => window.agentmat.activity.list(),
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
  });

  const installedCount = cliQuery.data?.filter((c) => c.installed).length ?? 0;

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
  const avgGpuPercent = gpus.length > 0 ? gpus.reduce((sum, g) => sum + g.percent, 0) / gpus.length : 0;
  const aliveTargetCount = pings.filter((p) => p.alive).length;

  const chartOrder = useDashboardOrderStore((s) => s.order);
  const setChartOrder = useDashboardOrderStore((s) => s.setOrder);
  const [dragChartId, setDragChartId] = useState<DashboardChartId | null>(null);

  function handleChartDrop(targetId: DashboardChartId): void {
    if (!dragChartId || dragChartId === targetId) {
      setDragChartId(null);
      return;
    }
    const next = chartOrder.filter((id) => id !== dragChartId);
    next.splice(next.indexOf(targetId), 0, dragChartId);
    setChartOrder(next);
    setDragChartId(null);
  }

  function chartDragProps(id: DashboardChartId): {
    className: string;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
  } {
    return {
      className: cn('h-full', dragChartId === id && 'opacity-50'),
      onDragOver: (e) => e.preventDefault(),
      onDrop: () => handleChartDrop(id),
    };
  }

  usePageHeader('Dashboard', 'Your AI CLIs, projects, and activity at a glance.');

  const chartCards: Record<DashboardChartId, React.ReactNode> = {
    cpu: (
      <Card {...chartDragProps('cpu')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" /> CPU Usage
          </CardTitle>
          <ChartDragHandle onDragStart={() => setDragChartId('cpu')} />
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
      <Card {...chartDragProps('memory')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <MemoryStick className="h-3.5 w-3.5" /> Memory Usage
          </CardTitle>
          <ChartDragHandle onDragStart={() => setDragChartId('memory')} />
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
      <Card {...chartDragProps('disk')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" /> Disk I/O
          </CardTitle>
          <ChartDragHandle onDragStart={() => setDragChartId('disk')} />
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">{formatBytesPerSec(totalDiskBytesPerSec)}</span>
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
      <Card {...chartDragProps('gpu')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gpu className="h-3.5 w-3.5" /> GPU Usage
          </CardTitle>
          <ChartDragHandle onDragStart={() => setDragChartId('gpu')} />
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
          <div className="mb-2 flex h-6 items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
            {gpus.map((g, i) => (
              <div key={g.id} className="flex shrink-0 items-center gap-1.5 text-sm">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: chartColors.categorical[i % chartColors.categorical.length],
                  }}
                />
                <span className="font-medium">{g.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatPercent(g.percent)} · {formatBytes(g.memUsedBytes)}/{formatBytes(g.memTotalBytes)}
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
      <Card {...chartDragProps('network')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <NetworkIcon className="h-3.5 w-3.5" /> Network Throughput
          </CardTitle>
          <ChartDragHandle onDragStart={() => setDragChartId('network')} />
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
      <Card {...chartDragProps('pings')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
            <SatelliteDish className="h-3.5 w-3.5" /> Network Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <ChartDragHandle onDragStart={() => setDragChartId('pings')} />
            <Button variant="ghost" size="icon" title="Manage ping targets" onClick={() => navigate('/settings')}>
              <SettingsIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex h-8 items-baseline gap-2">
            <span className="text-2xl font-semibold">
              {pings.length > 0 ? `${aliveTargetCount}/${pings.length}` : '—'}
            </span>
            {pings.length > 0 && <span className="text-xs text-muted-foreground">targets online</span>}
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
                  <button className="underline underline-offset-2" onClick={() => navigate('/settings')}>
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
                values: statsHistory.map((s) => s.pings.find((x) => x.host === p.host)?.latencyMs ?? 0),
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
      </div>

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
              <RefreshCw className={ipGeoQuery.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {chartOrder.map((id) => (
          <motion.div
            key={id}
            layout
            className="h-full"
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            {chartCards[id]}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Installed AI CLIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CLI_REGISTRY.filter((cli) => cliQuery.data?.find((c) => c.id === cli.id)?.installed).map(
              (cli) => {
                const status = cliQuery.data?.find((c) => c.id === cli.id);
                if (!status) return null;
                return <CliUpdateRow key={cli.id} cli={cli} status={status} />;
              },
            )}
            {installedCount === 0 && (
              <p className="text-sm text-muted-foreground">
                No AI CLIs detected yet. Visit the{' '}
                <button className="underline underline-offset-2" onClick={() => navigate('/cli-manager')}>
                  CLI Manager
                </button>{' '}
                to install one.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!activityQuery.data || activityQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet — install a CLI or create a project to get started.
              </p>
            ) : (
              activityQuery.data.slice(0, 8).map((event) => (
                <div key={event.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{event.message}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(event.createdAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
