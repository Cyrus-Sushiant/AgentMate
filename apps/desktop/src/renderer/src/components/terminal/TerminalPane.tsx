import { FitAddon } from '@xterm/addon-fit';
import { type ITheme, Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { isShortcutLetter } from '@/lib/shortcutKey';
import { commandForEvent, useShortcutStore } from '@/stores/shortcutStore';
import type { TerminalSessionMeta } from '@/stores/terminalStore';

// Same fill as `.terminal-well` so leftover cells after a fit() don't read as a
// nested black rectangle inside the panel.
const TERMINAL_WELL_BG = '#0a1210';

const TERMINAL_THEME: ITheme = {
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

export interface TerminalPaneProps {
  meta: TerminalSessionMeta;
  active: boolean;
  onExit: () => void;
}

export function TerminalPane({ meta, active, onExit }: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per mount; the pty session and terminal instance are managed via refs/closures, not props
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const term = new Terminal({
      convertEol: true,
      fontSize: 13,
      lineHeight: 1.35,
      fontFamily:
        "'Cascadia Code', 'Cascadia Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      theme: TERMINAL_THEME,
      cursorBlink: !reduceMotion,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 5000,
      scrollSensitivity: 1.2,
      smoothScrollDuration: reduceMotion ? 0 : 140,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    termRef.current = term;

    let ptySessionId: string | null = null;
    let disposed = false;

    const resizeObserver = new ResizeObserver(() => {
      // A hidden pane (inactive tab, or the whole drawer closed) measures 0x0.
      // Fitting to that would reflow the running program's output to a garbage
      // size, so wait until it is on screen again. Hiding must not disturb the pty.
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      try {
        fitAddon.fit();
        if (ptySessionId) {
          void window.agentmat.terminal.resize(ptySessionId, term.cols, term.rows);
        }
      } catch {
        // xterm can still reject a transient measurement mid-layout; ignore
      }
    });
    resizeObserver.observe(container);

    const dataDisposable = term.onData((data) => {
      if (ptySessionId) void window.agentmat.terminal.write(ptySessionId, data);
    });

    // Ctrl/Cmd+C copies the selection instead of sending SIGINT, matching Windows
    // Terminal/VS Code conventions. With no selection it falls through to xterm's
    // default handling so ^C still interrupts the running process.
    term.attachCustomKeyEventHandler((event) => {
      if (
        event.type === 'keydown' &&
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
      if (
        event.type === 'keydown' &&
        commandForEvent(event, useShortcutStore.getState().overrides, true) !== null
      ) {
        return false;
      }
      return true;
    });

    // Right-click copies the selection if there is one, otherwise pastes clipboard
    // contents into the shell, the standard behavior for Windows/Linux terminals.
    const handleContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      const selection = term.getSelection();
      if (selection) {
        void navigator.clipboard.writeText(selection);
        term.clearSelection();
      } else {
        void navigator.clipboard.readText().then((text) => {
          if (text && ptySessionId) void window.agentmat.terminal.write(ptySessionId, text);
        });
      }
    };
    container.addEventListener('contextmenu', handleContextMenu);

    let unsubscribeData: (() => void) | undefined;
    let unsubscribeExit: (() => void) | undefined;

    void window.agentmat.terminal
      .create({
        cwd: meta.cwd,
        shell: meta.shell,
        initialInput: meta.initialInput,
        projectId: meta.projectId,
      })
      .then((id) => {
        if (disposed) {
          void window.agentmat.terminal.kill(id);
          return;
        }
        ptySessionId = id;
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          fitAddon.fit();
          void window.agentmat.terminal.resize(id, term.cols, term.rows);
        }

        unsubscribeData = window.agentmat.terminal.onData((payload) => {
          if (payload.sessionId === id) term.write(payload.data);
        });
        unsubscribeExit = window.agentmat.terminal.onExit((payload) => {
          if (payload.sessionId === id) onExitRef.current();
        });
      });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      container.removeEventListener('contextmenu', handleContextMenu);
      dataDisposable.dispose();
      unsubscribeData?.();
      unsubscribeExit?.();
      if (ptySessionId) void window.agentmat.terminal.kill(ptySessionId);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // Newly opened sessions and tab switches both need to move DOM focus into xterm's hidden
  // textarea. Without it, keystrokes (e.g. Enter to launch, Ctrl+V to paste an install command)
  // go wherever focus already was (often the button that opened this session) instead of the pty.
  useEffect(() => {
    if (active) termRef.current?.focus();
  }, [active]);

  return (
    <div ref={containerRef} className={active ? 'terminal-pane absolute inset-0' : 'hidden'} />
  );
}
