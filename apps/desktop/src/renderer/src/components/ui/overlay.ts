import { SECTION_HEADING } from '@/components/pageKit/styles';
import { cn } from '@/lib/utils';

/**
 * Class strings shared by everything that floats over the page: menus, popovers, the combobox
 * list and the few hand-rolled menus that can't use Radix. They draw the same frosted glass as
 * the search panel (`.overlay-surface` in index.css) and the same rows as the command palette,
 * so a menu opened anywhere looks like part of one family.
 */

/** The glass panel itself. Callers add their own padding, width and overflow. */
export const OVERLAY_SURFACE = 'overlay-surface text-popover-foreground outline-none';

/**
 * Fade plus a slight zoom and slide from the trigger side. Each primitive adds its own
 * transform origin, since Radix names that variable per component.
 */
export const OVERLAY_MOTION =
  'overlay-motion data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1';

/**
 * Icons that sit directly in a row share one size. A caller that needs another size says so
 * with a `size-*` class, which the rule skips.
 */
const ROW_ICONS = "[&>svg]:shrink-0 [&>svg:not([class*='size-'])]:size-3.5";

/**
 * A menu row. Radix moves focus to the row under the pointer, so `focus` covers hover too.
 * Radix marks a disabled row with an empty `data-disabled`, hence no `=true` here.
 */
export const MENU_ITEM = cn(
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none transition-colors',
  'focus:bg-foreground/[0.07] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  ROW_ICONS,
);

/** The tint for a row that deletes or turns something off. */
export const MENU_ITEM_DANGER = 'text-destructive focus:bg-destructive/10 focus:text-destructive';

/** A checkbox or radio row: room on the left for the check, which sits in MENU_INDICATOR. */
export const MENU_CHECK_ITEM = 'pl-8';

export const MENU_INDICATOR = 'absolute left-2.5 flex size-3.5 items-center justify-center';

/** The check that marks a chosen row. Colour, not a filled row, says what is selected. */
export const MENU_CHECK_ICON = 'size-3.5 text-primary';

/** A sub-menu trigger stays lit while its sub-menu is open. */
export const MENU_SUB_TRIGGER = 'data-[state=open]:bg-foreground/[0.07]';

/** A group label, the same small uppercase heading the main menu puts over its groups. */
export const MENU_LABEL = cn(SECTION_HEADING, 'block px-2.5 pb-1 pt-1.5');

/** A hairline between groups, inset so it lines up with the row text. */
export const MENU_SEPARATOR = 'mx-2.5 my-1 h-px bg-foreground/[0.08]';

/** The key hint at the right edge of a row. */
export const MENU_SHORTCUT = 'ml-auto pl-6 text-[11px] tracking-wide text-muted-foreground';

/**
 * A row in a searchable list (the combobox, the project picker). cmdk marks the active row
 * with `aria-selected` and a disabled one with `data-disabled="true"`.
 */
export const LIST_OPTION = cn(
  'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none transition-colors',
  'aria-selected:bg-foreground/[0.07] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
  ROW_ICONS,
);

/** The search pill at the top of a searchable list, drawn like the command palette's. */
export const LIST_SEARCH = 'search-pill flex h-8 items-center gap-2 rounded-full pl-3 pr-2';
