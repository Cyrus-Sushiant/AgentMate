import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { type ITheme, Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { isShortcutLetter } from '@/lib/shortcutKey';
import { pastePathsText, readClipboardPaths } from '@/lib/terminal/pasteFiles';
import { commandForEvent, useShortcutStore } from '@/stores/shortcutStore';

// Same fill as `.terminal-well` so leftover cells after a fit() don't read as a
// nested black rectangle inside the panel.
export const TERMINAL_WELL_BG = '#0a1210';

export const TERMINAL_THEME: ITheme = {
  background: TERMINAL_WELL_BG,
  foreground: '#d4ddd6',
  cursor: '#00e572',
  cursorAccent: TERMINAL_WELL_BG,
  selectionBackground: '#00e57240',
  selectionForeground: TERMINAL_WELL_BG,
  black: '#1a1f1c',
  red: '#f07178',
  green: '#00e572',
  yellow: '#e6c07b',
  blue: '#6bb0ff',
  magenta: '#c792ea',
  cyan: '#56d4c1',
  white: '#d4ddd6',
  brightBlack: '#6b756f',
  brightRed: '#ff8b92',
  brightGreen: '#5eec9a',
  brightYellow: '#f0d48a',
  brightBlue: '#8fc4ff',
  brightMagenta: '#d7a6f5',
  brightCyan: '#7ee4d4',
  brightWhite: '#f4f7f5',
};

// Matches xterm.js's own built-in theme: how any CLI would look in an unconfigured terminal,
// used for Workspace panes while `workspaceTerminalCustomBackground` is off.
export const CLI_DEFAULT_THEME: ITheme = {
  background: '#000000',
  foreground: '#ffffff',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selectionBackground: '#ffffff40',
  black: '#000000',
  red: '#cc0000',
  green: '#4e9a06',
  yellow: '#c4a000',
  blue: '#3465a4',
  magenta: '#75507b',
  cyan: '#06989a',
  white: '#d3d7cf',
  brightBlack: '#555753',
  brightRed: '#ef2929',
  brightGreen: '#8ae234',
  brightYellow: '#fce94f',
  brightBlue: '#729fcf',
  brightMagenta: '#ad7fa8',
  brightCyan: '#34e2e2',
  brightWhite: '#eeeeec',
};

function srgbChannelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white), of a `#rrggbb` color. */
function relativeLuminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/**
 * Builds a theme around a custom background. The accent hues (red, green, yellow, …) stay put,
 * since programs count on those being recognizable, but the achromatic ends of the palette
 * (foreground, black/white, the cursor) flip so text stays readable whichever way the chosen
 * color leans.
 */
function customTerminalTheme(background: string): ITheme {
  const light = relativeLuminance(background) > 0.5;
  const dim = light ? '#4a5650' : '#6b756f';
  const dimmer = light ? '#0d100e' : '#f4f7f5';
  const ink = light ? '#1a1f1c' : '#d4ddd6';
  return {
    background,
    foreground: ink,
    cursor: '#00e572',
    cursorAccent: background,
    selectionBackground: '#00e57240',
    selectionForeground: background,
    black: ink,
    red: '#f07178',
    green: '#00e572',
    yellow: '#e6c07b',
    blue: '#6bb0ff',
    magenta: '#c792ea',
    cyan: '#56d4c1',
    white: ink,
    brightBlack: dim,
    brightRed: '#ff8b92',
    brightGreen: '#5eec9a',
    brightYellow: '#f0d48a',
    brightBlue: '#8fc4ff',
    brightMagenta: '#d7a6f5',
    brightCyan: '#7ee4d4',
    brightWhite: dimmer,
  };
}

export interface WorkspaceTerminalBackground {
  customBackground: boolean;
  backgroundColor: string;
}

/** The xterm theme and the flat fill color behind it (for the CSS `--terminal-bg` variable). */
export function resolveWorkspaceTerminalTheme(settings: WorkspaceTerminalBackground): {
  theme: ITheme;
  wellBackground: string;
} {
  if (!settings.customBackground) {
    return { theme: CLI_DEFAULT_THEME, wellBackground: CLI_DEFAULT_THEME.background as string };
  }
  return {
    theme: customTerminalTheme(settings.backgroundColor),
    wellBackground: settings.backgroundColor,
  };
}

export interface XtermHandle {
  term: Terminal;
  fit: FitAddon;
}

export interface CreateXtermOptions {
  /** Where typed text and pastes go. Returning null drops them (the shell is not ready yet). */
  sessionId: () => string | null;
  /**
   * Extra keys to hand back to the window instead of the shell, for shortcuts that only
   * exist on one surface (the workspace's pane and tab keys).
   */
  passThrough?: (event: KeyboardEvent) => boolean;
  /** Defaults to the app's own dark theme (used by the terminal drawer). */
  theme?: ITheme;
  /** Defaults to the local pty channel; an SSH pane passes its own client's write instead. */
  write?: (sessionId: string, data: string) => void;
}

/**
 * Builds an xterm with the app's look and keyboard conventions. The caller opens it into
 * an element and wires it to a pty session.
 */
export function createXterm({
  sessionId,
  passThrough,
  theme = TERMINAL_THEME,
  write = (id, data) => void window.agentmat.terminal.write(id, data),
}: CreateXtermOptions): XtermHandle {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const term = new Terminal({
    convertEol: true,
    fontSize: 13,
    lineHeight: 1.35,
    fontFamily:
      "'Cascadia Code', 'Cascadia Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    theme,
    cursorBlink: !reduceMotion,
    cursorStyle: 'bar',
    cursorWidth: 2,
    scrollback: 5000,
    scrollSensitivity: 1.2,
    smoothScrollDuration: reduceMotion ? 0 : 140,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  // Ctrl/Cmd+click opens a URL, as in VS Code: a plain click is how text gets selected.
  term.loadAddon(
    new WebLinksAddon((event, uri) => {
      if (event.ctrlKey || event.metaKey) void window.agentmat.shell.openExternal(uri);
    }),
  );

  term.onData((data) => {
    const id = sessionId();
    if (id) write(id, data);
  });

  // Ctrl/Cmd+C copies the selection instead of sending SIGINT, matching Windows
  // Terminal/VS Code conventions. With no selection it falls through to xterm's
  // default handling so ^C still interrupts the running process.
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      isShortcutLetter(event, 'c') &&
      term.hasSelection()
    ) {
      void navigator.clipboard.writeText(term.getSelection());
      return false;
    }
    // Hand app shortcuts (Ctrl+T and friends) back to the window listener
    // instead of writing them to the pty. Returning false makes xterm ignore
    // the key entirely, so it keeps bubbling.
    if (commandForEvent(event, useShortcutStore.getState().overrides, true) !== null) {
      return false;
    }
    return !passThrough?.(event);
  });

  return { term, fit };
}

/**
 * Right-click copies the selection if there is one, otherwise pastes clipboard contents
 * into the shell, the standard behavior for Windows/Linux terminals. Returns a cleanup.
 */
export function attachTerminalContextMenu(
  element: HTMLElement,
  term: Terminal,
  sessionId: () => string | null,
  write: (sessionId: string, data: string) => void = (id, data) =>
    void window.agentmat.terminal.write(id, data),
  shell: () => string | undefined = () => undefined,
): () => void {
  const handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const selection = term.getSelection();
    if (selection) {
      void navigator.clipboard.writeText(selection);
      term.clearSelection();
      return;
    }
    void navigator.clipboard.readText().then(async (text) => {
      const id = sessionId();
      if (!id) return;
      if (text) {
        write(id, text);
        return;
      }
      // No text: a screenshot or copied files paste as their paths, for agent CLIs.
      const paths = await readClipboardPaths();
      if (paths) write(id, pastePathsText(paths, shell()));
    });
  };
  element.addEventListener('contextmenu', handleContextMenu);
  return () => element.removeEventListener('contextmenu', handleContextMenu);
}
