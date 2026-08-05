import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TerminalSessionMeta } from '@/stores/terminalStore';

// Transparent background so the drawer's glass surface shows through;
// see the allowTransparency flag below.
const TERMINAL_THEME = {
  background: '#00000000',
  foreground: '#e4e4e7',
  cursor: '#00e572',
  selectionBackground: '#00e57233',
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      convertEol: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: TERMINAL_THEME,
      cursorBlink: true,
      allowTransparency: true,
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
        event.key.toLowerCase() === 'c' &&
        term.hasSelection()
      ) {
        void navigator.clipboard.writeText(term.getSelection());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Newly opened sessions and tab switches both need to move DOM focus into xterm's hidden
  // textarea. Without it, keystrokes (e.g. Enter to launch, Ctrl+V to paste an install command)
  // go wherever focus already was (often the button that opened this session) instead of the pty.
  useEffect(() => {
    if (active) termRef.current?.focus();
  }, [active]);

  return <div ref={containerRef} className={active ? 'h-full w-full p-2' : 'hidden'} />;
}
