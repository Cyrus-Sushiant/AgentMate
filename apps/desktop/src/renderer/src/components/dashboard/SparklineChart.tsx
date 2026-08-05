import * as React from 'react';
import { createPortal } from 'react-dom';
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
  /**
   * When set, points are positioned by their actual `timestamps` value
   * against a fixed [0, xDomainMax] axis instead of by array index. Use this
   * for a chart that grows live (each new sample lands at its true elapsed
   * time and earlier points never move); omit it for a fixed-length rolling
   * window, where index spacing is already stable.
   */
  xDomainMax?: number;
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
  xDomainMax,
  formatValue,
  formatTime,
  className,
}: SparklineChartProps): React.JSX.Element {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ left: number; top: number } | null>(null);

  const n = timestamps.length;
  const allValues = series.flatMap((s) => s.values);
  const maxVal = domainMax ?? Math.max(domainMin + 1, ...(allValues.length ? allValues : [1]));

  const xAt = (i: number): number => {
    if (xDomainMax != null) return Math.min(1, timestamps[i] / xDomainMax) * VIEW_WIDTH;
    return n <= 1 ? VIEW_WIDTH : (i / (n - 1)) * VIEW_WIDTH;
  };
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

  // The card grid reorders via a framer-motion `layout` transform, which
  // creates a stacking context on each card, so a plain z-index on the tooltip
  // can't escape it, so a tall tooltip (e.g. many per-core series) would
  // render underneath the card in the row below instead of on top of it.
  // Portaling to <body> and positioning in viewport coordinates sidesteps
  // that entirely, and lets the tooltip clamp itself inside the viewport.
  React.useLayoutEffect(() => {
    if (!hovered || !svgRef.current) {
      setTooltipPos(null);
      return;
    }
    const svgRect = svgRef.current.getBoundingClientRect();
    const anchorX = svgRect.left + (xAt(hoverIndex) / VIEW_WIDTH) * svgRect.width;
    const anchorY = svgRect.top;
    const margin = 8;
    const tw = tooltipRef.current?.offsetWidth ?? 0;
    const th = tooltipRef.current?.offsetHeight ?? 0;

    let left = anchorX + margin;
    if (left + tw > window.innerWidth - margin) left = anchorX - tw - margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));

    let top = anchorY;
    if (top + th > window.innerHeight - margin) top = window.innerHeight - th - margin;
    top = Math.max(margin, top);

    setTooltipPos({ left, top });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, hoverIndex, series]);

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
      </svg>
      {hovered &&
        series.map((s) => {
          const leftPct = (xAt(hoverIndex) / VIEW_WIDTH) * 100;
          const topPct = (yAt(s.values[hoverIndex] ?? domainMin) / height) * 100;
          return (
            <div
              key={`dot-${s.key}`}
              className="pointer-events-none absolute h-2 w-2 rounded-full border-2"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: s.color,
                borderColor: 'hsl(var(--card))',
              }}
            />
          );
        })}
      {hovered &&
        createPortal(
          <div
            ref={tooltipRef}
            className="pointer-events-none fixed z-50 min-w-max max-w-[240px] rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
            style={{
              left: tooltipPos?.left ?? 0,
              top: tooltipPos?.top ?? 0,
              visibility: tooltipPos ? 'visible' : 'hidden',
            }}
          >
            {formatTime && (
              <div className="mb-1 text-[10px] text-muted-foreground">
                {formatTime(timestamps[hoverIndex])}
              </div>
            )}
            <div className={cn(series.length > 4 ? 'grid grid-cols-2 gap-x-2 gap-y-0.5' : 'space-y-0.5')}>
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate text-muted-foreground">{s.label}</span>
                  <span className="ml-auto font-medium text-popover-foreground">
                    {formatValue(s.values[hoverIndex] ?? domainMin)}
                  </span>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
