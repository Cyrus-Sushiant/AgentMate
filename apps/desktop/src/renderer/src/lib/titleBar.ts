/** Anything in a title bar that has its own click behaviour. */
const CONTROLS =
  'button, a, input, textarea, select, [role="button"], [role="tab"], [data-search-anchor]';

/**
 * Whether a double click landed on the title bar's empty space, which is the only place it should
 * maximize or restore the window. A quick double click on a control (the back and forward arrows
 * most of all) bubbles up as a dblclick too, and toggling the window then would move the control
 * out from under the second click.
 */
export function isTitleBarBlankDoubleClick(event: { target: EventTarget | null }): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return true;
  return target.closest(CONTROLS) === null;
}
