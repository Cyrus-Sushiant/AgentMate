import { randomUUID } from 'node:crypto';
import { type IpcMainInvokeEvent, ipcMain, powerSaveBlocker, type WebContents } from 'electron';
import type { CreateTerminalOptions, TerminalAttachResult } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import type { HostClient } from '../ptyHost/hostClient';
import { connectToHost } from '../ptyHost/hostLauncher';
import type {
  CreateOrAttachPayload,
  CreateOrAttachResult,
  HostSessionInfo,
} from '../ptyHost/protocol';
import { PtySessionManager, type SessionListener } from '../ptyHost/sessionManager';
import { store } from '../store';

const ALLOWED_SHELLS = ['powershell.exe', 'pwsh.exe', 'cmd.exe', 'bash', 'zsh', 'fish'] as const;
type AllowedShell = (typeof ALLOWED_SHELLS)[number];

function defaultShell(): AllowedShell {
  if (process.platform === 'win32') return 'powershell.exe';
  return (process.env.SHELL?.split('/').pop() as AllowedShell) ?? 'bash';
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** What main knows about each running session, kept for hook replies and the power blocker. */
const sessions = new Map<string, { projectId?: string; createdAt: number }>();
/** The window currently showing each session. Output goes there. */
const owners = new Map<string, WebContents>();

/**
 * Terminals normally run in the background host (see ptyHost/hostEntry.ts), which keeps
 * them alive across quits and updates. If the host cannot start, they run in this process
 * instead, exactly as before the host existed, and end when the app does.
 */
let host: HostClient | null = null;
let local: PtySessionManager | null = null;
let backendReady: Promise<void> | null = null;

/** Set when the upcoming quit is a restart (update install, relaunch) that must keep shells. */
let preserveOnQuit = false;
let quitSettled = false;

// Windows applies "efficiency mode" power throttling to minimized/backgrounded
// apps, which can starve a shell running inside a terminal tab (and, if that
// shell is the dev server the app itself was launched from, take the whole
// app down with it). A blocker held for as long as any session is open keeps
// the process out of that throttled state; it's released once the last
// session closes so the app can still idle normally the rest of the time.
let powerSaveBlockerId: number | null = null;

function syncPowerSaveBlocker(): void {
  if (sessions.size > 0 && powerSaveBlockerId == null) {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  } else if (sessions.size === 0 && powerSaveBlockerId != null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
}

function forwardData(sessionId: string, data: string): void {
  const owner = owners.get(sessionId);
  if (owner && !owner.isDestroyed()) owner.send(IPC.terminal.onData, { sessionId, data });
}

function forwardExit(sessionId: string, exitCode: number): void {
  const owner = owners.get(sessionId);
  if (owner && !owner.isDestroyed()) owner.send(IPC.terminal.onExit, { sessionId, exitCode });
  owners.delete(sessionId);
  sessions.delete(sessionId);
  syncPowerSaveBlocker();
}

const localListener: SessionListener = { onData: forwardData, onExit: forwardExit };

function rememberSessions(list: HostSessionInfo[]): void {
  for (const info of list) {
    sessions.set(info.sessionId, { projectId: info.projectId, createdAt: info.createdAt });
  }
  syncPowerSaveBlocker();
}

async function startBackend(): Promise<void> {
  let connected: Awaited<ReturnType<typeof connectToHost>> = null;
  try {
    connected = await connectToHost();
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: explains why terminals will not survive a restart
    console.warn('[terminal] background host unavailable, running terminals in-process', error);
  }
  if (!connected) {
    local ??= new PtySessionManager();
    return;
  }
  const client = connected.client;
  client.setEvents({
    onData: forwardData,
    onExit: forwardExit,
    onDisconnect: () => {
      if (host !== client) return;
      host = null;
      backendReady = null;
      // The shells died with the host. Close their tabs; the next terminal starts a new host.
      for (const sessionId of [...sessions.keys()]) forwardExit(sessionId, 1);
    },
  });
  host = client;
  rememberSessions(await client.request<HostSessionInfo[]>({ type: 'list' }).catch(() => []));
}

function ensureBackend(): Promise<void> {
  backendReady ??= startBackend();
  return backendReady;
}

/** Starts (or reconnects to) the terminal host early, so the first terminal opens instantly. */
export function startTerminalBackend(): void {
  void ensureBackend();
}

async function createOrAttach(
  payload: CreateOrAttachPayload,
): Promise<CreateOrAttachResult | null> {
  await ensureBackend();
  if (host) {
    return host.request<CreateOrAttachResult | null>({ type: 'createOrAttach', payload });
  }
  local ??= new PtySessionManager();
  return local.createOrAttach(payload, localListener);
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    IPC.terminal.create,
    async (
      event: IpcMainInvokeEvent,
      options: CreateTerminalOptions = {},
    ): Promise<TerminalAttachResult | null> => {
      const shell = ALLOWED_SHELLS.includes(options.shell as AllowedShell)
        ? (options.shell as AllowedShell)
        : defaultShell();
      const sessionId =
        options.sessionId && SESSION_ID_PATTERN.test(options.sessionId)
          ? options.sessionId
          : randomUUID();

      // Registered before the call so output produced while it is in flight has somewhere
      // to go; the pane buffers it until it has painted the snapshot.
      const previousOwner = owners.get(sessionId);
      owners.set(sessionId, event.sender);
      let result: CreateOrAttachResult | null;
      try {
        result = await createOrAttach({
          sessionId,
          shell,
          cwd: options.cwd,
          cols: options.cols,
          rows: options.rows,
          env: process.env as Record<string, string>,
          initialInput: options.initialInput,
          projectId: options.projectId,
          attachOnly: options.attachOnly,
        });
      } catch (error) {
        if (previousOwner) owners.set(sessionId, previousOwner);
        else owners.delete(sessionId);
        throw error;
      }
      if (!result) {
        owners.delete(sessionId);
        return null;
      }
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { projectId: options.projectId, createdAt: Date.now() });
        syncPowerSaveBlocker();
      }
      return { sessionId, isNew: result.isNew, snapshot: result.snapshot };
    },
  );

  ipcMain.handle(IPC.terminal.write, (_event, sessionId: string, data: string): void => {
    writeToSession(sessionId, data);
  });

  ipcMain.handle(
    IPC.terminal.resize,
    (_event, sessionId: string, cols: number, rows: number): void => {
      if (host) host.notify({ type: 'resize', payload: { sessionId, cols, rows } });
      else local?.resize(sessionId, cols, rows);
    },
  );

  ipcMain.handle(IPC.terminal.kill, (_event, sessionId: string): void => {
    if (host) host.notify({ type: 'kill', payload: { sessionId } });
    else local?.kill(sessionId);
    owners.delete(sessionId);
    sessions.delete(sessionId);
    syncPowerSaveBlocker();
  });
}

/**
 * Marks the next quit as a restart (installing an update, or a relaunch from settings), so
 * every terminal keeps running regardless of the "keep terminals running" setting.
 */
export function preserveTerminalsOnQuit(): void {
  preserveOnQuit = true;
}

/**
 * Called from `before-quit`. Returns a promise when the quit has to wait (the host may need
 * a moment to end the shells if the setting says so), or null when it can go ahead. On a
 * promise the caller cancels this quit and calls `app.quit()` again once it resolves.
 */
export function terminalsHoldQuit(): Promise<void> | null {
  if (quitSettled) return null;
  if (local) {
    local.killAll();
    quitSettled = true;
    return null;
  }
  const client = host;
  if (!client || preserveOnQuit || sessions.size === 0) {
    // Dropping the connection is all a restart needs; the host detaches and keeps going.
    quitSettled = true;
    client?.close();
    return null;
  }
  return (async () => {
    const keep = await store
      .getSettings()
      .then((settings) => settings.keepTerminalsRunning)
      .catch(() => true);
    if (!keep) {
      await client
        .request({ type: 'shutdown', payload: { killSessions: true } }, 1500)
        .catch(() => undefined);
    }
    quitSettled = true;
    await client.closeAfterFlush();
  })();
}

/** Most recently opened terminal session tagged with this project, if any is still open. */
export function findSessionIdForProject(projectId: string): string | null {
  let best: { id: string; createdAt: number } | null = null;
  for (const [id, session] of sessions) {
    if (session.projectId === projectId && (!best || session.createdAt > best.createdAt)) {
      best = { id, createdAt: session.createdAt };
    }
  }
  return best?.id ?? null;
}

export function writeToSession(sessionId: string, data: string): void {
  if (host) host.notify({ type: 'write', payload: { sessionId, data } });
  else local?.write(sessionId, data);
}
