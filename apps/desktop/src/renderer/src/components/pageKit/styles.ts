import { cn } from '@/lib/utils';

/**
 * Class strings every restyled page shares, so cards, headings and buttons read the way the API
 * Client page draws them. Tailwind's border colour utilities lose to the app's global unlayered
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

/** A primary page action as a pill (on a default Button, usually size="sm"). */
export const PILL_PRIMARY = 'h-8 rounded-full px-4';

/**
 * A secondary action drawn as the search pill, so only the primary action has weight (on a ghost
 * Button). The pill's own hover wash comes from the unlayered `.search-pill` rule.
 */
export const PILL_SOFT =
  'search-pill h-8 rounded-full px-3.5 text-xs font-medium text-foreground/85 hover:text-foreground';

/** An icon-only page action as a round soft pill (on a ghost Button with size="icon"). */
export const PILL_SOFT_ICON =
  'search-pill h-8 w-8 rounded-full text-foreground/85 hover:text-foreground';

/** A primary action inside a card, as a small pill (on a default Button with size="sm"). */
export const CARD_PILL = 'h-7 rounded-full px-3';

/** A secondary action inside a card, as a small soft pill (on a ghost Button with size="sm"). */
export const CARD_PILL_SOFT =
  'search-pill h-7 rounded-full px-3 text-xs font-medium text-foreground/85 hover:text-foreground';

/**
 * A destructive action as a soft pill tinted red, so it reads as dangerous without the weight
 * of a filled button (on a ghost Button). The confirmation dialog it opens keeps the filled one.
 */
export const PILL_DESTRUCTIVE =
  'h-8 rounded-full bg-destructive/10 px-3.5 text-xs font-medium text-destructive hover:bg-destructive/15 hover:text-destructive';

/** A small round icon button in a card's header or row (on a ghost Button with size="icon"). */
export const TILE_ACTION =
  'h-7 w-7 rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground [&_svg]:size-3.5';

/** A smaller square icon button for a dense card header, as a plain `<button>`. */
export const HEADER_ICON_BUTTON =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

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
