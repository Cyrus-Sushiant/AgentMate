import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PillTabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Shown after the label. Zero hides it, like the counts on the main menu. */
  count?: number;
  /** Tints the count, for one that needs attention, like missed scheduled runs. */
  countTone?: 'destructive' | 'warning';
}

interface PillTabsProps<T extends string> {
  /** Unique on the page, so two groups never animate their pills into each other. */
  id: string;
  label: string;
  items: PillTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * `nav` switches between views of the page (the active one is `aria-current`), `toggle` picks
   * one option of a setting (the active one is `aria-pressed`).
   */
  kind?: 'nav' | 'toggle';
  size?: 'sm' | 'xs';
  className?: string;
}

/**
 * A rounded-full segmented control. The selection is the main menu's tinted pill, which slides
 * between options unless the user has asked for reduced motion.
 */
export function PillTabs<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
  kind = 'nav',
  size = 'sm',
  className,
}: PillTabsProps<T>): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 32 };

  const buttons = items.map((item) => {
    const active = item.value === value;
    return (
      <button
        key={item.value}
        type="button"
        onClick={() => onChange(item.value)}
        aria-current={kind === 'nav' && active ? true : undefined}
        aria-pressed={kind === 'toggle' ? active : undefined}
        className={cn(
          'relative flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 [&_svg]:shrink-0',
          size === 'sm'
            ? 'h-7 px-3 text-xs [&_svg]:size-3.5'
            : 'h-6 px-2.5 text-[11px] [&_svg]:size-3',
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
        )}
      >
        {active && (
          <motion.span
            aria-hidden
            layoutId={`${id}-active`}
            transition={transition}
            className="absolute inset-0 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/20"
          />
        )}
        {item.icon && <span className="relative flex">{item.icon}</span>}
        <span className="relative">{item.label}</span>
        {item.count !== undefined && item.count > 0 && (
          <span
            className={cn(
              'relative min-w-4 rounded-full px-1.5 text-center text-[10px] font-semibold leading-4 tabular-nums',
              item.countTone === 'destructive'
                ? 'bg-destructive/15 text-destructive'
                : item.countTone === 'warning'
                  ? 'bg-warning/15 text-warning'
                  : active
                    ? 'bg-primary/15 text-primary'
                    : 'bg-foreground/[0.07] text-muted-foreground',
            )}
          >
            {item.count}
          </span>
        )}
      </button>
    );
  });

  const body = (
    <LayoutGroup id={id}>
      <div className="flex items-center gap-0.5">{buttons}</div>
    </LayoutGroup>
  );
  const shell = cn(
    'search-pill min-w-0 max-w-full overflow-x-auto rounded-full p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    className,
  );

  return kind === 'nav' ? (
    <nav aria-label={label} className={shell}>
      {body}
    </nav>
  ) : (
    <div role="group" aria-label={label} className={shell}>
      {body}
    </div>
  );
}
