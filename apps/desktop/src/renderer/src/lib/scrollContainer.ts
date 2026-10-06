/**
 * Scrolling that stays inside one container.
 *
 * `Element.scrollIntoView` scrolls every scrollable ancestor, and that includes `overflow: hidden`
 * boxes (script can still move them). In the app shell that pushes the page header and the rounded
 * page frame out of view. These helpers move only the nearest real scroller instead.
 */

/** The closest ancestor the user can scroll (overflow-y auto or scroll), or null if there is none. */
export function findScrollContainer(element: Element | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/** Scroll behavior that honors the OS "reduce motion" setting. */
export function scrollBehavior(smooth: boolean): ScrollBehavior {
  if (!smooth) return 'auto';
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced ? 'auto' : 'smooth';
}

function scrollContainerTo(container: HTMLElement, top: number, behavior: ScrollBehavior): void {
  if (typeof container.scrollTo === 'function') container.scrollTo({ top, behavior });
  else container.scrollTop = top;
}

/**
 * Scroll the nearest scroller above `target` so `target` sits at its top edge, less the target's
 * own `scroll-margin-top` plus `offset`. Outer ancestors are left alone. Returns false when the
 * target has no scroller above it.
 */
export function scrollToInContainer(
  target: Element,
  { smooth = false, offset = 0 }: { smooth?: boolean; offset?: number } = {},
): boolean {
  const container = findScrollContainer(target);
  if (!container) return false;
  const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const gap =
    target.getBoundingClientRect().top -
    container.getBoundingClientRect().top -
    container.clientTop;
  const top = Math.max(0, container.scrollTop + gap - margin - offset);
  scrollContainerTo(container, top, scrollBehavior(smooth));
  return true;
}

/** Scroll the nearest scroller above `from` back to its top. Returns false if there is none. */
export function scrollContainerToTop(from: Element): boolean {
  const container = findScrollContainer(from);
  if (!container) return false;
  scrollContainerTo(container, 0, 'auto');
  return true;
}
