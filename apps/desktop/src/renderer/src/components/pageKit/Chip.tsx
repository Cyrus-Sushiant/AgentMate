import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const TONES = {
  neutral: { chip: 'bg-foreground/[0.06] text-muted-foreground', dot: 'bg-muted-foreground/60' },
  primary: { chip: 'bg-primary/12 text-primary', dot: 'bg-primary' },
  success: { chip: 'bg-success/12 text-success', dot: 'bg-success' },
  warning: { chip: 'bg-warning/12 text-warning', dot: 'bg-warning' },
  destructive: { chip: 'bg-destructive/12 text-destructive', dot: 'bg-destructive' },
} as const;

export type ChipTone = keyof typeof TONES;

/**
 * A status, count or tag as a small rounded-full chip, tinted from the theme so it reads the same
 * on every page. It has no border, since the global border colour would repaint a tinted one.
 */
export function Chip({
  tone = 'neutral',
  dot = false,
  pulse = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone;
  /** A leading dot, for a live state rather than a label. */
  dot?: boolean;
  /** Pulses the dot, for something that is still under way. */
  pulse?: boolean;
}): React.JSX.Element {
  const colours = TONES[tone];
  return (
    <span
      className={cn(
        // Every icon in a chip is drawn at 12px, so callers can pass a bare glyph.
        'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-medium leading-none [&_svg]:size-3 [&_svg]:shrink-0',
        dot && 'gap-1.5',
        colours.chip,
        className,
      )}
      {...props}
    >
      {dot && (
        <span aria-hidden className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping',
                colours.dot,
              )}
            />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', colours.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}

/**
 * One count in a page's toolbar, like "Running 3". The label and the number are the chip's only
 * text, and the number shimmers until the first answer is in.
 */
export function CountChip({
  label,
  value,
  tone = 'neutral',
  loading = false,
}: {
  label: string;
  value: number;
  tone?: ChipTone;
  loading?: boolean;
}): React.JSX.Element {
  return (
    <Chip tone={tone} dot={tone !== 'neutral'} className="h-6 px-2.5">
      <span>{label}</span>
      {loading ? (
        <Skeleton className="h-3 w-4 rounded-full" />
      ) : (
        <span className="font-semibold tabular-nums">{value}</span>
      )}
    </Chip>
  );
}
