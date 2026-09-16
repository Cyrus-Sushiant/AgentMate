import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal as HeadlessTerminal } from '@xterm/headless';
import * as pty from 'node-pty';
import type {
  CreateOrAttachPayload,
  CreateOrAttachResult,
  HostSessionInfo,
  SpawnSessionOptions,
} from './protocol';
import { buildPromptMarkerScript } from './shellIntegration';

/**
 * Lines of history kept per session for repainting a terminal after the app reconnects.
 * Every session holds its own emulator, so this is a memory trade-off, not a UI one.
 */
const SNAPSHOT_SCROLLBACK = 3000;

/** Whoever currently shows a session. Output goes to exactly one listener at a time. */
export interface SessionListener {
  onData(sessionId: string, data: string): void;
  onExit(sessionId: string, exitCode: number): void;
}

interface Session {
  id: string;
  pty: pty.IPty;
  emulator: HeadlessTerminal;
  serializer: SerializeAddon;
  projectId?: string;
  createdAt: number;
  listener: SessionListener | null;
  /**
   * Attaches waiting for the emulator to catch up. Output that arrives in that window is not
   * in their snapshot yet, so each holds on to it and gets it right after the snapshot.
   */
  attaching: PendingAttach[];
  exitCode: number | null;
}

interface PendingAttach {
  listener: SessionListener;
  held: string[];
}

function shellEnv(env: Record<string, string> | undefined): Record<string, string> {
  const result = { ...(env ?? (process.env as Record<string, string>)) };
  // The host runs the Electron binary as plain Node. Leaking that into the shell would
  // make anything Electron-based started from it (AgentMate, VS Code) boot as Node too.
  delete result.ELECTRON_RUN_AS_NODE;
  return result;
}

/**
 * Owns the running shells. The same class backs both the background host process and the
 * in-process fallback, so a terminal behaves the same whichever one ends up running it.
 */
export class PtySessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly onSessionsChanged: () => void = () => undefined) {}

  get size(): number {
    return this.sessions.size;
  }

  list(): HostSessionInfo[] {
    return [...this.sessions.values()].map((session) => ({
      sessionId: session.id,
      projectId: session.projectId,
      createdAt: session.createdAt,
      pid: session.pty.pid,
    }));
  }

  async createOrAttach(
    payload: CreateOrAttachPayload,
    listener: SessionListener,
  ): Promise<CreateOrAttachResult | null> {
    const existing = this.sessions.get(payload.sessionId);
    if (existing) return this.attach(existing, payload, listener);
    if (payload.attachOnly) return null;
    this.spawn(payload, listener);
    return { isNew: true, snapshot: null };
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.exitCode !== null) return;
    try {
      session.pty.write(data);
    } catch {
      // the shell exited between the lookup and the write
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) this.resizeSession(session, cols, rows);
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    session.listener = null;
    try {
      session.pty.kill();
    } catch {
      // already gone
    }
    session.emulator.dispose();
    this.onSessionsChanged();
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }

  /** Stops sending output to this listener. The shells keep running. */
  detachListener(listener: SessionListener): void {
    for (const session of this.sessions.values()) {
      if (session.listener === listener) session.listener = null;
    }
  }

  private spawn(options: SpawnSessionOptions, listener: SessionListener): void {
    const cols = options.cols ?? 80;
    const rows = options.rows ?? 24;
    const ptyProcess = pty.spawn(options.shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: options.cwd ?? process.env.HOME ?? process.env.USERPROFILE,
      env: shellEnv(options.env),
    });
    // Mirrors the options the app's own xterm uses, so what gets serialized reads back the
    // same way it was drawn the first time.
    const emulator = new HeadlessTerminal({
      cols,
      rows,
      scrollback: SNAPSHOT_SCROLLBACK,
      convertEol: true,
      allowProposedApi: true,
    });
    const serializer = new SerializeAddon();
    // The addon's typings name the browser Terminal; the headless one exposes the same API.
    emulator.loadAddon(serializer as unknown as Parameters<HeadlessTerminal['loadAddon']>[0]);

    const session: Session = {
      id: options.sessionId,
      pty: ptyProcess,
      emulator,
      serializer,
      projectId: options.projectId,
      createdAt: Date.now(),
      listener,
      attaching: [],
      exitCode: null,
    };
    this.sessions.set(session.id, session);

    ptyProcess.onData((data) => {
      emulator.write(data);
      for (const pending of session.attaching) pending.held.push(data);
      session.listener?.onData(session.id, data);
    });
    ptyProcess.onExit(({ exitCode }) => {
      session.exitCode = exitCode;
      // An attach in progress reports the exit itself once its snapshot is out.
      if (session.attaching.length === 0) this.finish(session);
    });

    const marker = buildPromptMarkerScript(options.shell, process.platform, options.env);
    const bootstrap = (marker ?? '') + (options.initialInput ?? '');
    if (bootstrap) ptyProcess.write(bootstrap);
    this.onSessionsChanged();
  }

  private attach(
    session: Session,
    payload: CreateOrAttachPayload,
    listener: SessionListener,
  ): Promise<CreateOrAttachResult> {
    if (payload.cols && payload.rows) this.resizeSession(session, payload.cols, payload.rows);
    session.listener = null;
    const pending: PendingAttach = { listener, held: [] };
    session.attaching.push(pending);

    return new Promise((resolve) => {
      // An empty write lands behind everything already queued, so its callback fires once
      // the emulator has parsed every byte that reached it before this attach.
      session.emulator.write('', () => {
        const snapshot = {
          data: session.serializer.serialize({ scrollback: SNAPSHOT_SCROLLBACK }),
          cols: session.emulator.cols,
          rows: session.emulator.rows,
        };
        resolve({ isNew: false, snapshot });
        // The response has to reach the client before the output that follows it, so the
        // hand-over runs on the next tick, after the caller has sent the result.
        setImmediate(() => {
          const index = session.attaching.indexOf(pending);
          if (index !== -1) session.attaching.splice(index, 1);
          // A later attach to the same session supersedes this one; it takes over instead.
          if (session.attaching.length > 0 || this.sessions.get(session.id) !== session) return;
          session.listener = listener;
          for (const chunk of pending.held) listener.onData(session.id, chunk);
          if (session.exitCode !== null) this.finish(session);
        });
      });
    });
  }

  private resizeSession(session: Session, cols: number, rows: number): void {
    if (cols < 1 || rows < 1) return;
    if (session.emulator.cols === cols && session.emulator.rows === rows) return;
    try {
      session.pty.resize(cols, rows);
      session.emulator.resize(cols, rows);
    } catch {
      // resizing a pty that has just exited throws on Windows
    }
  }

  private finish(session: Session): void {
    if (this.sessions.get(session.id) !== session) return;
    this.sessions.delete(session.id);
    session.listener?.onExit(session.id, session.exitCode ?? 0);
    session.listener = null;
    session.emulator.dispose();
    this.onSessionsChanged();
  }
}
