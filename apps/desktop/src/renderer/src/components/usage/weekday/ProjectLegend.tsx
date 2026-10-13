import { Check } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { type ChartModel, type ChartSeries, metricValue, OTHER_KEY } from '@/lib/projectWeekday';
import { formatShare } from '@/lib/usageFormat';
import { cn } from '@/lib/utils';
import { primaryText, secondaryText } from './format';

// One row per project on the chart, with its colour, its share and its figures. Hovering a row
// dims the other projects. Clicking it shows that project alone, and clicking it again shows all.

interface ProjectLegendProps {
  model: ChartModel;
  colorOf: (series: ChartSeries) => string;
  solo: string | null;
  onSolo: (key: string) => void;
  emphasis: string | null;
  onEmphasis: (key: string | null) => void;
}

export function ProjectLegend({
  model,
  colorOf,
  solo,
  onSolo,
  emphasis,
  onEmphasis,
}: ProjectLegendProps): React.JSX.Element {
  const { metric, allTotal } = model;
  return (
    <div role="group" aria-label="Projects" className="flex min-w-0 flex-col gap-0.5">
      {model.allSeries.map((series) => {
        const value = metricValue(series, metric);
        const share = allTotal > 0 ? value / allTotal : 0;
        const active = solo === series.key;
        const dimmed = (solo !== null && !active) || (emphasis !== null && emphasis !== series.key);
        const label = series.key === OTHER_KEY ? `Other (${series.members})` : series.name;
        const whole = {
          tokens: series.tokens,
          costUsd: series.costUsd,
          unpricedTokens: series.unpricedTokens,
        };
        const note = secondaryText(whole, metric);
        return (
          <button
            key={series.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSolo(series.key)}
            onPointerEnter={() => onEmphasis(series.key)}
            onPointerLeave={() => onEmphasis(null)}
            onFocus={() => onEmphasis(series.key)}
            onBlur={() => onEmphasis(null)}
            className={cn(
              'grid w-full cursor-pointer grid-cols-[0.6rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-xl px-2.5 py-2 text-left outline-none transition-[opacity,background-color] duration-200 hover:bg-foreground/[0.045] focus-visible:ring-2 focus-visible:ring-ring',
              active && 'bg-foreground/[0.07] ring-1 ring-inset ring-foreground/10',
              dimmed && 'opacity-55',
            )}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: colorOf(series) }}
            />
            <SimpleTooltip label={series.path ?? label}>
              <span dir="auto" className="min-w-0 truncate text-xs font-medium">
                {label}
              </span>
            </SimpleTooltip>
            <span className="text-right text-xs font-semibold tabular-nums">
              {primaryText(whole, metric)}
            </span>
            <span
              aria-hidden
              className="col-start-2 h-1 overflow-hidden rounded-full bg-foreground/10"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(value > 0 ? 3 : 0, share * 100)}%`,
                  backgroundColor: colorOf(series),
                }}
              />
            </span>
            <span className="col-start-3 flex items-center justify-end gap-1.5 text-[10px] tabular-nums text-muted-foreground">
              {note ? <span>{note}</span> : null}
              <span>{formatShare(value, allTotal)}</span>
              {active ? <Check className="h-3 w-3 text-primary" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
