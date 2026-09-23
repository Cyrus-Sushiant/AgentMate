import { useState } from 'react';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/utils';

export type PrTone = 'default' | 'success' | 'warning' | 'destructive';

const TONE_RING: Record<PrTone, string> = {
  default: 'border-border/70',
  success: 'border-success/35',
  warning: 'border-warning/40',
  destructive: 'border-destructive/40',
};

/**
 * One step of the PR flow (checks, review, merge). Collapsible so a long review doesn't push the
 * merge button off screen; a card that needs attention starts open.
 */
export function PrCard({
  title,
  icon: Icon,
  summary,
  tone = 'default',
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** A short status after the title, shown even while the card is folded. */
  summary?: React.ReactNode;
  tone?: PrTone;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      aria-label={title}
      className={cn('mx-2 rounded-lg border bg-card/40 transition-colors', TONE_RING[tone])}
    >
      <div className="flex h-8 items-center gap-1 pl-1 pr-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              'h-2.5 w-2.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              !open && '-rotate-90',
            )}
          />
          <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {summary ? (
            <span className="ml-1 min-w-0 truncate text-[11px] text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </button>
        {actions ? <span className="flex shrink-0 items-center gap-0.5">{actions}</span> : null}
      </div>
      {open ? <div className="border-t border-border/50 pb-2 pt-1.5">{children}</div> : null}
    </section>
  );
}

/** Small rounded label for PR state and review decisions. */
export function PrPill({
  tone = 'default',
  children,
}: {
  tone?: PrTone;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] shrink-0 items-center rounded-full px-2 text-[10px] font-semibold',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'destructive' && 'bg-destructive/12 text-destructive',
        tone === 'default' && 'bg-foreground/[0.07] text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

/** The quiet secondary button used inside the cards. */
export const PR_GHOST_BUTTON =
  'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-50';

/** The tinted call-to-action used for AI actions, same as the pipeline "Fix with AI". */
export const PR_AI_BUTTON =
  'inline-flex h-6 items-center gap-1 rounded-md bg-primary/12 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:pointer-events-none disabled:opacity-50';

/** Sends a textarea on Ctrl+Enter (Cmd+Enter on macOS). */
export function isSubmitKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
}
