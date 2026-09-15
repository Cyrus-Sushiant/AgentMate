import type { CreateTerminalOptions, TerminalAttachResult } from '@shared/apiTypes';

// Not exported from apiTypes.ts (they're local to preload/index.ts), so re-declared here to
// match window.agentmat.terminal's payload shape structurally.
interface TerminalDataPayload {
  sessionId: string;
  data: string;
}
interface TerminalExitPayload {
  sessionId: string;
  exitCode: number;
}

/**
 * Anything thrown in the main process's `ssh:create` handler (a real connect failure, most of
 * the time) reaches here wrapped in Electron's "Error invoking remote method 'ssh:create': ..."
 * boilerplate, which is not what belongs in the terminal pane's error line.
 */
function unwrapIpcError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(String(error));
  const message = error.message
    .replace(/^Error invoking remote method '[^']*':\s*/, '')
    .replace(/^(Error|TypeError):\s*/, '')
    .trim();
  return new Error(message || error.message);
}

/**
 * Wraps `window.agentmat.ssh.*` behind the same shape as `window.agentmat.terminal`, so
 * `TerminalPane` can pick a client by session kind without branching through the rest of its
 * effect (pending-output buffering, resize, dispose). SSH sessions never reattach in v1: there
 * is no snapshot and `create` always starts a fresh connection.
 */
export function sshTerminalAdapter(sshServerId: string): {
  create: (options?: CreateTerminalOptions) => Promise<TerminalAttachResult | null>;
  write: (sessionId: string, data: string) => Promise<void>;
  resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  kill: (sessionId: string) => Promise<void>;
  onData: (callback: (payload: TerminalDataPayload) => void) => () => void;
  onExit: (callback: (payload: TerminalExitPayload) => void) => () => void;
} {
  return {
    create: async (options = {}): Promise<TerminalAttachResult | null> => {
      try {
        const result = await window.agentmat.ssh.create({
          sessionId: options.sessionId,
          savedServerId: sshServerId,
          cols: options.cols,
          rows: options.rows,
        });
        return { sessionId: result.sessionId, isNew: true, snapshot: null };
      } catch (error) {
        throw unwrapIpcError(error);
      }
    },
    write: (sessionId, data) => window.agentmat.ssh.write(sessionId, data),
    resize: (sessionId, cols, rows) => window.agentmat.ssh.resize(sessionId, cols, rows),
    kill: (sessionId) => window.agentmat.ssh.kill(sessionId),
    onData: (callback) => window.agentmat.ssh.onData(callback),
    onExit: (callback) =>
      window.agentmat.ssh.onExit((payload) =>
        callback({ sessionId: payload.sessionId, exitCode: payload.error ? 1 : 0 }),
      ),
  };
}
