import type { CloudflareZone } from '@shared/cloudflareTypes';
import { motion, useReducedMotion } from 'framer-motion';
import { Globe } from '@/components/icons';
import { EmptyState, SECTION_HEADING } from '@/components/pageKit';
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

function isLive(zone: CloudflareZone): boolean {
  return zone.status === 'active' && !zone.paused;
}

/**
 * One domain in the rail: the main menu's row with a second line for the zone's state, so a zone
 * waiting for its name servers stands out before it is opened.
 */
function ZoneRow({
  zone,
  selected,
  onSelect,
}: {
  zone: CloudflareZone;
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const live = isLive(zone);
  return (
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      className={cn(
        // `isolate` keeps the pill behind the text without lifting every child.
        'relative isolate flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg py-1.5 pl-2.5 pr-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'text-primary' : 'text-foreground/85 hover:bg-foreground/[0.06]',
      )}
    >
      {selected && (
        <motion.span
          aria-hidden
          layoutId="cloudflare-zone-active"
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }
          }
          className="absolute inset-0 -z-10 rounded-lg bg-primary/12"
        >
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
        </motion.span>
      )}
      <Globe
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          selected ? 'text-primary' : live ? 'text-foreground/70' : 'text-muted-foreground',
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[13px]',
            selected ? 'font-medium text-primary' : 'text-foreground',
          )}
        >
          {zone.name}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            aria-hidden
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', live ? 'bg-success' : 'bg-warning')}
          />
          <span className="truncate">{zoneStateText(zone)}</span>
        </span>
      </span>
    </button>
  );
}

/** One account's zones as the rail shows them: loading, failed, or the list (possibly empty). */
export interface ZoneGroup {
  accountId: string;
  label: string;
  /** Undefined while the list loads. */
  zones: CloudflareZone[] | undefined;
  error: string | null;
  onRetry: () => void;
}

function GroupContent({
  group,
  selectedId,
  onSelect,
}: {
  group: ZoneGroup;
  selectedId: string | null;
  onSelect: (zone: CloudflareZone) => void;
}): React.JSX.Element {
  const { zones, error } = group;
  if (error) {
    return (
      <div className="px-1">
        <Problem message={error} onRetry={group.onRetry} />
      </div>
    );
  }
  if (!zones) {
    return (
      <div className="space-y-1 px-1">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-2.5 px-1.5 py-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (zones.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={Globe}
        title="No domains yet"
        description="This token cannot see any domains yet. Add a domain on Cloudflare, or include it under Zone Resources on the token."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-px">
      {zones.map((zone) => (
        <li key={zone.id}>
          <ZoneRow zone={zone} selected={zone.id === selectedId} onSelect={() => onSelect(zone)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Every zone the connected tokens can see, so the one being managed is always in view. With more
 * than one account the zones sit under the account's name, and picking the name opens that
 * account's token card.
 */
export function ZoneRail({
  groups,
  selectedId,
  onSelect,
  onManageAccount,
}: {
  groups: ZoneGroup[];
  selectedId: string | null;
  onSelect: (zone: CloudflareZone) => void;
  onManageAccount: (accountId: string) => void;
}): React.JSX.Element {
  const loading = groups.some((group) => !group.zones && !group.error);
  const total = groups.reduce((sum, group) => sum + (group.zones?.length ?? 0), 0);
  const counted = groups.every((group) => group.zones);
  const grouped = groups.length > 1;
  return (
    <nav
      aria-label="Zones"
      aria-busy={loading ? 'true' : undefined}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex h-10 shrink-0 items-center gap-2 pl-3.5 pr-3">
        <h2 className={cn(SECTION_HEADING, 'min-w-0 flex-1 truncate')}>Domains</h2>
        {counted && (
          <span className="rounded-full bg-foreground/[0.06] px-1.5 text-[10px] leading-4 tabular-nums text-muted-foreground">
            {total}
          </span>
        )}
      </div>
      <div className="rail-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {groups.map((group) => (
          <section
            key={group.accountId}
            aria-label={grouped ? group.label : undefined}
            className="space-y-0.5"
          >
            {grouped && (
              <button
                type="button"
                onClick={() => onManageAccount(group.accountId)}
                className="block w-full cursor-pointer truncate rounded-md px-2.5 py-1 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {group.label}
              </button>
            )}
            <GroupContent group={group} selectedId={selectedId} onSelect={onSelect} />
          </section>
        ))}
      </div>
    </nav>
  );
}
