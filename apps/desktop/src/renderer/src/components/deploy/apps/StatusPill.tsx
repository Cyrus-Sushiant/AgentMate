import type { Tone } from '@/lib/deploy/apps/format';
import { cn } from '@/lib/utils';

/** A small status word with a dot, coloured by what it means, so it is never colour alone. */

const TONE_CLASS: Record<Tone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  muted: 'border-border bg-secondary/60 text-muted-foreground',
  busy: 'border-primary/30 bg-primary/10 text-primary',
};

const DOT_CLASS: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/60',
  busy: 'bg-primary motion-safe:animate-pulse',
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASS[tone])} />
      {children}
    </span>
  );
}
