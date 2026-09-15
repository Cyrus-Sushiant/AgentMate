/**
 * xterm measures its character cell once, when it opens. If the terminal font is still
 * loading at that moment it measures a narrower fallback, the fit sizes the grid for those
 * cells, and once the real font lands every row runs past the right edge (a TUI's right-aligned
 * text and borders get cut off). Waiting for the font first, and refitting whenever fonts
 * finish loading later, keeps the grid matched to what is actually drawn.
 */

/** The face terminals ask for first; the fallbacks need no waiting. */
const TERMINAL_FONT = "13px 'Cascadia Code'";

let ready: Promise<void> | null = null;

export function whenTerminalFontReady(): Promise<void> {
  ready ??= (async () => {
    try {
      await document.fonts?.load(TERMINAL_FONT);
      await document.fonts?.ready;
    } catch {
      // A font that fails to load leaves the fallback, which measures correctly anyway.
    }
  })();
  return ready;
}

/** Runs `refit` whenever the page finishes loading fonts. Returns a cleanup. */
export function onFontsLoaded(refit: () => void): () => void {
  const fonts = document.fonts;
  if (!fonts) return () => undefined;
  const handler = (): void => refit();
  fonts.addEventListener('loadingdone', handler);
  return () => fonts.removeEventListener('loadingdone', handler);
}
