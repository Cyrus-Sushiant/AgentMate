import { RefreshCw } from '@/components/icons';
import { FOOTER_HAIRLINE, GLASS_CARD, SECTION_HEADING, SectionCard } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SetupFailure } from '../SetupFailure';

/**
 * The pieces the Security and Firewall sections share. A card is the page kit's section card,
 * but its body runs edge to edge, so lists and tables can draw hairline rows the way the
 * Settings cards do.
 */

/** The glass card, clipped so hairline rows and hover washes meet its rounded corners. */
export const SECURITY_CARD = cn(GLASS_CARD, 'overflow-hidden');

/** A card's body under the header, with the hairline that separates the two. */
export const CARD_BODY = cn(FOOTER_HAIRLINE, 'px-4 py-3.5');

/** Hairline-separated rows under the header. */
export const CARD_ROWS = cn(FOOTER_HAIRLINE, 'settings-rows');

/** A table's column heading, in the small uppercase the section headings use. */
export const TABLE_HEAD = cn(SECTION_HEADING, 'whitespace-nowrap px-3 py-2 first:pl-4 last:pr-4');

/** A table cell, lined up with the card's own padding at either end. */
export const TABLE_CELL = 'px-3 py-2.5 first:pl-4 last:pr-4';

/** A code block or preview with a frame of its own inside a card or dialog. */
export const CODE_WELL =
  'overflow-auto rounded-xl bg-foreground/[0.03] p-3 font-mono text-xs leading-relaxed text-foreground ring-1 ring-inset ring-foreground/[0.07]';

/** The kit's section card, flush and clipped so its rows meet the rounded corners. */
export function SecurityCard({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SectionCard>, 'flush' | 'bodyClassName'>): React.JSX.Element {
  return (
    <SectionCard flush className={cn('overflow-hidden', className)} {...props}>
      {children}
    </SectionCard>
  );
}

/** Rows that shimmer in their own spot while the card's list loads. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }): React.JSX.Element {
  return (
    <div aria-busy="true" className={CARD_ROWS}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** What went wrong reading the card's data, with a way to ask again. */
export function LoadFailure({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div className={cn(CARD_BODY, 'space-y-3')}>
      <SetupFailure message={message} />
      <Button size="sm" variant="soft" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}
