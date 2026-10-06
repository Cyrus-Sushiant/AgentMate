import { siWordpress } from 'simple-icons';
import { cn } from '@/lib/utils';

/** WordPress's own mark, for WordPress sites in Deploy and WordPress projects. */
export function WordPressMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={`#${siWordpress.hex}`}
      className={cn('shrink-0', className)}
    >
      <path d={siWordpress.path} />
    </svg>
  );
}
