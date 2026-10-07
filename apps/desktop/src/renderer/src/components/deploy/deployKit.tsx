import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * The pieces every Deploy screen is drawn from, so servers, sites and their sections read like the
 * API Client and Settings: glass cards with an icon tile header, tinted notices and hairline rows.
 * Tinted edges are rings, because the global `* { border-color }` rule repaints borders.
 */

/**
 * A tinted edge for a glass card, drawn as an inset ring. `.glass` folds Tailwind's ring
 * variables into its own box-shadow, so a ring on a glass card shows like it does anywhere else.
 */
export const GLASS_EDGE = {
  destructive: 'ring-1 ring-inset ring-destructive/30',
  warning: 'ring-1 ring-inset ring-warning/35',
  /** No edge at rest, a primary one on hover, and the focus ring as a thicker one. */
  interactive:
    'ring-1 ring-inset ring-transparent hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
} as const;

/** A list framed as a soft well, each row split from the next by a hairline. */
export const LIST_WELL =
  'settings-rows overflow-hidden rounded-xl bg-foreground/[0.03] ring-1 ring-inset ring-foreground/[0.07]';

/** One row inside a `LIST_WELL`. */
export const LIST_ROW = 'px-3 py-2.5';

/**
 * The Deploy names for the kit's card and notice, kept so the Deploy screens import them from
 * here as before.
 */
export {
  Notice,
  type NoticeTone,
  SectionCard as DeployCard,
  SectionCardHeader as DeployCardHeader,
} from '@/components/pageKit';

/** Facts as label and value rows split by hairlines, like the rows of a Settings card. */
export function FactRows({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return <dl className={cn('settings-rows', className)}>{children}</dl>;
}

/** One fact. The `dd` follows its `dt` directly, which the end-to-end tests read by. */
export function FactRow({
  label,
  labelWidth = '9rem',
  children,
}: {
  label: string;
  /** The label column, so a card with long labels can widen it. */
  labelWidth?: '8rem' | '9rem';
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid gap-3 py-2',
        labelWidth === '8rem' ? 'grid-cols-[8rem_minmax(0,1fr)]' : 'grid-cols-[9rem_minmax(0,1fr)]',
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export interface SectionStripItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Switches between the sections of a server or a site. It is a pill track whose tinted selection
 * slides between entries, the way the main menu's does. The section is part of the page's
 * address, and the one shown is `aria-current="page"`, so it is not marked by colour alone. In a
 * narrow window the track scrolls sideways rather than cutting the last sections off.
 */
export function SectionStrip<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
}: {
  /** Unique on the page, so two strips never slide their pills into each other. */
  id: string;
  label: string;
  items: ReadonlyArray<SectionStripItem<T>>;
  value: T;
  onChange: (value: T) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 32 };
  return (
    <nav
      aria-label={label}
      className="search-pill flex max-w-full shrink-0 gap-0.5 self-start overflow-x-auto rounded-full p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <LayoutGroup id={id}>
        {items.map((item) => {
          const Icon = item.icon;
          const current = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => onChange(item.value)}
              className={cn(
                // `isolate` keeps the sliding pill behind the label without lifting every child.
                'relative isolate flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                current
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
              )}
            >
              {current && (
                <motion.span
                  aria-hidden
                  layoutId={`${id}-active`}
                  transition={transition}
                  className="absolute inset-0 -z-10 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/20"
                />
              )}
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
              {item.label}
            </button>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
