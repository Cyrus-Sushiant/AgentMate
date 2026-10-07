import { TriangleAlert } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Notice } from '../deployKit';

/**
 * What plain HTTP costs, said before the user allows it: requests are still signed, so nobody can
 * change or replay them, but nothing is encrypted, so anyone on the way can read the files.
 */
export function PlainHttpNotice({
  className,
  children,
}: {
  className?: string;
  /** A control that goes with the warning, such as the opt-in switch. */
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Notice
      role="note"
      aria-label="Plain HTTP"
      tone="warning"
      icon={TriangleAlert}
      className={cn('shrink-0', className)}
    >
      <div className="space-y-3">
        <p>
          This site uses plain HTTP, not HTTPS. Every request is still signed, so nobody can change
          or replay it, but nothing is encrypted: anyone on the network between you and the site can
          read the theme and plugin files that go back and forth. Use HTTPS if the host offers it.
        </p>
        {children}
      </div>
    </Notice>
  );
}
