import { TriangleAlert } from '@/components/icons';
import { cn } from '@/lib/utils';

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
    <div
      role="note"
      aria-label="Plain HTTP"
      className={cn(
        'space-y-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground',
        className,
      )}
    >
      <p className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          This site uses plain HTTP, not HTTPS. Every request is still signed, so nobody can change
          or replay it, but nothing is encrypted: anyone on the network between you and the site can
          read the theme and plugin files that go back and forth. Use HTTPS if the host offers it.
        </span>
      </p>
      {children}
    </div>
  );
}
