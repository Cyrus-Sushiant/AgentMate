import { X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function StatTile({
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
  /** Optional control (e.g. a refresh button) pinned to the top-right corner. */
  action?: React.ReactNode;
  /** The dashboard's shared drag handle; omitted outside its edit mode. */
  dragHandle?: React.ReactNode;
  /** Omitted outside the dashboard's edit mode, which hides the remove button. */
  onRemove?: () => void;
  className?: string;
}): React.JSX.Element {
  const hasChrome = action || dragHandle || onRemove;
  return (
    <Card className={cn('glass h-full', className)}>
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon} <span className="truncate">{label}</span>
          {hasChrome && (
            <span className="ml-auto flex shrink-0 items-center gap-1">
              {action}
              {dragHandle}
              {onRemove && (
                <SimpleTooltip label="Remove from dashboard">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
                    <X className="h-3 w-3" />
                  </Button>
                </SimpleTooltip>
              )}
            </span>
          )}
        </div>
        <div className="mt-auto pt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
