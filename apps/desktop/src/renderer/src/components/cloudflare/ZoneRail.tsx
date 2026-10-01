import type { CloudflareZone } from '@shared/cloudflareTypes';
import { Globe } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Problem } from './fields';

/** What a zone's state means, in words. */
export function zoneStateText(zone: CloudflareZone): string {
  if (zone.paused) return 'Paused';
  switch (zone.status) {
    case 'active':
      return 'Active';
    case 'pending':
      return 'Waiting for name servers';
    case 'initializing':
      return 'Setting up';
    case 'moved':
      return 'Moved away';
    default:
      return zone.status;
  }
}

/** Every zone the token can see, so the one being managed is always in view. */
export function ZoneRail({
  zones,
  error,
  selectedId,
  onSelect,
  onRetry,
}: {
  /** Undefined while the list loads. */
  zones: CloudflareZone[] | undefined;
  error: string | null;
  selectedId: string | null;
  onSelect: (zoneId: string) => void;
  onRetry: () => void;
}): React.JSX.Element {
  let content: React.ReactNode;
  if (error) {
    content = <Problem message={error} onRetry={onRetry} />;
  } else if (!zones) {
    content = Array.from({ length: 3 }, (_, index) => (
      <Skeleton key={index} className="h-14 w-full rounded-lg" />
    ));
  } else if (zones.length === 0) {
    content = (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
        This token cannot see any domains yet. Add a domain on Cloudflare, or include it under Zone
        Resources on the token.
      </p>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-1.5">
        {zones.map((zone) => {
          const selected = zone.id === selectedId;
          return (
            <li key={zone.id}>
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(zone.id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border bg-secondary/30 hover:bg-accent',
                )}
              >
                <Globe
                  className={cn(
                    'h-4 w-4 shrink-0',
                    zone.status === 'active' && !zone.paused
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {zone.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {zoneStateText(zone)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav
      aria-label="Zones"
      aria-busy={!zones && !error ? 'true' : undefined}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Domains</p>
        {zones && (
          <span className="text-xs tabular-nums text-muted-foreground">{zones.length}</span>
        )}
      </div>
      {content}
    </nav>
  );
}
