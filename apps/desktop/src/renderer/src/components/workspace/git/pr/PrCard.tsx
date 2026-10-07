import { createContext, useContext, useState } from 'react';
import { ChevronRight } from '@/components/icons';
import {
  Chip,
  type ChipTone,
  FOOTER_HAIRLINE,
  GLASS_CARD,
  SECTION_HEADING,
} from '@/components/pageKit';
import { cn } from '@/lib/utils';
import { type SourceControlSection, useWorkspaceStore } from '@/stores/workspaceStore';

/** Set by a surface that covers the panel (the large PR view) so it can get out of the way. */
export const PrSurfaceLeaveContext = createContext<() => void>(() => {
  // The panel itself has nothing to close.
});

/** Jumps to another part of the Source control tab, closing the large PR view first if open. */
export function useRevealInPanel(): (section: SourceControlSection) => void {
  const leave = useContext(PrSurfaceLeaveContext);
  const revealPanelSection = useWorkspaceStore((s) => s.revealPanelSection);
  return (section) => {
    leave();
    revealPanelSection(section);
  };
}

export type PrTone = 'default' | 'success' | 'warning' | 'destructive';

/**
 * The card's tinted edge. It is a ring, which renders on `.glass`, since the app's global border
 * colour would repaint a tinted border.
 */
const TONE_RING: Record<PrTone, string> = {
  default: '',
  success: 'ring-1 ring-inset ring-success/30',
  warning: 'ring-1 ring-inset ring-warning/35',
  destructive: 'ring-1 ring-inset ring-destructive/35',
};

/** What a PR tone looks like as a kit chip. */
export const PR_CHIP_TONE: Record<PrTone, ChipTone> = {
  default: 'neutral',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
};

/** The PR flow's cards sit in the narrow panel, so they inset from its edges. */
export const PR_CARD = cn(GLASS_CARD, 'mx-2');

/** The small tinted icon tile in a card's header, coloured by how the card stands. */
const TILE_TONE: Record<PrTone, string> = {
  default: 'bg-foreground/[0.06] text-muted-foreground',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
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
    <section aria-label={title} className={cn(PR_CARD, 'transition-shadow', TONE_RING[tone])}>
      <div className="flex h-9 items-center gap-1 pl-1.5 pr-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="group/card flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <ChevronRight
            className={cn(
              'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform group-hover/card:text-muted-foreground motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md [&_svg]:size-3',
              TILE_TONE[tone],
            )}
          >
            <Icon />
          </span>
          <span className={cn(SECTION_HEADING, 'shrink-0 group-hover/card:text-muted-foreground')}>
            {title}
          </span>
          {summary ? (
            <span className="ml-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </button>
        {actions ? <span className="flex shrink-0 items-center gap-0.5">{actions}</span> : null}
      </div>
      {open ? <div className={cn(FOOTER_HAIRLINE, 'pb-2.5 pt-2')}>{children}</div> : null}
    </section>
  );
}

/** PR state and review decisions as the kit's tinted chip, sized for the panel. */
export function PrPill({
  tone = 'default',
  children,
}: {
  tone?: PrTone;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Chip tone={PR_CHIP_TONE[tone]} className="h-[18px] px-2 text-[10px] font-semibold">
      {children}
    </Chip>
  );
}

/** Sends a textarea on Ctrl+Enter (Cmd+Enter on macOS). */
export function isSubmitKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
}
