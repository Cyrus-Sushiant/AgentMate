import { cn } from '@/lib/utils';

/**
 * A placeholder block for content that hasn't arrived yet. Used in place of the
 * full-page overlay everywhere except the app's cold start, so a card that is
 * still loading shimmers in its own spot while the rest of the page stays
 * readable. The sweep itself lives in index.css under `.shimmer`.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div aria-hidden className={cn('shimmer rounded-md', className)} {...props} />;
}
