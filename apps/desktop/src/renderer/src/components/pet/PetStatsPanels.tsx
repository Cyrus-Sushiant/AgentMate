import { useSystemStatsHistory } from '@/hooks/useSystemStatsHistory';
import { useChartColors } from '@/lib/chartColors';

/** Samples shell out to the OS, so the card polls slower than the dashboard. */
const PET_SAMPLE_INTERVAL_MS = 2500;
const PET_MAX_SAMPLES = 40;

const CHART_W = 244;
const CHART_H = 40;

export interface PetChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatRate(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * Lines only, no axes: the card is 268px wide, so tick labels would cost more
 * room than they explain. `max` pins the scale for percent charts; leave it
 * out and the chart scales to its own peak.
 */
function PetMiniChart({
  series,
  max,
}: {
  series: PetChartSeries[];
  max?: number;
}): React.JSX.Element {
  const peak = max ?? Math.max(1, ...series.flatMap((s) => s.values));
  const points = Math.max(...series.map((s) => s.values.length), 0);

  if (points < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-muted-foreground"
        style={{ height: CHART_H }}
      >
        Sampling…
      </div>
    );
  }

  function pathFor(values: number[]): string {
    return values
      .map((value, index) => {
        const x = (index / (points - 1)) * CHART_W;
        const y = CHART_H - 3 - (Math.min(value, peak) / peak) * (CHART_H - 6);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full"
      style={{ height: CHART_H }}
      aria-hidden
    >
      {series.map((line) => (
        <path
          key={line.key}
          d={pathFor(line.values)}
          fill="none"
          stroke={line.color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function PetChartLegend({ series }: { series: PetChartSeries[] }): React.JSX.Element {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
      {series.map((line) => (
        <span key={line.key} className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-2.5 rounded-full"
            style={{ backgroundColor: line.color }}
          />
          {line.label}
        </span>
      ))}
    </div>
  );
}

function PetStatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md bg-foreground/5 px-2 py-1.5">
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-[11px] text-foreground">{value}</p>
    </div>
  );
}

/** CPU, memory, GPU and disk activity, sampled while the card is open. */
export function PetSystemPanel(): React.JSX.Element {
  const chartColors = useChartColors();
  const history = useSystemStatsHistory({
    intervalMs: PET_SAMPLE_INTERVAL_MS,
    maxSamples: PET_MAX_SAMPLES,
  });
  const latest = history.at(-1);

  if (!latest) {
    return <p className="mt-4 text-xs text-muted-foreground">Reading system state…</p>;
  }

  // One line per resource, all on the same 0-100 scale. The GPU line is the
  // busiest adapter, which is what the disk/GPU tiles below summarize too.
  const gpuPercentAt = (index: number): number => {
    const gpus = history[index].gpus;
    return gpus.length > 0 ? Math.max(...gpus.map((gpu) => gpu.percent)) : 0;
  };
  const hasGpu = latest.gpus.length > 0;
  const series: PetChartSeries[] = [
    {
      key: 'cpu',
      label: 'CPU',
      color: chartColors.categorical[1],
      values: history.map((sample) => sample.cpuPercent),
    },
    {
      key: 'mem',
      label: 'RAM',
      color: chartColors.categorical[0],
      values: history.map((sample) => sample.memPercent),
    },
    ...(hasGpu
      ? [
          {
            key: 'gpu',
            label: 'GPU',
            color: chartColors.categorical[2],
            values: history.map((_sample, index) => gpuPercentAt(index)),
          },
        ]
      : []),
  ];

  const diskBytesPerSec = latest.disks.reduce(
    (total, disk) => total + disk.readBytesPerSec + disk.writeBytesPerSec,
    0,
  );
  const gpu = hasGpu
    ? latest.gpus.reduce((busiest, item) => (item.percent > busiest.percent ? item : busiest))
    : null;

  return (
    <>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CPU</p>
          <p className="font-mono text-2xl leading-none text-foreground">
            {formatPercent(latest.cpuPercent)}
          </p>
        </div>
        <p className="truncate text-[10px] text-muted-foreground">
          {latest.cpuCoreCount} cores · RAM {formatPercent(latest.memPercent)}
        </p>
      </div>

      <div className="mt-2">
        <PetMiniChart series={series} max={100} />
        <PetChartLegend series={series} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <PetStatTile label="Memory" value={`${formatBytes(latest.memUsedBytes)} used`} />
        <PetStatTile label="Of total" value={formatBytes(latest.memTotalBytes)} />
        <PetStatTile
          label={gpu ? gpu.label : 'GPU'}
          value={gpu ? formatPercent(gpu.percent) : 'Not reported'}
        />
        <PetStatTile
          label={latest.disks.length > 0 ? 'Disk I/O' : 'Disk'}
          value={latest.disks.length > 0 ? formatRate(diskBytesPerSec) : 'Not reported'}
        />
      </div>
    </>
  );
}

/** Throughput plus the ping targets configured on the Dashboard. */
export function PetNetworkPanel(): React.JSX.Element {
  const chartColors = useChartColors();
  const history = useSystemStatsHistory({
    intervalMs: PET_SAMPLE_INTERVAL_MS,
    maxSamples: PET_MAX_SAMPLES,
  });
  const latest = history.at(-1);

  if (!latest) {
    return <p className="mt-4 text-xs text-muted-foreground">Reading network…</p>;
  }

  const series: PetChartSeries[] = [
    {
      key: 'rx',
      label: 'Down',
      color: chartColors.green,
      values: history.map((sample) => sample.netRxBytesPerSec),
    },
    {
      key: 'tx',
      label: 'Up',
      color: chartColors.blue,
      values: history.map((sample) => sample.netTxBytesPerSec),
    },
  ];

  const pings = latest.pings;
  const online = pings.filter((ping) => ping.alive).length;

  return (
    <>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Download</p>
          <p className="font-mono text-2xl leading-none text-foreground">
            {formatRate(latest.netRxBytesPerSec)}
          </p>
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          ↑ {formatRate(latest.netTxBytesPerSec)}
        </p>
      </div>

      <div className="mt-2">
        <PetMiniChart series={series} />
        <PetChartLegend series={series} />
      </div>

      {pings.length > 0 ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PetStatTile label="Targets online" value={`${online}/${pings.length}`} />
            <PetStatTile label="Upload" value={formatRate(latest.netTxBytesPerSec)} />
          </div>
          <ul className="mt-2 space-y-1">
            {pings.slice(0, 3).map((ping) => (
              <li key={ping.host} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: ping.alive ? chartColors.green : 'hsl(var(--destructive))',
                    }}
                  />
                  <span className="truncate">{ping.host}</span>
                </span>
                <span className="font-mono text-foreground">
                  {ping.latencyMs == null ? 'offline' : `${ping.latencyMs} ms`}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No ping targets yet. Add some in Settings to watch them from here.
        </p>
      )}
    </>
  );
}
