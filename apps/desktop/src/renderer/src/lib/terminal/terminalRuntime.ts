import { cleanTerminalTitle } from '@agentmat/core';
import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';
import { create } from 'zustand';
import { commandForEvent, useShortcutStore } from '@/stores/shortcutStore';
import { useTerminalAppearanceStore } from '@/stores/terminalAppearanceStore';
import { useThemeStore } from '@/stores/themeStore';
import { onFontsLoaded, whenTerminalFontReady } from './fontReady';
import { attachFilePaste } from './pasteFiles';
import {
  attachTerminalContextMenu,
  createXterm,
  resolveWorkspaceTerminalTheme,
} from './xtermFactory';

function currentTerminalTheme(): ReturnType<typeof resolveWorkspaceTerminalTheme> {
  const { customBackground, backgroundColor } = useTerminalAppearanceStore.getState();
  return resolveWorkspaceTerminalTheme(
    { customBackground, backgroundColor },
    useThemeStore.getState().theme,
  );
}

function applyTerminalTheme(entry: Entry): void {
  const { theme, wellBackground } = currentTerminalTheme();
  entry.term.options.theme = theme;
  entry.host.style.setProperty('--terminal-bg', wellBackground);
}

/**
 * Workspace terminals outlive the React components that show them. Switching projects,
 * reshaping a split or leaving the page would otherwise dispose every xterm and repaint it
 * from a snapshot on return. Instead each terminal lives here, and a pane borrows its DOM
 * element while on screen and hands it back to a hidden parking spot when it goes away.
 * The element keeps receiving output the whole time.
 */

export interface RuntimeSessionSpec {
  id: string;
  projectId: string;
  cwd?: string;
  shell?: string;
  cliId?: string;
  /** Typed into a brand-new shell once, e.g. the command that starts an agent. */
  initialInput?: string;
  /** From a previous run of the app: only reconnect, never start a new shell. */
  restored?: boolean;
}

interface Entry {
  spec: RuntimeSessionSpec;
  term: Terminal;
  fit: FitAddon;
  host: HTMLDivElement;
  /** The unpadded element xterm renders into, inside `host`. */
  surface: HTMLDivElement;
  opened: boolean;
  /** Focus was asked for before the terminal opened. */
  focusWhenOpen: boolean;
  started: boolean;
  /** Set once the snapshot is painted; until then output waits in `pending`. */
  ready: boolean;
  pending: string[];
  exitCode: number | null | undefined;
  mounted: boolean;
  lastVisibleAt: number;
  cleanups: (() => void)[];
}

/** Parked terminals past this count are disposed, oldest first. Their shells keep running. */
const MAX_LIVE_TERMINALS = 24;

const entries = new Map<string, Entry>();
/** Sessions this renderer already started, so a re-created entry reconnects instead. */
const startedOnce = new Set<string>();

interface SessionUiState {
  /** Sessions whose shell has ended. `null` means it did not survive an app restart. */
  ended: Record<string, number | null>;
  /** The latest window title each session's program set, cleaned up for display. */
  titles: Record<string, string>;
}

export const useTerminalSessionStore = create<SessionUiState>(() => ({ ended: {}, titles: {} }));

function markEnded(id: string, exitCode: number | null): void {
  useTerminalSessionStore.setState((state) => ({ ended: { ...state.ended, [id]: exitCode } }));
}

function forgetUiState(id: string): void {
  useTerminalSessionStore.setState((state) => {
    const { [id]: _ended, ...ended } = state.ended;
    const { [id]: _title, ...titles } = state.titles;
    return { ended, titles };
  });
}

let subscribed = false;

function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  // Flipping the Settings toggle or picking a new color repaints every live terminal at once,
  // not just the next one created.
  useTerminalAppearanceStore.subscribe(() => {
    for (const entry of entries.values()) applyTerminalTheme(entry);
  });
  // Same for switching the app theme itself, since vscode-dark/vs2026 change the default
  // terminal palette too.
  useThemeStore.subscribe(() => {
    for (const entry of entries.values()) applyTerminalTheme(entry);
  });
  // A font that finishes loading later changes the cell size; refit so rows match it again.
  onFontsLoaded(() => {
    for (const entry of entries.values()) {
      if (entry.mounted) fitAndResize(entry);
    }
  });
  window.agentmat.terminal.onData(({ sessionId, data }) => {
    const entry = entries.get(sessionId);
    if (!entry) return;
    if (entry.ready) entry.term.write(data);
    else entry.pending.push(data);
  });
  window.agentmat.terminal.onExit(({ sessionId, exitCode }) => {
    const entry = entries.get(sessionId);
    if (entry && !entry.ready) {
      entry.exitCode = exitCode;
      return;
    }
    markEnded(sessionId, exitCode);
  });
}

function parkingLot(): HTMLElement {
  let lot = document.getElementById('terminal-parking');
  if (!lot) {
    lot = document.createElement('div');
    lot.id = 'terminal-parking';
    lot.setAttribute('aria-hidden', 'true');
    lot.style.cssText =
      'position:fixed;left:-100000px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;';
    document.body.appendChild(lot);
  }
  return lot;
}

function hasSize(entry: Entry): boolean {
  return entry.surface.clientWidth > 0 && entry.surface.clientHeight > 0;
}

function fitAndResize(entry: Entry): void {
  if (!entry.opened || !hasSize(entry)) return;
  try {
    entry.fit.fit();
    if (entry.ready) {
      void window.agentmat.terminal.resize(entry.spec.id, entry.term.cols, entry.term.rows);
    }
  } catch {
    // xterm can reject a transient measurement mid-layout; the next observation fixes it
  }
}

function createEntry(spec: RuntimeSessionSpec): Entry {
  const host = document.createElement('div');
  host.className = 'terminal-pane absolute inset-0';
  // xterm opens into an inner box with no padding of its own. The fit addon measures the
  // element it opened in by its CSS size, which with border-box sizing includes padding,
  // so opening straight into the padded host sized the grid past the visible area.
  const surface = document.createElement('div');
  surface.style.cssText = 'width:100%;height:100%;overflow:hidden;';
  host.appendChild(surface);
  const { theme, wellBackground } = currentTerminalTheme();
  host.style.setProperty('--terminal-bg', wellBackground);
  const { term, fit } = createXterm({
    sessionId: () => (entries.get(spec.id)?.ready ? spec.id : null),
    // Workspace pane, tab and diff keys go to the app, whatever the user bound them to.
    // Diff navigation is left out: a focused terminal is never showing a diff, and the key
    // (F7 by default) may mean something to the program running in it.
    passThrough: (event) => {
      const id = commandForEvent(event, useShortcutStore.getState().overrides, true, 'workspace');
      return id !== null && id !== 'workspace.nextChange' && id !== 'workspace.prevChange';
    },
    theme,
  });
  const entry: Entry = {
    spec,
    term,
    fit,
    host,
    surface,
    opened: false,
    focusWhenOpen: false,
    started: false,
    ready: false,
    pending: [],
    exitCode: undefined,
    mounted: false,
    lastVisibleAt: Date.now(),
    cleanups: [],
  };
  const titleListener = term.onTitleChange((raw) => {
    const { title } = cleanTerminalTitle(raw);
    useTerminalSessionStore.setState((state) =>
      state.titles[spec.id] === title ? state : { titles: { ...state.titles, [spec.id]: title } },
    );
  });
  const observer = new ResizeObserver(() => fitAndResize(entry));
  observer.observe(host);
  entry.cleanups.push(
    () => titleListener.dispose(),
    () => observer.disconnect(),
  );
  entries.set(spec.id, entry);
  return entry;
}

function start(entry: Entry): void {
  entry.started = true;
  const { spec } = entry;
  const reconnectOnly = spec.restored === true || startedOnce.has(spec.id);
  startedOnce.add(spec.id);
  if (hasSize(entry)) entry.fit.fit();

  void window.agentmat.terminal
    .create({
      sessionId: spec.id,
      attachOnly: reconnectOnly,
      cwd: spec.cwd,
      shell: spec.shell,
      initialInput: reconnectOnly ? undefined : spec.initialInput,
      projectId: spec.projectId,
      cliId: spec.cliId,
      surface: 'workspace',
      ...(hasSize(entry) ? { cols: entry.term.cols, rows: entry.term.rows } : {}),
    })
    .then((result) => {
      if (entries.get(spec.id) !== entry) return;
      if (!result) {
        markEnded(spec.id, null);
        return;
      }
      const release = (): void => {
        if (entries.get(spec.id) !== entry) return;
        entry.ready = true;
        for (const chunk of entry.pending) entry.term.write(chunk);
        entry.pending = [];
        if (entry.exitCode !== undefined) {
          markEnded(spec.id, entry.exitCode);
          return;
        }
        fitAndResize(entry);
        // Layout can still be settling (a split just opened, a panel animating), so check
        // the size once more after it has, and tell the shell if it moved.
        setTimeout(() => {
          if (entries.get(spec.id) === entry) fitAndResize(entry);
        }, 250);
      };
      const { snapshot } = result;
      if (!snapshot) {
        release();
        return;
      }
      // Repaint at the size the snapshot was taken at, then let the fit reflow it.
      if (snapshot.cols !== entry.term.cols || snapshot.rows !== entry.term.rows) {
        entry.term.resize(snapshot.cols, snapshot.rows);
      }
      entry.term.write(snapshot.data, release);
    })
    .catch(() => {
      if (entries.get(spec.id) === entry) {
        entry.term.write('\r\n\x1b[31mCould not start this terminal.\x1b[0m\r\n');
      }
    });
}

function disposeEntry(entry: Entry): void {
  for (const cleanup of entry.cleanups) cleanup();
  entry.term.dispose();
  entry.host.remove();
  entries.delete(entry.spec.id);
}

function evictParked(): void {
  if (entries.size <= MAX_LIVE_TERMINALS) return;
  const parked = [...entries.values()]
    .filter((entry) => !entry.mounted)
    .sort((a, b) => a.lastVisibleAt - b.lastVisibleAt);
  for (const entry of parked) {
    if (entries.size <= MAX_LIVE_TERMINALS) break;
    disposeEntry(entry);
  }
}

export const terminalRuntime = {
  /** Shows a session's terminal inside `slot`, creating it (and its shell) on first use. */
  mount(spec: RuntimeSessionSpec, slot: HTMLElement): void {
    ensureSubscribed();
    const entry = entries.get(spec.id) ?? createEntry(spec);
    entry.mounted = true;
    entry.lastVisibleAt = Date.now();
    if (entry.host.parentElement !== slot) slot.appendChild(entry.host);
    if (entry.opened) {
      fitAndResize(entry);
      return;
    }
    // Opening measures the character cell, so it waits for the terminal font (instant once
    // loaded). Measuring a fallback font would size the grid wider than what gets drawn.
    void whenTerminalFontReady().then(() => {
      if (entries.get(spec.id) !== entry || entry.opened) return;
      entry.term.open(entry.surface);
      entry.opened = true;
      entry.cleanups.push(
        attachTerminalContextMenu(
          entry.host,
          entry.term,
          () => spec.id,
          undefined,
          () => spec.shell,
        ),
        // Screenshots and copied files paste as paths, so agent CLIs can pick them up.
        attachFilePaste(
          entry.host,
          () => spec.shell,
          (text) => entry.term.paste(text),
        ),
      );
      if (entry.focusWhenOpen) {
        entry.focusWhenOpen = false;
        entry.term.focus();
      }
      if (!entry.started) start(entry);
      else fitAndResize(entry);
    });
  },

  /** Takes the terminal off screen. It keeps running and receiving output. */
  unmount(id: string, slot: HTMLElement): void {
    const entry = entries.get(id);
    // Another pane may already have claimed it (a tab moved between groups).
    if (!entry || entry.host.parentElement !== slot) return;
    entry.mounted = false;
    entry.lastVisibleAt = Date.now();
    parkingLot().appendChild(entry.host);
    evictParked();
  },

  focus(id: string): void {
    const entry = entries.get(id);
    if (!entry) return;
    // A terminal still waiting on its font is not open yet; take focus the moment it is.
    if (entry.opened) entry.term.focus();
    else entry.focusWhenOpen = true;
  },

  /** Types text into the session as if the user had, e.g. a dropped file path. */
  paste(id: string, text: string): void {
    const entry = entries.get(id);
    if (entry?.ready) entry.term.paste(text);
  },

  /** Drops the terminal for good. Ending the shell itself is the caller's call. */
  dispose(id: string): void {
    const entry = entries.get(id);
    if (entry) disposeEntry(entry);
    startedOnce.delete(id);
    forgetUiState(id);
  },
};
