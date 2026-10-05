export type WindowGlass = 'mica' | 'vibrancy';

/**
 * Reads the material main put under the window (see src/main/windowGlass.ts) from the page URL.
 * Only the main window gets the parameter. Widgets, the pet and session windows load without it
 * and stay opaque, and so does `none` (Windows 10, Linux).
 */
export function windowGlassFromSearch(search: string): WindowGlass | undefined {
  const glass = new URLSearchParams(search).get('glass');
  return glass === 'mica' || glass === 'vibrancy' ? glass : undefined;
}

/**
 * Marks <html> with data-glass before the first paint, so index.css can let the native material
 * show through the window chrome from the very first frame.
 */
export function applyWindowGlass(root: HTMLElement, search: string): void {
  const glass = windowGlassFromSearch(search);
  if (glass) root.dataset.glass = glass;
}
