import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Chip, FOOTER_HAIRLINE } from '@/components/pageKit';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  type ChartColumn,
  type ChartModel,
  type ChartSeries,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  type WeekdayRange,
  type WeekInfo,
} from '@/lib/projectWeekday';
import { formatCostAxis, formatTokensAxis } from '@/lib/usageFormat';
import { cn } from '@/lib/utils';
import { primaryText, secondaryText, shortDate, totalText } from './format';

// The columns of the chart: one per weekday, a segment per project, a tooltip per column. The bars
// are plain elements sized by percentage, so the layout holds at any width without measuring.

/** A soft top light on every segment, so the fills read as material rather than flat blocks. */
const SHEEN = 'linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0) 70%)';
const OTHER_COLOR = 'hsl(var(--muted-foreground) / 0.55)';
const DIMMED = 0.3;

interface WeekdayPlotProps {
  model: ChartModel;
  order: readonly number[];
  week: WeekInfo;
  range: WeekdayRange;
  /** The weekday of today, or null when the window has no end day. */
  today: number | null;
  /** The days that fall on each weekday, oldest first. */
  dates: readonly (readonly string[])[];
  colorOf: (series: ChartSeries) => string;
  emphasis: string | null;
  onEmphasis: (key: string | null) => void;
}

export function colorFor(series: ChartSeries, palette: readonly string[]): string {
  return series.slot === null ? OTHER_COLOR : (palette[series.slot] ?? OTHER_COLOR);
}

function columnLabel(
  column: ChartColumn,
  model: ChartModel,
  flags: { isToday: boolean; isWeekend: boolean },
  dates: readonly string[],
  range: WeekdayRange,
): string {
  const name = WEEKDAY_NAMES[column.weekday];
  const when = [flags.isToday ? 'today' : null, flags.isWeekend ? 'weekend' : null]
    .filter(Boolean)
    .map((part) => `, ${part}`)
    .join('');
  const day = range === 7 && dates[0] ? ` (${shortDate(dates[0])})` : '';
  const total = totalText(column.total, model.metric);
  const parts = column.segments.map(
    (segment) => `${segment.series.name} ${totalText(segment.value, model.metric)}`,
  );
  const average =
    range === 28 && column.total > 0
      ? `, average ${totalText(column.total / model.occurrences, model.metric)} per ${name}`
      : '';
  return `${name}${day}${when}. Total ${total}${average}.${parts.length ? ` ${parts.join(', ')}.` : ''}`;
}

function WeekdayTip({
  column,
  model,
  flags,
  dates,
  range,
  colorOf,
}: {
  column: ChartColumn;
  model: ChartModel;
  flags: { isToday: boolean; isWeekend: boolean };
  dates: readonly string[];
  range: WeekdayRange;
  colorOf: (series: ChartSeries) => string;
}): React.JSX.Element {
  const name = WEEKDAY_NAMES[column.weekday];
  const rows = model.series.filter((series) => series.cells[column.weekday].tokens > 0);
  return (
    <div className="min-w-44 space-y-2 text-left">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">
          {name}
          {range === 7 && dates[0] ? (
            <span className="font-normal text-muted-foreground"> · {shortDate(dates[0])}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 gap-1">
          {flags.isToday ? <Chip tone="primary">Today</Chip> : null}
          {flags.isWeekend ? <Chip>Weekend</Chip> : null}
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((series) => {
          const cell = series.cells[column.weekday];
          const note = secondaryText(cell, model.metric);
          return (
            <div key={series.key} className="flex items-center gap-2">
              <span
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: colorOf(series) }}
              />
              <span className="font-semibold tabular-nums">{primaryText(cell, model.metric)}</span>
              <span className="min-w-0 truncate text-muted-foreground">{series.name}</span>
              {note ? (
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {note}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className={cn('flex items-center justify-between pt-1.5', FOOTER_HAIRLINE)}>
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold tabular-nums">{totalText(column.total, model.metric)}</span>
      </div>
      {range === 28 && column.total > 0 ? (
        <div className="text-[10px] text-muted-foreground">
          Average {totalText(column.total / model.occurrences, model.metric)} per {name}
        </div>
      ) : null}
    </div>
  );
}

export function WeekdayPlot({
  model,
  order,
  week,
  range,
  today,
  dates,
  colorOf,
  emphasis,
  onEmphasis,
}: WeekdayPlotProps): React.JSX.Element {
  const reduce = useReducedMotion();
  // Columns start flat and rise once mounted, so a card that appears does not just pop in. Reduced
  // motion starts them at their height.
  const [armed, setArmed] = useState(Boolean(reduce));
  useEffect(() => {
    if (reduce) {
      setArmed(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setArmed(true), 40);
    return () => window.clearTimeout(timer);
  }, [reduce]);

  const busiestAt = model.busiest ? Math.max(0, order.indexOf(model.busiest.weekday)) : 0;
  const [focusAt, setFocusAt] = useState(busiestAt);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const { max, ticks } = model.scale;
  const at = (value: number): string => `${(value / max) * 100}%`;
  const axisLabel = (value: number): string =>
    model.metric === 'cost' ? formatCostAxis(value) : formatTokensAxis(value);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const last = order.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = focusAt >= last ? 0 : focusAt + 1;
        break;
      case 'ArrowLeft':
        next = focusAt <= 0 ? last : focusAt - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setFocusAt(next);
    slots.current[next]?.focus();
  }

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
        <div className="relative h-56 sm:h-72" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 text-[10px] leading-none tabular-nums text-muted-foreground"
              style={{ bottom: at(tick) }}
            >
              {axisLabel(tick)}
            </span>
          ))}
        </div>

        <div className="relative h-56 sm:h-72">
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden
              className={cn(
                'absolute inset-x-0 h-px',
                tick === 0 ? 'bg-foreground/15' : 'bg-foreground/[0.07]',
              )}
              style={{ bottom: at(tick) }}
            />
          ))}

          <div
            role="group"
            aria-label="Usage by weekday"
            onKeyDown={onKeyDown}
            className="absolute inset-0 grid grid-cols-7 gap-1.5 sm:gap-2"
          >
            {model.columns.map((column, index) => {
              const flags = {
                isToday: today === column.weekday,
                isWeekend: week.weekend.includes(column.weekday),
              };
              const label = columnLabel(column, model, flags, dates[column.weekday] ?? [], range);
              return (
                <SimpleTooltip
                  key={column.weekday}
                  side="top"
                  delayDuration={0}
                  label={
                    <WeekdayTip
                      column={column}
                      model={model}
                      flags={flags}
                      dates={dates[column.weekday] ?? []}
                      range={range}
                      colorOf={colorOf}
                    />
                  }
                >
                  <div
                    ref={(node) => {
                      slots.current[index] = node;
                    }}
                    role="img"
                    aria-label={label}
                    tabIndex={index === focusAt ? 0 : -1}
                    onFocus={() => setFocusAt(index)}
                    data-weekday={column.weekday}
                    data-today={flags.isToday || undefined}
                    data-weekend={flags.isWeekend || undefined}
                    className={cn(
                      'flex h-full min-w-0 cursor-default items-end justify-center rounded-xl outline-none transition-colors hover:bg-foreground/[0.045] focus-visible:ring-2 focus-visible:ring-ring',
                      flags.isWeekend && 'bg-foreground/[0.03]',
                    )}
                  >
                    <div
                      className="flex w-full max-w-6 flex-col-reverse gap-[2px] transition-[height] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        height: armed ? at(column.total) : '0%',
                        transitionDelay: `${index * 40}ms`,
                      }}
                    >
                      {column.segments.map((segment, s) => (
                        <div
                          key={segment.series.key}
                          data-series={segment.series.key}
                          data-value={segment.value}
                          className={cn(
                            'min-h-[3px] w-full transition-opacity duration-200',
                            s === column.segments.length - 1 && 'rounded-t-[6px]',
                          )}
                          style={{
                            flexGrow: segment.value,
                            flexBasis: 0,
                            backgroundColor: colorOf(segment.series),
                            backgroundImage: SHEEN,
                            opacity: emphasis && emphasis !== segment.series.key ? DIMMED : 1,
                          }}
                          onPointerEnter={() => onEmphasis(segment.series.key)}
                          onPointerLeave={() => onEmphasis(null)}
                        />
                      ))}
                    </div>
                  </div>
                </SimpleTooltip>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
        <span aria-hidden />
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {order.map((weekday) => {
            const isToday = today === weekday;
            const isWeekend = week.weekend.includes(weekday);
            return (
              <span
                key={weekday}
                className={cn(
                  'text-center text-[11px] font-medium',
                  isToday && 'font-semibold text-primary',
                  !isToday && isWeekend && 'text-muted-foreground/60',
                  !isToday && !isWeekend && 'text-muted-foreground',
                )}
              >
                {WEEKDAY_SHORT[weekday]}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
