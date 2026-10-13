import { priceState, type WeekdayCell, type WeekdayMetric } from '@/lib/projectWeekday';
import { formatCost, formatTokens } from '@/lib/usageFormat';

// The figures the weekday chart writes. Tooltips, legend, table and summary all read the same
// functions, so one project shows the same numbers wherever it appears.

/** The figure in the chart's metric: tokens, or dollars with a + when some tokens had no price. */
export function primaryText(cell: WeekdayCell, metric: WeekdayMetric): string {
  if (metric === 'tokens') return formatTokens(cell.tokens);
  const state = priceState(cell);
  if (state === 'unpriced') return 'no price';
  return `${formatCost(cell.costUsd) ?? '$0.00'}${state === 'partial' ? '+' : ''}`;
}

/** The other figure, shown beside the primary one, or null when there is none to show. */
export function secondaryText(cell: WeekdayCell, metric: WeekdayMetric): string | null {
  if (!(cell.tokens > 0)) return null;
  if (metric === 'cost') return `${formatTokens(cell.tokens)} tokens`;
  const state = priceState(cell);
  if (state === 'unpriced') return 'no price';
  return `${formatCost(cell.costUsd) ?? '$0.00'}${state === 'partial' ? '+' : ''}`;
}

/** A total in the chart's metric, for the summary and the axis-free figures. */
export function totalText(value: number, metric: WeekdayMetric): string {
  return metric === 'cost' ? (formatCost(value) ?? '$0.00') : formatTokens(value);
}

/** `Oct 13`, read as a calendar day in UTC so no time zone shifts it. */
export function shortDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
