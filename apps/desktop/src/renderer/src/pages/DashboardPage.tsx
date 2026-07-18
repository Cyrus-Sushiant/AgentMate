import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Blocks,
  Cpu,
  FolderKanban,
  MemoryStick,
  NetworkIcon,
  RefreshCw,
  SatelliteDish,
  Sparkles,
  TerminalSquare,
  FolderPlus,
} from '@/components/icons';
import { CLI_REGISTRY } from '@agentmat/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SparklineChart } from '@/components/dashboard/SparklineChart';
import { useSystemStatsHistory } from '@/hooks/useSystemStatsHistory';
import { useChartColors } from '@/lib/chartColors';
import { queryKeys } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/time';
import { usePageHeader } from '@/stores/pageHeaderStore';

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

  const installedCount = cliQuery.data?.filter((c) => c.installed).length ?? 0;

  const statsHistory = useSystemStatsHistory();
  const chartColors = useChartColors();
  const timestamps = statsHistory.map((s) => s.timestamp);
  const latest = statsHistory.at(-1);

  usePageHeader('Dashboard', 'Your AI CLIs, projects, and activity at a glance.');

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
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activityQuery.data?.length ?? 0}</div>
          </CardContent>
        </Card>
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
                return (
                  <div key={cli.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{cli.name}</div>
                      <div className="text-xs text-muted-foreground">{status?.version}</div>
                    </div>
                    <Badge variant="success">Installed</Badge>
                  </div>
                );
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" /> CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-2xl font-semibold">
              {latest ? formatPercent(latest.cpuPercent) : '—'}
            </div>
            <SparklineChart
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" /> Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">
                {latest ? formatPercent(latest.memPercent) : '—'}
              </span>
              {latest && (
                <span className="text-xs text-muted-foreground">
                  {formatBytes(latest.memUsedBytes)} / {formatBytes(latest.memTotalBytes)}
                </span>
              )}
            </div>
            <SparklineChart
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <NetworkIcon className="h-3.5 w-3.5" /> Network Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">
                  {latest ? formatBytesPerSec(latest.netRxBytesPerSec) : '—'}
                </span>
                <span className="text-xs text-muted-foreground">down</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-0.5 w-3 rounded-full"
                    style={{ backgroundColor: chartColors.green }}
                  />
                  Download
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-0.5 w-3 rounded-full"
                    style={{ backgroundColor: chartColors.blue }}
                  />
                  Upload
                </span>
              </div>
            </div>
            <SparklineChart
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
              <SatelliteDish className="h-3.5 w-3.5" /> Network Status (ping 1.1.1.1)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl font-semibold">
                {latest?.pingMs != null ? formatMs(latest.pingMs) : '—'}
              </span>
              {latest && (
                <Badge variant={latest.pingAlive ? 'success' : 'destructive'}>
                  {latest.pingAlive ? 'Online' : 'Offline'}
                </Badge>
              )}
            </div>
            <SparklineChart
              timestamps={timestamps}
              domainMin={0}
              formatValue={formatMs}
              formatTime={formatClockTime}
              series={[
                {
                  key: 'ping',
                  label: 'Latency',
                  color: 'hsl(var(--primary))',
                  values: statsHistory.map((s) => s.pingMs ?? 0),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
