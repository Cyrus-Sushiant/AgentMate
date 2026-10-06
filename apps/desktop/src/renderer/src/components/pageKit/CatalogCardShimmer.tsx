import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { GLASS_CARD } from './styles';

/**
 * The placeholder for one catalog card (a skill, an MCP server, a device): the same glass card
 * shape, shimmering in its own spot while the data lands.
 */
export function CatalogCardShimmer({ className }: { className?: string }): React.JSX.Element {
  return (
    <div className={cn(GLASS_CARD, 'flex flex-col gap-3 p-4', className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="mt-auto h-7 w-24 rounded-full" />
    </div>
  );
}
