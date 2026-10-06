import { X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GLASS_CARD, TILE_ACTION } from './styles';

/**
 * The header row every tile starts with: an icon, a title and, on the right, the tile's own
 * actions. The title is its own element so tests and screen readers can find the card by it.
 */
export function TileHeader({
  icon,
  title,
  extra,
  actions,
  className,
  iconClassName,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  /** Sits right after the title, for a status chip or a plan badge. */
  extra?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** For an icon that brings its own colours and size, like a provider's logo. */
  iconClassName?: string;
}): React.JSX.Element {
  return (
    <div className={cn('flex min-h-7 min-w-0 items-center gap-2', className)}>
      <span className={cn('flex shrink-0 items-center text-primary [&_svg]:size-4', iconClassName)}>
        {icon}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
      {extra}
      {actions ? (
        <span className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</span>
      ) : null}
    </div>
  );
}

/**
 * A single-figure glass tile: the shared header row over one big value. `ui/stat-tile` is this
 * same tile, so the dashboard, Usage, Skills and Deploy figures all match.
 */
export function MetricTile({
  icon,
  label,
  value,
  action,
  dragHandle,
  onRemove,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  /** A skeleton stands in here until the data lands. */
  value: React.ReactNode;
  /** An optional control (a refresh or a pin) at the end of the header row. */
  action?: React.ReactNode;
  /** The dashboard's drag handle; omitted outside its edit mode. */
  dragHandle?: React.ReactNode;
  /** Omitted outside the dashboard's edit mode, which hides the remove button. */
  onRemove?: () => void;
  className?: string;
}): React.JSX.Element {
  const hasChrome = action || dragHandle || onRemove;
  return (
    <div className={cn(GLASS_CARD, 'h-full', className)}>
      <div className="flex h-full flex-col gap-2 p-4">
        <TileHeader
          icon={icon}
          title={label}
          actions={
            hasChrome ? (
              <>
                {action}
                {dragHandle}
                {onRemove && (
                  <SimpleTooltip label="Remove from dashboard">
                    <Button variant="ghost" size="icon" className={TILE_ACTION} onClick={onRemove}>
                      <X />
                    </Button>
                  </SimpleTooltip>
                )}
              </>
            ) : undefined
          }
        />
        <div className="mt-auto text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      </div>
    </div>
  );
}
