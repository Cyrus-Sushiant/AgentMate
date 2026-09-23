import { ChevronRight } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * One folding section of the Source control tab. A folded section renders nothing below its
 * header, so whatever it fetches stays quiet until it is opened. An open section is as tall as
 * what it shows and scrolls on its own once the panel runs out of room; the primary one takes
 * whatever height is left over and keeps at least about half the panel.
 */
export function SourceSection({
  id,
  title,
  open,
  onToggle,
  primary = false,
  count,
  countLabel,
  countTone = 'default',
  actions,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Fills the height the other sections leave, for the section people work in most. */
  primary?: boolean;
  /** A small number beside the title (changed files, unpushed commits). */
  count?: number;
  /** What the number means, for assistive tech. */
  countLabel?: string;
  /** Red when the number is something failing rather than something pending. */
  countTone?: 'default' | 'destructive';
  /** Buttons for this section, shown in its header while it is open. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const bodyId = `source-section-${id}`;
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col border-t border-border/60 first:border-t-0',
        !open ? 'shrink-0' : primary ? 'min-h-[45%] flex-1' : 'min-h-[7rem] flex-initial',
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-1 pl-1.5 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/75 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              'h-2.5 w-2.5 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
          <span className="truncate">{title}</span>
          {count ? (
            <span
              aria-label={countLabel}
              className={cn(
                'rounded-full px-1.5 text-[10px] font-semibold normal-case leading-4 tabular-nums',
                countTone === 'destructive'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-foreground/[0.08] text-foreground/80',
              )}
            >
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </button>
        {open && actions ? (
          <span className="flex shrink-0 items-center gap-0.5">{actions}</span>
        ) : null}
      </div>
      {open ? (
        <div id={bodyId} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      ) : null}
    </section>
  );
}
