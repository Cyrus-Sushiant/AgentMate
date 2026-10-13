// Formatting helpers for the Token Usage cards/widgets.

export function formatTokens(n: number): string {
  if (n <= 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function formatCost(cost: number | null): string | null {
  if (cost == null) return null;
  if (cost > 0 && cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

export function formatPercent(p: number): string {
  return `${Math.round(p)}%`;
}

const COMPACT_UNITS = [
  { size: 1, suffix: '' },
  { size: 1_000, suffix: 'K' },
  { size: 1_000_000, suffix: 'M' },
  { size: 1_000_000_000, suffix: 'B' },
  { size: 1_000_000_000_000, suffix: 'T' },
];

/** Three significant digits and a K, M, B or T suffix: 1.5K, 52.5, 2.5B. Rolls over at 1000. */
function compactNumber(value: number): string {
  let index = 0;
  while (index < COMPACT_UNITS.length - 1 && value >= COMPACT_UNITS[index + 1].size) index += 1;
  let scaled = Number((value / COMPACT_UNITS[index].size).toPrecision(3));
  if (scaled >= 1_000 && index < COMPACT_UNITS.length - 1) {
    index += 1;
    scaled = Number((value / COMPACT_UNITS[index].size).toPrecision(3));
  }
  return `${scaled}${COMPACT_UNITS[index].suffix}`;
}

/** A token count for a chart axis, where a few digits matter more than an exact figure. */
export function formatTokensAxis(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return compactNumber(value);
}

/** A dollar amount for a chart axis, such as $0.75, $52.5 or $1.2K. */
export function formatCostAxis(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  return `$${compactNumber(value)}`;
}

/** One part's share of a total as a whole percentage, or "<1%" for a sliver. */
export function formatShare(part: number, total: number): string {
  if (!(part > 0) || !(total > 0)) return '0%';
  const share = (part / total) * 100;
  return share < 1 ? '<1%' : `${Math.round(share)}%`;
}

/** Bare "2d 4h" / "38m" countdown for tight layouts, or null when unknown. */
export function formatCountdown(resetAt: string | null | undefined): string | null {
  const full = formatReset(resetAt);
  if (full === null) return null;
  return full.startsWith('resets in ') ? full.slice('resets in '.length) : full;
}

/** "resets in 2d 4h" / "resets in 38m" style countdown, or null when unknown. */
export function formatReset(resetAt: string | null | undefined): string | null {
  if (!resetAt) return null;
  const ms = new Date(resetAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 'resetting…';
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  if (days > 0) return `resets in ${days}d ${hours}h`;
  if (hours > 0) return `resets in ${hours}h ${minutes}m`;
  return `resets in ${minutes}m`;
}
