import { useState } from 'react';
import { ChevronRight } from '@/components/icons';
import { cn } from '@/lib/utils';

/** The least a dragged section keeps, header included. Matches the `min-h-[7rem]` below. */
const SECTION_MIN_HEIGHT = 112;
/** How far one arrow key press moves a splitter. */
const KEY_STEP = 16;

/**
 * One folding section of the Source control tab. A folded section renders nothing below its
 * header, so whatever it fetches stays quiet until it is opened. An open section is as tall as
 * what it shows, or as tall as the user dragged it, and scrolls on its own once the panel runs
 * out of room; the primary one takes whatever height is left over and keeps at least about half
 * the panel until the user sizes the others by hand.
 */
export function SourceSection({
  id,
  title,
  open,
  onToggle,
  primary = false,
  height,
  resized = false,
  splitter,
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
  /** The height in pixels the user dragged this section to. Ignored for the primary one. */
  height?: number;
  /** Some open section here was sized by hand, so the primary one lets go of its half. */
  resized?: boolean;
  /** The handle on this section's top border that resizes the sections around it. */
  splitter?: React.ReactNode;
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
  const sized = open && !primary && height !== undefined;
  return (
    <section
      aria-label={title}
      data-source-section={id}
      style={sized ? { flex: `0 1 ${height}px` } : undefined}
      className={cn(
        'relative flex flex-col border-t border-border/60 first:border-t-0',
        !open
          ? 'shrink-0'
          : primary
            ? cn('flex-1', resized ? 'min-h-[7rem]' : 'min-h-[45%]')
            : cn('min-h-[7rem]', !sized && 'flex-initial'),
      )}
    >
      {splitter}
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

/**
 * The drag handle on the border between two sections. It moves height from one open section to
 * the other: the nearest open one above it (`upper`) and the nearest open one below (`lower`),
 * so folded headers in between just ride along. Arrow keys nudge it, a double click undoes it.
 */
export function SourceSectionSplitter({
  containerRef,
  upper,
  lower,
  onResize,
  onReset,
}: {
  /** Holds the sections, to measure them where the drag starts. */
  containerRef: React.RefObject<HTMLElement | null>;
  upper: string;
  lower: string;
  /** The new heights of the two sections, in pixels. */
  onResize: (upper: number, lower: number) => void;
  /** Lets both sections go back to sizing themselves. */
  onReset: () => void;
}): React.JSX.Element {
  const [dragging, setDragging] = useState(false);

  function measure(): [number, number] | null {
    const container = containerRef.current;
    const above = container?.querySelector<HTMLElement>(`[data-source-section="${upper}"]`);
    const below = container?.querySelector<HTMLElement>(`[data-source-section="${lower}"]`);
    if (!above || !below) return null;
    return [above.getBoundingClientRect().height, below.getBoundingClientRect().height];
  }

  function resize([above, below]: [number, number], delta: number): void {
    const moved = Math.min(below - SECTION_MIN_HEIGHT, Math.max(SECTION_MIN_HEIGHT - above, delta));
    onResize(Math.round(above + moved), Math.round(below - moved));
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    const start = measure();
    if (!start) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    setDragging(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (move: PointerEvent): void => resize(start, move.clientY - startY);
    const onUp = (up: PointerEvent): void => {
      handle.releasePointerCapture(up.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(false);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize sections"
      tabIndex={0}
      onPointerDown={startDrag}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        const start = measure();
        if (!start) return;
        event.preventDefault();
        resize(start, event.key === 'ArrowUp' ? -KEY_STEP : KEY_STEP);
      }}
      className="group/splitter absolute inset-x-0 -top-1 z-20 flex h-2 cursor-row-resize items-center focus-visible:outline-none"
    >
      <span
        className={cn(
          'h-px w-full transition-colors',
          dragging
            ? 'bg-primary'
            : 'bg-transparent group-hover/splitter:bg-primary/60 group-focus-visible/splitter:bg-primary',
        )}
      />
    </div>
  );
}
