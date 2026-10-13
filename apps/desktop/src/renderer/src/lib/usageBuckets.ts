import type { ProjectUsageDay } from '@shared/apiTypes';

// The bars of a project's spend chart. Every day of the period gets one, quiet days included, so
// the gaps show; a long period is summed into weeks so the bars stay wide enough to hover.

/** One bar: a day, or a week of days, summed. */
export interface ChartBar {
  /** `YYYY-MM-DD` of its first day. */
  from: string;
  /** Its last day; the same as `from` for a day. */
  to: string;
  tokens: number;
  /** Null when none of its days has a cost. */
  costUsd: number | null;
}

export interface Chart {
  grain: 'day' | 'week';
  bars: ChartBar[];
}

export type ChartMetric = 'cost' | 'tokens';

/** A period longer than this many days is drawn a week to a bar. */
const MAX_DAILY_BARS = 62;

const DAYS_PER_WEEK = 7;

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The keys from `start` to `end` inclusive. Stepped by calendar day, so DST cannot skip one. */
function daysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const last = dayKey(end);
  const cursor = new Date(start);
  while (dayKey(cursor) <= last) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function sumBar(from: string, to: string, days: (ProjectUsageDay | undefined)[]): ChartBar {
  let tokens = 0;
  let costUsd: number | null = null;
  for (const day of days) {
    if (!day) continue;
    tokens += day.tokens;
    if (day.costUsd !== null) costUsd = (costUsd ?? 0) + day.costUsd;
  }
  return { from, to, tokens, costUsd };
}

/**
 * The bars for the last `days` days ending today, or, for null, from the first day with spend to
 * today. `byDay` only has days that had spend.
 */
export function buildChart(
  byDay: readonly ProjectUsageDay[],
  days: number | null,
  today: Date,
): Chart {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start: Date;
  if (days !== null) {
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
  } else {
    const first = byDay.map((d) => d.day).sort()[0];
    if (!first) return { grain: 'day', bars: [] };
    start = parseDay(first);
    if (start > end) start = end;
  }

  const spent = new Map(byDay.map((d) => [d.day, d]));
  const keys = daysBetween(start, end);
  if (keys.length <= MAX_DAILY_BARS) {
    return { grain: 'day', bars: keys.map((key) => sumBar(key, key, [spent.get(key)])) };
  }

  const bars: ChartBar[] = [];
  for (let from = 0; from < keys.length; from += DAYS_PER_WEEK) {
    const week = keys.slice(from, from + DAYS_PER_WEEK);
    bars.push(
      sumBar(
        week[0],
        week[week.length - 1],
        week.map((key) => spent.get(key)),
      ),
    );
  }
  return { grain: 'week', bars };
}

/** What a bar's height shows. A day with no known cost counts as none. */
export function barValue(bar: ChartBar, metric: ChartMetric): number {
  return metric === 'cost' ? (bar.costUsd ?? 0) : bar.tokens;
}

/** The index of the biggest bar, or null when every bar is empty. */
export function peakIndex(bars: readonly ChartBar[], metric: ChartMetric): number | null {
  let best: number | null = null;
  let max = 0;
  bars.forEach((bar, i) => {
    const value = barValue(bar, metric);
    if (value > max) {
      max = value;
      best = i;
    }
  });
  return best;
}

/** Whether any day has a cost to draw; if not, the chart can only show tokens. */
export function hasCost(byDay: readonly ProjectUsageDay[]): boolean {
  return byDay.some((d) => d.costUsd !== null);
}

/** `Sep 7`, or `Sep 7, 2026` when the chart spans more than a year. */
export function formatDayLabel(day: string, withYear = false): string {
  return parseDay(day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** A day by its date, a week by its first and last day. */
export function barRangeLabel(bar: ChartBar, withYear = false): string {
  const from = formatDayLabel(bar.from, withYear);
  return bar.from === bar.to ? from : `${from} to ${formatDayLabel(bar.to, withYear)}`;
}
