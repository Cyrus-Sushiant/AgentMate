import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * One entry in a sidebar card: the main menu's row, with its tinted pill and the small glowing
 * bar on the active one. Give every row of a list the same `group`, so the pill slides between
 * them.
 */
export function SideNavRow({
  group,
  active,
  icon,
  label,
  count,
  muted = false,
  onSelect,
}: {
  /** Shared by the rows of one list, and unique on the page. */
  group: string;
  active: boolean;
  icon?: React.ReactNode;
  label: string;
  /** Shown on the right edge; left out when undefined. */
  count?: number;
  /** For an entry that has nothing in it right now. */
  muted?: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <button
      type="button"
      aria-current={active ? true : undefined}
      onClick={onSelect}
      className={cn(
        // `isolate` keeps the pill behind the text without lifting every child.
        'relative isolate flex h-8 w-full shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg pl-2.5 pr-2 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'font-medium text-primary'
          : 'text-foreground/85 hover:bg-foreground/[0.06] hover:text-foreground',
        muted && !active && 'text-muted-foreground',
      )}
    >
      {active && (
        <motion.span
          aria-hidden
          layoutId={`${group}-active`}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }
          }
          className="absolute inset-0 -z-10 rounded-lg bg-primary/12"
        >
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
        </motion.span>
      )}
      {icon && (
        <span
          className={cn(
            'flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 text-[10px] leading-4 tabular-nums',
            active ? 'bg-primary/15 text-primary' : 'bg-foreground/[0.06] text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
