import { cn } from '@/lib/utils';
import { methodLabel, methodTone } from './format';

/**
 * A request's method as a small tinted label, the way the sidebar and the open-request tabs show
 * it. The tint is the method's own colour at low strength, so each method keeps one hue that
 * reads on both light and dark themes.
 */
export function MethodBadge({
  method,
  className,
}: {
  method: string;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-10 shrink-0 items-center justify-center rounded-[5px] bg-current/10 font-mono text-[9px] font-bold leading-none tracking-wide',
        methodTone(method),
        className,
      )}
    >
      {methodLabel(method)}
    </span>
  );
}
