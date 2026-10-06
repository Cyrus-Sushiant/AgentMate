import type { IconProps } from '@/components/icons';
import { GLASS_CARD, TILE_ACTION } from '@/components/pageKit';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The pieces the Remote page's views share, so Host, Connect, SSH and Remote Desktop read as one
 * set of glass cards with hairline rows, the way Settings lays out its cards.
 */

/** The kit's glass card, clipped so the hairline rows meet its rounded corners. */
export const REMOTE_CARD = cn(GLASS_CARD, 'overflow-hidden');

/** The kit's round icon action, a size up so it lines up with the h-8 pills in a row. */
export const ROUND_ICON = cn(TILE_ACTION, 'h-8 w-8 shrink-0 [&_svg]:size-4');

/** A card's title row: the tinted icon tile, the title and a line about it, and its actions. */
export function RemoteCardHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: React.ForwardRefExoticComponent<IconProps>;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <div className="flex min-w-[min(100%,18rem)] flex-1 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1 pt-0.5">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {description ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** One row of a card: what it is on the left, the control for it on the right. */
export function RemoteRow({
  label,
  description,
  control,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 px-5 py-3.5',
        className,
      )}
    >
      <div className="min-w-[min(100%,14rem)] flex-1 space-y-0.5">
        <div className="text-[13px] font-medium">{label}</div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{control}</div>
    </div>
  );
}

/** Saved servers still loading: rows that shimmer in their own spot inside the card. */
export function ServerRowsSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="Loading servers" className="settings-rows">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
