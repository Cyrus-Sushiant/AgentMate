import { Search } from '@/components/icons';
import { cn } from '@/lib/utils';
import { GLASS_CARD } from './styles';

const SIZES = {
  sm: {
    box: 'gap-3 px-4 py-8',
    tile: 'h-11 w-11',
    icon: 'h-5 w-5',
    title: 'text-sm',
  },
  md: {
    box: 'gap-3 px-6 py-12',
    tile: 'h-12 w-12',
    icon: 'h-5 w-5',
    title: 'text-sm',
  },
  lg: {
    box: 'gap-4 px-6 py-14',
    tile: 'h-14 w-14',
    icon: 'h-6 w-6',
    title: 'text-base',
  },
} as const;

export type EmptyStateSize = keyof typeof SIZES;

/**
 * An empty or "nothing here yet" state in the API Client's style: a glowing icon tile, a one-line
 * title, a muted description and, when there is something to do about it, a pill button.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  card = false,
  busy = false,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  /** A block, not a paragraph, so a caller can put a link or a button in it. */
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** `sm` fits a sidebar, a filtered list or a section that already has a card around it. */
  size?: EmptyStateSize;
  /** Draws the state as a glass card of its own, for when nothing else frames it. */
  card?: boolean;
  /** Something is being fetched for this state, so a slow arc turns around the icon tile. */
  busy?: boolean;
  className?: string;
}): React.JSX.Element {
  const sizes = SIZES[size];
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizes.box,
        card && GLASS_CARD,
        className,
      )}
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]',
          sizes.tile,
        )}
      >
        {/* Strokes, not borders, since the global border-color rule would beat a border. */}
        {busy ? (
          <svg
            aria-hidden
            viewBox="0 0 50 50"
            className="pointer-events-none absolute -left-[3px] -top-[3px] size-[calc(100%_+_6px)] motion-safe:animate-spin"
          >
            <rect
              x="0.75"
              y="0.75"
              width="48.5"
              height="48.5"
              rx="18.25"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="1.5"
            />
            <rect
              x="0.75"
              y="0.75"
              width="48.5"
              height="48.5"
              rx="18.25"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="35 128"
            />
          </svg>
        ) : null}
        <Icon className={sizes.icon} />
      </div>
      <div className="max-w-sm space-y-1">
        <p className={cn('font-semibold tracking-tight', sizes.title)}>{title}</p>
        {description ? (
          <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** What a filtered list says when nothing is left in it. */
export function NoMatches({ query }: { query: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
      <Search className="h-4 w-4 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">Nothing matches “{query.trim()}”.</p>
    </div>
  );
}
