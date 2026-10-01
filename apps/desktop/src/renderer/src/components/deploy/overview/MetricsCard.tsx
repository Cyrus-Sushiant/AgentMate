import { coreErrorMessage } from '@shared/coreErrors';
import type { MetricsSample } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ChartSimple, Table } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartColors } from '@/lib/chartColors';
import {
  formatAxisTime,
  formatPointTime,
  formatRate,
  type MetricsRange,
  memoryPercent,
  niceRateMax,
  RANGES,
  rangeOption,
  wholePercent,
} from '@/lib/deploy/overview/metrics';
import { formatPercent } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { type ChartSeries, MetricChart } from './MetricChart';

/** The table view keeps to the newest readings, so a 30-day range stays a page long. */
const TABLE_ROWS = 60;

interface ChartSpec {
  key: string;
  title: string;
  series: Array<{ key: string; label: string; pick: (sample: MetricsSample) => number }>;
  percent: boolean;
}

const CHARTS: ChartSpec[] = [
  {
    key: 'cpu',
    title: 'Processor',
    percent: true,
    series: [{ key: 'cpu', label: 'Busy', pick: (sample) => sample.cpuPercent }],
  },
  {
    key: 'memory',
    title: 'Memory',
    percent: true,
    series: [{ key: 'memory', label: 'In use', pick: memoryPercent }],
  },
  {
    key: 'network',
    title: 'Network',
    percent: false,
    series: [
      { key: 'rx', label: 'Received', pick: (sample) => sample.networkReceiveBytesPerSecond },
      { key: 'tx', label: 'Sent', pick: (sample) => sample.networkTransmitBytesPerSecond },
    ],
  },
  {
    key: 'disk',
    title: 'Disk activity',
    percent: false,
    series: [
      { key: 'read', label: 'Read', pick: (sample) => sample.diskReadBytesPerSecond },
      { key: 'write', label: 'Written', pick: (sample) => sample.diskWriteBytesPerSecond },
    ],
  },
];

function Legend({ series }: { series: ChartSeries[] }): React.JSX.Element | null {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-3 text-[11px] text-muted-foreground" aria-label="Legend">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ReadingsTable({ samples, spanMs }: { samples: MetricsSample[]; spanMs: number }) {
  const rows = samples.slice(-TABLE_ROWS).reverse();
  return (
    <div className="overflow-x-auto">
      {samples.length > TABLE_ROWS && (
        <p className="mb-2 text-xs text-muted-foreground">
          The newest {TABLE_ROWS} of {samples.length} readings.
        </p>
      )}
      <table className="w-full text-xs tabular-nums" aria-label="Readings">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 pr-3 font-medium">Time</th>
            <th className="py-1 pr-3 font-medium">Processor</th>
            <th className="py-1 pr-3 font-medium">Memory</th>
            <th className="py-1 pr-3 font-medium">Received</th>
            <th className="py-1 pr-3 font-medium">Sent</th>
            <th className="py-1 pr-3 font-medium">Read</th>
            <th className="py-1 font-medium">Written</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sample) => (
            <tr key={sample.atUnixMs} className="border-t border-border/60">
              <td className="py-1 pr-3">{formatPointTime(sample.atUnixMs, spanMs)}</td>
              <td className="py-1 pr-3">{formatPercent(sample.cpuPercent)}</td>
              <td className="py-1 pr-3">{wholePercent(memoryPercent(sample))}</td>
              <td className="py-1 pr-3">{formatRate(sample.networkReceiveBytesPerSecond)}</td>
              <td className="py-1 pr-3">{formatRate(sample.networkTransmitBytesPerSecond)}</td>
              <td className="py-1 pr-3">{formatRate(sample.diskReadBytesPerSecond)}</td>
              <td className="py-1">{formatRate(sample.diskWriteBytesPerSecond)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The server's history: processor, memory, network and disk, live for the last 15 minutes or
 * from the core's stored minutes and quarter hours for longer. Changing the range keeps the
 * charts on screen, dimmed, until the new readings are in.
 */
export function MetricsCard({
  serverId,
  live,
  liveReady,
  liveError,
  stale,
}: {
  serverId: string;
  live: MetricsSample[];
  liveReady: boolean;
  liveError: string | null;
  /** The connection is down for now: keep what is on screen, dimmed. */
  stale: boolean;
}): React.JSX.Element {
  const [range, setRange] = useState<MetricsRange>('live');
  const [table, setTable] = useState(false);
  const { categorical } = useChartColors();
  const option = rangeOption(range);

  const history = useQuery({
    queryKey: queryKeys.deployMetricsHistory(serverId, range),
    queryFn: () =>
      window.agentmat.deploySystem.metricsHistory({
        serverId,
        resolution: option.resolution,
        fromUnixMs: Date.now() - option.spanMs,
      }),
    enabled: range !== 'live',
    refetchInterval: option.refreshMs ?? false,
    placeholderData: (previous) => previous,
  });

  const samples = range === 'live' ? live : (history.data?.samples ?? []);
  const loading = range === 'live' ? !liveReady : history.isPending;
  const error =
    range === 'live' ? liveError : history.isError ? coreErrorMessage(history.error) : null;
  const dimmed = stale || (range !== 'live' && history.isPlaceholderData);
  const times = samples.map((sample) => sample.atUnixMs);

  return (
    <Card className="glass">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <ChartSimple className="h-4 w-4 text-primary" /> History
          </CardTitle>
          <CardDescription>Showing {option.description}.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Range"
            className="flex rounded-lg border border-border p-0.5"
          >
            {RANGES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={item.value === range}
                onClick={() => setRange(item.value)}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  item.value === range
                    ? 'bg-primary/12 text-foreground shadow-[inset_0_-2px_0_hsl(var(--primary))]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={table}
            onClick={() => setTable((current) => !current)}
          >
            {table ? <ChartSimple className="h-3.5 w-3.5" /> : <Table className="h-3.5 w-3.5" />}
            {table ? 'Charts' : 'Table'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
            {CHARTS.map((chart) => (
              <Skeleton key={chart.key} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : error && samples.length === 0 ? (
          <p role="alert" className="text-sm text-muted-foreground">
            The readings did not load: {error}
          </p>
        ) : samples.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {range === 'live'
              ? 'Waiting for the first reading from the server.'
              : 'No readings stored for this range yet. The core keeps them from the time it was installed.'}
          </p>
        ) : table ? (
          <div className={cn('transition-opacity', dimmed && 'opacity-50')}>
            <ReadingsTable samples={samples} spanMs={option.spanMs} />
          </div>
        ) : (
          <div
            className={cn('grid gap-6 transition-opacity md:grid-cols-2', dimmed && 'opacity-50')}
          >
            {CHARTS.map((chart) => {
              const series: ChartSeries[] = chart.series.map((item, slot) => ({
                key: item.key,
                label: item.label,
                color: categorical[slot],
                values: samples.map(item.pick),
              }));
              const yMax = chart.percent ? 100 : niceRateMax(series.flatMap((item) => item.values));
              const format = chart.percent ? formatPercent : formatRate;
              return (
                <div key={chart.key} className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground">{chart.title}</h4>
                    <Legend series={series} />
                  </div>
                  <MetricChart
                    title={chart.title}
                    times={times}
                    series={series}
                    yMax={yMax}
                    formatValue={format}
                    formatTick={chart.percent ? wholePercent : formatRate}
                    formatTime={(at) => formatPointTime(at, option.spanMs)}
                    axisTimes={(at) => formatAxisTime(at, option.spanMs)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
