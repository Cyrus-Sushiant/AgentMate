import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  metricValue,
  priceState,
  WEEKDAY_SHORT,
  type WeekdayCell,
  type WeekdayMetric,
  type WeekdayProject,
  type WeekdayRange,
} from '@/lib/projectWeekday';
import { cn } from '@/lib/utils';
import { secondaryText, totalText } from './format';

// The accessible twin of the chart: every project, unfolded, against every weekday. Each cell is
// shaded by its size, and an empty day is a dot rather than a zero.

/** How many rows show before the rest wait behind a button. */
const FIRST_ROWS = 15;

function cellContent(cell: WeekdayCell, metric: WeekdayMetric): string {
  if (metric === 'cost' && priceState(cell) === 'unpriced') return 'no price';
  const value = metricValue(cell, metric);
  if (value <= 0) return '·';
  return totalText(value, metric);
}

export function WeekdayTable({
  projects,
  names,
  order,
  metric,
  range,
}: {
  projects: readonly WeekdayProject[];
  names: ReadonlyMap<string, string>;
  order: readonly number[];
  metric: WeekdayMetric;
  range: WeekdayRange;
}): React.JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...projects].sort(
    (a, b) => metricValue(b, metric) - metricValue(a, metric) || a.name.localeCompare(b.name),
  );
  const visible = showAll ? sorted : sorted.slice(0, FIRST_ROWS);
  const largest = Math.max(
    0,
    ...sorted.flatMap((project) => project.cells.map((cell) => metricValue(cell, metric))),
  );
  const columnTotals = order.map((weekday) =>
    sorted.reduce((sum, project) => sum + metricValue(project.cells[weekday], metric), 0),
  );
  const grandTotal = columnTotals.reduce((sum, value) => sum + value, 0);
  const caption = `${metric === 'cost' ? 'Estimated cost' : 'Tokens'} by project and weekday, last ${
    range === 7 ? '7 days' : '4 weeks'
  }`;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl ring-1 ring-inset ring-foreground/[0.07]">
        <table className="w-full min-w-[32rem] border-separate border-spacing-0 text-[11px] tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-[1] bg-card px-3 py-2 text-left font-medium text-muted-foreground"
              >
                Project
              </th>
              {order.map((weekday) => (
                <th
                  key={weekday}
                  scope="col"
                  className="px-2 py-2 text-right font-medium text-muted-foreground"
                >
                  {WEEKDAY_SHORT[weekday]}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((project) => {
              const total = metricValue(project, metric);
              return (
                <tr key={project.key}>
                  <th
                    scope="row"
                    dir="auto"
                    className="sticky left-0 z-[1] max-w-[11rem] truncate bg-card px-3 py-1.5 text-left font-medium"
                  >
                    {names.get(project.key) ?? project.name}
                  </th>
                  {order.map((weekday) => {
                    const cell = project.cells[weekday];
                    const value = metricValue(cell, metric);
                    const note = secondaryText(cell, metric);
                    return (
                      <td key={weekday} className="relative px-2 py-1.5 text-right">
                        <span
                          aria-hidden
                          className="absolute inset-0.5 rounded-md bg-primary"
                          style={{
                            opacity: value > 0 && largest > 0 ? 0.06 + 0.5 * (value / largest) : 0,
                          }}
                        />
                        <span className={cn('relative', value <= 0 && 'text-muted-foreground/60')}>
                          {cellContent(cell, metric)}
                        </span>
                        {note ? (
                          <span className="relative block text-[10px] text-muted-foreground">
                            {note}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right font-semibold">
                    {metric === 'cost' && priceState(project) === 'unpriced'
                      ? 'no price'
                      : totalText(total, metric)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-2 text-left">
                All projects
              </th>
              {columnTotals.map((value, index) => (
                <td key={order[index]} className="px-2 py-2 text-right">
                  {value > 0 ? totalText(value, metric) : '·'}
                </td>
              ))}
              <td className="px-3 py-2 text-right">{totalText(grandTotal, metric)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {sorted.length > FIRST_ROWS ? (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${sorted.length} projects`}
        </Button>
      ) : null}
    </div>
  );
}
