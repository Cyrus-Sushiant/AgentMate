import { cn } from '@/lib/utils';

/**
 * Class strings every restyled page shares, so cards and headings read the way the API Client
 * page draws them. Buttons aren't in here: they come from the Button component's variant, size
 * and shape props. Tailwind's border colour utilities lose to the app's global unlayered
 * `* { border-color }` rule, so every tinted edge in here is a ring or an inset shadow instead.
 */

/** A glass card on the content island, rounded like the Settings and API Client cards. */
export const GLASS_CARD = 'glass rounded-[calc(var(--radius)+2px)]';

/** A glass card that holds a scrolling pane, like the API Client sidebar and request area. */
export const GLASS_PANEL = cn(GLASS_CARD, 'flex flex-col overflow-hidden');

/** The bar of page actions at the top of a page, a glass card like the rest. */
export const TOOLBAR = cn(GLASS_CARD, 'flex flex-wrap items-center gap-2 p-2');

/** The small uppercase heading the main menu puts over its groups. */
export const SECTION_HEADING =
  'select-none text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60';

/** A soft inset area inside a card, for plans, previews and notes that need their own frame. */
export const SECTION_WELL =
  'rounded-xl bg-foreground/[0.03] p-3 ring-1 ring-inset ring-foreground/[0.07]';

/** A hairline along the top of a card footer or row list, drawn like the .settings-rows ones. */
export const FOOTER_HAIRLINE = 'shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]';

/**
 * The grid the catalog cards sit in. It follows the width of its own column rather than the
 * window, so a page with a sidebar card does not cram three cards into half the window.
 */
export const CARD_GRID =
  'grid grid-cols-1 gap-2 @xl/grid:grid-cols-2 @4xl/grid:grid-cols-3 @7xl/grid:grid-cols-4';

/** A segmented control: a rounded pill track, the same one the usage period chips use. */
export const SEGMENT_TRACK = 'inline-flex items-center rounded-full bg-foreground/8 p-0.5';

/** One option in a segmented track. */
export function segmentClass(active: boolean): string {
  return cn(
    'inline-flex h-6 cursor-pointer items-center justify-center rounded-full px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'bg-background/80 text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
  );
}
