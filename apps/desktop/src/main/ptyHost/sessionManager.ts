import { release } from 'node:os';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal as HeadlessTerminal } from '@xterm/headless';
import * as pty from 'node-pty';
import type {
  CreateOrAttachPayload,
  CreateOrAttachResult,
  HostSessionInfo,
  SpawnSessionOptions,
} from './protocol';
import { buildShellLaunch } from './shellIntegration';

/**
 * Lines of history kept per session for repainting a terminal after the app reconnects.
 * Every session holds its own emulator, so this is a memory trade-off, not a UI one.
 */
const SNAPSHOT_SCROLLBACK = 3000;

/** A shell gone sooner than this never reached a prompt, which is worth a line in the log. */
const IMMEDIATE_EXIT_MS = 1000;

/** Same ConPTY hint the app's own terminals get, so the snapshot grows and shrinks like they do. */
const WINDOWS_PTY =
  process.platform === 'win32'
    ? { backend: 'conpty' as const, buildNumber: Number(release().split('.')[2]) || undefined }
    : undefined;

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
  /** The size the pty was last given. The emulator catches up to it once its queue drains. */
  cols: number;
  rows: number;
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

  constructor(
    private readonly onSessionsChanged: () => void = () => undefined,
    /** Where notes about a shell that misbehaved go. The host writes its own log file; the
     * in-process fallback has main's console. */
    private readonly log: (message: string) => void = () => undefined,
  ) {}

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
    const launch = buildShellLaunch(options.shell, process.platform, options.env);
    const ptyProcess = pty.spawn(options.shell, launch.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: options.cwd ?? process.env.HOME ?? process.env.USERPROFILE,
      env: { ...shellEnv(options.env), ...launch.env },
    });
    // Mirrors the options the app's own xterm uses, so what gets serialized reads back the
    // same way it was drawn the first time.
    const emulator = new HeadlessTerminal({
      cols,
      rows,
      scrollback: SNAPSHOT_SCROLLBACK,
      allowProposedApi: true,
      windowsPty: WINDOWS_PTY,
    });
    const serializer = new SerializeAddon();
    // The addon's typings name the browser Terminal; the headless one exposes the same API.
    emulator.loadAddon(serializer as unknown as Parameters<HeadlessTerminal['loadAddon']>[0]);

    const session: Session = {
      id: options.sessionId,
      pty: ptyProcess,
      emulator,
      serializer,
      cols,
      rows,
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
      // A shell that dies this fast never started: a missing binary, or a pty backend that
      // cannot run its helper. The pane just goes blank, so say so somewhere.
      if (Date.now() - session.createdAt < IMMEDIATE_EXIT_MS) {
        this.log(`${options.shell} exited immediately with code ${exitCode}`);
      }
      // An attach in progress reports the exit itself once its snapshot is out.
      if (session.attaching.length === 0) this.finish(session);
    });

    if (options.initialInput) ptyProcess.write(options.initialInput);
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
    if (session.cols === cols && session.rows === rows) return;
    try {
      session.pty.resize(cols, rows);
    } catch {
      // resizing a pty that has just exited throws on Windows
      return;
    }
    session.cols = cols;
    session.rows = rows;
    // Output the emulator was handed but has not parsed yet was written for the old size.
    // Resizing on the spot would lay it out at the new one, and every later snapshot would
    // carry that damage, so the resize waits behind it. A snapshot requested after this call
    // queues behind the resize in turn.
    session.emulator.write('', () => {
      if (this.sessions.get(session.id) !== session) return;
      session.emulator.resize(cols, rows);
    });
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
