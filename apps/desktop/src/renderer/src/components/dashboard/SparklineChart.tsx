import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SparklineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export interface SparklineChartProps {
  timestamps: number[];
  series: SparklineSeries[];
  height?: number;
  domainMin?: number;
  domainMax?: number;
  formatValue: (value: number) => string;
  formatTime?: (timestamp: number) => string;
  className?: string;
}

const VIEW_WIDTH = 300;
const PAD_Y = 6;

export function SparklineChart({
  timestamps,
  series,
  height = 88,
  domainMin = 0,
  domainMax,
  formatValue,
  formatTime,
  className,
}: SparklineChartProps): React.JSX.Element {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const n = timestamps.length;
  const allValues = series.flatMap((s) => s.values);
  const maxVal = domainMax ?? Math.max(domainMin + 1, ...(allValues.length ? allValues : [1]));

  const xAt = (i: number): number => (n <= 1 ? VIEW_WIDTH : (i / (n - 1)) * VIEW_WIDTH);
  const yAt = (v: number): number => {
    const t = (v - domainMin) / (maxVal - domainMin || 1);
    return height - PAD_Y - t * (height - PAD_Y * 2);
  };

  const linePath = (values: number[]): string =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`).join(' ');

  const areaPath = (values: number[]): string => {
    if (values.length === 0) return '';
    const baseline = height - PAD_Y;
    return `${linePath(values)} L ${xAt(values.length - 1).toFixed(2)} ${baseline} L ${xAt(0).toFixed(2)} ${baseline} Z`;
  };

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, idx)));
  }

  const hovered = hoverIndex !== null && n > 0;
  const tooltipLeftPct = hovered ? (xAt(hoverIndex) / VIEW_WIDTH) * 100 : 0;
  const tooltipFlip = hovered && hoverIndex > (n - 1) / 2;

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label="Time series chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {series.map((s) => (
          <path key={`area-${s.key}`} d={areaPath(s.values)} fill={s.color} fillOpacity={0.1} stroke="none" />
        ))}
        {series.map((s) => (
          <path
            key={`line-${s.key}`}
            d={linePath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hovered && (
          <line
            x1={xAt(hoverIndex)}
            x2={xAt(hoverIndex)}
            y1={PAD_Y}
            y2={height - PAD_Y}
            stroke="hsl(var(--muted-foreground) / 0.4)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {hovered &&
          series.map((s) => (
            <circle
              key={`dot-${s.key}`}
              cx={xAt(hoverIndex)}
              cy={yAt(s.values[hoverIndex] ?? domainMin)}
              r={4}
              fill={s.color}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          ))}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-max rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{
            left: `${tooltipLeftPct}%`,
            transform: tooltipFlip ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)',
          }}
        >
          {formatTime && (
            <div className="mb-1 text-[10px] text-muted-foreground">
              {formatTime(timestamps[hoverIndex])}
            </div>
          )}
          <div className="space-y-0.5">
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium text-popover-foreground">
                  {formatValue(s.values[hoverIndex] ?? domainMin)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
