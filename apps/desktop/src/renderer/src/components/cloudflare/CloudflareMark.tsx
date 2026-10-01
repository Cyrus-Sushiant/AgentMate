import { siCloudflare } from 'simple-icons';
import { cn } from '@/lib/utils';

/** Cloudflare's own mark, for the page header and the way in from Deploy. */
export function CloudflareMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={`#${siCloudflare.hex}`}
      className={cn('shrink-0', className)}
    >
      <path d={siCloudflare.path} />
    </svg>
  );
}
