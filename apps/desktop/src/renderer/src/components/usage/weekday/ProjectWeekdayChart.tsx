import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChartColumn, RefreshCw, Table, TriangleAlert } from '@/components/icons';
import {
  EmptyState,
  FOOTER_HAIRLINE,
  type PillTabItem,
  PillTabs,
  SECTION_WELL,
} from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CountUp } from '@/components/usage/CountUp';
import { useProjectDaily } from '@/hooks/useProjectDaily';
import { useChartColors } from '@/lib/chartColors';
import {
  assignSlots,
  buildChartModel,
  type ChartSeries,
  displayNames,
  foldWeekdays,
  hasPricedTokens,
  localeWeekInfo,
  OTHER_KEY,
  rankProjects,
  UNKNOWN_KEY,
  WEEKDAY_NAMES,
  type WeekdayMetric,
  type WeekdayRange,
  type WeekInfo,
  weekdayOfDay,
  weekdayOrder,
} from '@/lib/projectWeekday';
import { formatShare } from '@/lib/usageFormat';
import { cn } from '@/lib/utils';
import { totalText } from './format';
import { ProjectLegend } from './ProjectLegend';
import { colorFor, WeekdayPlot } from './WeekdayPlot';
import { WeekdayTable } from './WeekdayTable';

// "Projects by weekday": tokens and estimated cost for each project, by day of the week, over the
// last 7 days or 4 weeks. The chart is the default view, and the table is its accessible twin.

type ViewMode = 'chart' | 'table';

const METRIC_ITEMS: PillTabItem<WeekdayMetric>[] = [
  { value: 'tokens', label: 'Tokens' },
  { value: 'cost', label: 'Cost' },
];

const RANGE_ITEMS: PillTabItem<'7' | '28'>[] = [
  { value: '7', label: '7 days' },
  { value: '28', label: '4 weeks' },
];

const VIEW_ITEMS: PillTabItem<ViewMode>[] = [
  { value: 'chart', label: 'Chart', icon: <ChartColumn /> },
  { value: 'table', label: 'Table', icon: <Table /> },
];

/** The colour a project keeps while it stays on the chart, even as other projects come and go. */
function useStableSlots(keys: readonly string[]): Map<string, number> {
  const memory = useRef(new Map<string, number>());
  const assigned = assignSlots(memory.current, keys);
  useEffect(() => {
    for (const [key, slot] of assigned) memory.current.set(key, slot);
  });
  return assigned;
}

function Tile({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string | null;
}): React.JSX.Element {
  return (
    <div className={cn(SECTION_WELL, 'min-w-0')}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 truncate text-base font-semibold tabular-nums">{children}</div>
      {note ? <p className="truncate text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-xl bg-destructive/[0.05] px-3 py-2.5 text-sm text-destructive ring-1 ring-inset ring-destructive/30"
    >
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">Project usage could not be loaded.</span>
      <Button size="sm" variant="soft" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}

function ChartSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="Loading project usage" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-60 w-full" />
    </div>
  );
}

function RangeEmpty({
  message,
  action,
}: {
  message: string;
  action: { label: string; run: () => void } | null;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action ? (
        <Button size="sm" variant="soft" onClick={action.run}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function ProjectWeekdayChart({
  className,
  weekInfo,
}: {
  className?: string;
  /** The week the chart starts its columns on and shades. Defaults to the locale's. */
  weekInfo?: WeekInfo;
}): React.JSX.Element {
  const { isPending, isError, split, isFetching, retry } = useProjectDaily();
  const [metricChoice, setMetricChoice] = useState<WeekdayMetric>('tokens');
  const [range, setRange] = useState<WeekdayRange>(28);
  const [view, setView] = useState<ViewMode>('chart');
  const [solo, setSolo] = useState<string | null>(null);
  const [emphasis, setEmphasis] = useState<string | null>(null);
  const palette = useChartColors().categorical;
  const week = useMemo(() => weekInfo ?? localeWeekInfo(), [weekInfo]);
  const order = useMemo(() => weekdayOrder(week.firstDay), [week.firstDay]);

  const priced = hasPricedTokens(split);
  // Without any priced token the cost view would be all zeros, so the tokens view is what is shown.
  const metric: WeekdayMetric = priced ? metricChoice : 'tokens';
  const fold = useMemo(() => (split ? foldWeekdays(split, range) : null), [split, range]);
  const ranking = useMemo(() => (fold ? rankProjects(fold.projects) : null), [fold]);
  const slots = useStableSlots(ranking ? ranking.named.map((project) => project.key) : []);
  const names = useMemo(
    () =>
      displayNames(
        (fold?.projects ?? []).map((project) => ({
          key: project.key,
          name: project.name,
          path: project.path,
        })),
      ),
    [fold],
  );
  const model =
    fold && ranking
      ? buildChartModel({
          projects: fold.projects,
          ranking,
          slots,
          metric,
          range,
          order,
          solo,
          names,
        })
      : null;

  // A soloed project that dropped out of view (for instance when the range changed) is shown again.
  useEffect(() => {
    if (solo && model && !model.allSeries.some((series) => series.key === solo)) setSolo(null);
  }, [solo, model]);

  const today = split ? weekdayOfDay(split.endDay) : null;
  const colorOf = (series: ChartSeries): string => colorFor(series, palette);
  const rangeName = range === 7 ? 'last 7 days' : 'last 4 weeks';

  function toggleSolo(key: string): void {
    setSolo((current) => (current === key ? null : key));
  }

  let body: React.ReactNode;
  if (isPending && !split) {
    body = <ChartSkeleton />;
  } else if (isError && !split) {
    body = <LoadError onRetry={retry} />;
  } else if (!split || split.projects.length === 0 || !fold || !model) {
    body = (
      <EmptyState
        size="sm"
        icon={CalendarDays}
        title="No project usage yet"
        description="Once Claude Code or Codex works in a project folder, its tokens and estimated cost show up here by weekday."
      />
    );
  } else if (fold.projects.length === 0) {
    body = (
      <RangeEmpty
        message={`Nothing was used in the ${rangeName}.`}
        action={range === 7 ? { label: 'Show 4 weeks', run: () => setRange(28) } : null}
      />
    );
  } else if (model.allTotal <= 0) {
    body = (
      <RangeEmpty
        message="No cost in this range."
        action={{ label: 'Show tokens', run: () => setMetricChoice('tokens') }}
      />
    );
  } else {
    const totalTokens = fold.projects.reduce((sum, project) => sum + project.tokens, 0);
    const unknownTokens = fold.projects.find((project) => project.key === UNKNOWN_KEY)?.tokens ?? 0;
    const unknownShare = totalTokens > 0 ? unknownTokens / totalTokens : 0;
    const anyUnpriced = model.allSeries.some((series) => series.unpricedTokens > 0);
    const folded = model.allSeries.find((series) => series.key === OTHER_KEY)?.members ?? 0;
    const busiestLabel = model.busiest
      ? `${totalText(model.busiest.total, metric)} · ${formatShare(model.busiest.total, model.total)}`
      : null;
    const top = model.topProject;

    body = (
      <>
        <div className="grid gap-2 sm:grid-cols-3">
          <Tile label={`Total · ${rangeName}`}>
            <CountUp
              value={model.total}
              format={(value) => totalText(value, metric)}
              className="widget-gradient-text text-2xl font-semibold tabular-nums tracking-tight"
            />
          </Tile>
          <Tile label="Busiest day" note={busiestLabel}>
            {model.busiest ? WEEKDAY_NAMES[model.busiest.weekday] : 'None yet'}
          </Tile>
          <Tile
            label={solo ? 'Share of total' : 'Top project'}
            note={
              top
                ? `${totalText(top.value, metric)} · ${formatShare(top.value, model.allTotal)}`
                : null
            }
          >
            {top ? top.name : 'None yet'}
          </Tile>
        </div>

        {view === 'chart' ? (
          <div className="grid gap-4 @3xl/weekday:grid-cols-[minmax(0,1fr)_17rem]">
            <WeekdayPlot
              model={model}
              order={order}
              week={week}
              range={range}
              today={today}
              dates={fold.dates}
              colorOf={colorOf}
              emphasis={emphasis}
              onEmphasis={setEmphasis}
            />
            <ProjectLegend
              model={model}
              colorOf={colorOf}
              solo={solo}
              onSolo={toggleSolo}
              emphasis={emphasis}
              onEmphasis={setEmphasis}
            />
          </div>
        ) : (
          <WeekdayTable
            projects={fold.projects}
            names={names}
            order={order}
            metric={metric}
            range={range}
          />
        )}

        <div
          className={cn(
            'space-y-1 pt-3 text-[10px] leading-relaxed text-muted-foreground',
            FOOTER_HAIRLINE,
          )}
        >
          <p>
            From your Claude Code and Codex logs, grouped by the folder each session ran in. Days
            follow your time zone and include today. Cost is an estimate at list prices. Totals can
            differ from the All agents card, which also counts providers without folders.
          </p>
          {anyUnpriced ? (
            <p>
              Some models have no known price. Their tokens count in the total but not in the cost,
              and a + marks a cost that is only a minimum.
            </p>
          ) : null}
          {unknownShare >= 0.05 ? (
            <p>
              {formatShare(unknownTokens, totalTokens)} of the tokens ran in no known folder, so
              they are grouped as Unknown folder.
            </p>
          ) : null}
          {folded > 0 ? <p>Other groups the {folded} smaller folders.</p> : null}
        </div>
      </>
    );
  }

  return (
    <Card className={cn('glass', className)} aria-busy={isFetching || undefined}>
      <CardContent className="@container/weekday flex h-full min-h-0 flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Projects by weekday</h2>
              <p className="truncate text-[11px] text-muted-foreground">
                Tokens and estimated cost per project, by day of the week
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {priced ? (
              <PillTabs
                id="weekday-metric"
                label="Measure"
                items={METRIC_ITEMS}
                value={metric}
                onChange={setMetricChoice}
                kind="toggle"
                size="xs"
              />
            ) : null}
            <PillTabs
              id="weekday-range"
              label="Period"
              items={RANGE_ITEMS}
              value={range === 7 ? '7' : '28'}
              onChange={(value) => setRange(value === '7' ? 7 : 28)}
              kind="toggle"
              size="xs"
            />
            <PillTabs
              id="weekday-view"
              label="View"
              items={VIEW_ITEMS}
              value={view}
              onChange={setView}
              kind="toggle"
              size="xs"
            />
          </div>
        </div>
        {body}
      </CardContent>
    </Card>
  );
}
