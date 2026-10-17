import { CircleCheck, CircleX, HeartPulse, Pause, TriangleAlert } from '@/components/icons';
import { GLASS_CARD } from '@/components/pageKit';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatUptime, type HealthStatusFilter, type HealthSummary } from './healthView';

/**
 * The top of the Health page: how the watched endpoints did over the last day, and how many sit
 * in each state right now. Each count is a button that narrows the page to that state, and
 * says its state in words with its own icon, not only a colour.
 */

const TILES = [
  {
    bucket: 'healthy',
    label: 'Healthy',
    icon: CircleCheck,
    tone: 'text-success',
  },
  {
    bucket: 'degraded',
    label: 'Degraded',
    icon: TriangleAlert,
    tone: 'text-warning',
  },
  {
    bucket: 'down',
    label: 'Down',
    icon: CircleX,
    tone: 'text-destructive',
  },
  {
    bucket: 'paused',
    label: 'Paused or locked',
    icon: Pause,
    tone: 'text-muted-foreground',
  },
] as const;

export function HealthPulseHeader({
  summary,
  loading,
  active = 'all',
  onSelect,
}: {
  summary: HealthSummary;
  loading: boolean;
  active?: HealthStatusFilter;
  onSelect?: (filter: HealthStatusFilter) => void;
}): React.JSX.Element {
  const watched = summary.total - summary.paused;
  return (
    <section
      aria-label="Monitoring overview"
      aria-busy={loading}
      className={cn(GLASS_CARD, 'grid gap-4 p-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center')}
    >
      <div className="flex min-w-48 items-center gap-3 px-1">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_32px_-10px_hsl(var(--primary)/0.8)]',
          )}
        >
          <HeartPulse className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
              {formatUptime(summary.uptime24h)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Uptime, last 24 hours
            {!loading && summary.total > 0
              ? `, ${watched} of ${summary.total} target${summary.total === 1 ? '' : 's'} watched`
              : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.map((tile) => {
          const count = summary[tile.bucket];
          const pressed = active === tile.bucket;
          const Icon = tile.icon;
          return (
            <button
              key={tile.bucket}
              type="button"
              aria-pressed={onSelect ? pressed : undefined}
              aria-label={`${tile.label}, ${loading ? 'loading' : count}`}
              onClick={() => onSelect?.(pressed ? 'all' : tile.bucket)}
              className={cn(
                'flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                pressed
                  ? 'bg-primary/10 ring-primary/30'
                  : 'bg-foreground/[0.03] ring-foreground/[0.07] hover:bg-foreground/[0.06]',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon
                  className={cn('h-3.5 w-3.5', count > 0 ? tile.tone : 'text-muted-foreground/60')}
                />
                <span className="truncate">{tile.label}</span>
              </span>
              {loading ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                <span
                  className={cn(
                    'text-xl font-semibold leading-none tabular-nums',
                    count > 0 && tile.bucket !== 'paused' ? tile.tone : 'text-foreground',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
