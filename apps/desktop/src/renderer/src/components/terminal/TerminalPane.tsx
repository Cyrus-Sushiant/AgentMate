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

    let ptySessionId: string | null = null;
    let disposed = false;

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (ptySessionId) {
          void window.agentmat.terminal.resize(ptySessionId, term.cols, term.rows);
        }
      } catch {
        // container may have zero size briefly while hidden; ignore
      }
    });
    resizeObserver.observe(container);

    const dataDisposable = term.onData((data) => {
      if (ptySessionId) void window.agentmat.terminal.write(ptySessionId, data);
    });

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
        fitAddon.fit();
        void window.agentmat.terminal.resize(id, term.cols, term.rows);

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
      dataDisposable.dispose();
      unsubscribeData?.();
      unsubscribeExit?.();
      if (ptySessionId) void window.agentmat.terminal.kill(ptySessionId);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={active ? 'h-full w-full p-2' : 'hidden'} />;
}
