/**
 * A row's live trend: one series, a 2px line over a faint fill, no axes. The figure it belongs
 * to is printed next to it in text, so the line only says which way things are going.
 */
export function Sparkline({
  values,
  max,
  color,
  className = 'h-6 w-20',
}: {
  values: readonly number[];
  /** The top of the scale; the values' own highest when left out. */
  max?: number;
  color: string;
  className?: string;
}): React.JSX.Element {
  const width = 80;
  const height = 24;
  if (values.length < 2) {
    return <span className={`${className} block rounded bg-secondary/40`} aria-hidden />;
  }
  const top = Math.max(max ?? Math.max(...values), 1e-9);
  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = 2 + (1 - Math.min(1, Math.max(0, value) / top)) * (height - 4);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`${className} block`}
      aria-hidden
    >
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={color} fillOpacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
