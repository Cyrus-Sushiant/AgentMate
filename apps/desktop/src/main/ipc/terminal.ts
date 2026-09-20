import { randomUUID } from 'node:crypto';
import { looksLikeNeedsInput } from '@agentmat/core';
import { type IpcMainInvokeEvent, ipcMain, type WebContents } from 'electron';
import type {
  AgentSessionEntry,
  CreateTerminalOptions,
  TerminalAttachResult,
  TerminalSurface,
  TerminalUsageResult,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { createAutoContinue } from '../agents/autoContinue';
import { supportsStatusHooks } from '../agents/claudeHooks';
import { agentStatus } from '../agents/statusTracker';
import { keepAwake } from '../power/keepAwake';
import type { HostClient } from '../ptyHost/hostClient';
import { connectToHost } from '../ptyHost/hostLauncher';
import type {
  CreateOrAttachPayload,
  CreateOrAttachResult,
  HostSessionInfo,
} from '../ptyHost/protocol';
import { PtySessionManager, type SessionListener } from '../ptyHost/sessionManager';
import { store } from '../store';
import { sampleProcessTrees } from '../system/processTree';
import { broadcastToWindows, sendToContents } from './send';

const ALLOWED_SHELLS = ['powershell.exe', 'pwsh.exe', 'cmd.exe', 'bash', 'zsh', 'fish'] as const;
type AllowedShell = (typeof ALLOWED_SHELLS)[number];

function defaultShell(): AllowedShell {
  if (process.platform === 'win32') return 'powershell.exe';
  return (process.env.SHELL?.split('/').pop() as AllowedShell) ?? 'bash';
}

export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface TerminalSessionInfo {
  projectId?: string;
  cliId?: string;
  surface?: TerminalSurface;
  /** Unknown for a session only seen in the host's list and not attached yet. */
  shell?: AllowedShell;
  createdAt: number;
}

/** What main knows about each running session, kept for hook replies and the power blocker. */
const sessions = new Map<string, TerminalSessionInfo>();
/**
 * Lets other main-process code (the AI task runner) watch a session's raw output or learn it
 * ended, the same way it does for SSH sessions.
 */
const outputSubscribers = new Map<string, Set<(data: string) => void>>();
const exitSubscribers = new Map<string, Set<() => void>>();

function notifyExitSubscribers(sessionId: string): void {
  const listeners = exitSubscribers.get(sessionId);
  outputSubscribers.delete(sessionId);
  exitSubscribers.delete(sessionId);
  for (const listener of listeners ?? []) listener();
}
/** The window currently showing each session. Output goes there. */
const owners = new Map<string, WebContents>();
/**
 * Sessions this process has attached to since it connected. A session the host was already
 * running when the app started is known from its list but sends no output until attached.
 */
const attached = new Set<string>();
/** Sessions whose output the AI task runner draws itself, through `writeToTerminalDisplay`. */
const capturedDisplays = new Set<string>();

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

// Windows applies "efficiency mode" power throttling to minimized/backgrounded apps, which
// can starve a shell running inside a terminal tab (and, if that shell is the dev server the
// app itself was launched from, take the whole app down with it). A session that is writing
// output counts as work for the keep-awake policy, whose blocker keeps the app at full speed;
// terminals left sitting at a prompt do not, so the machine can still sleep.
const TERMINAL_IDLE_MS = 60_000;
let terminalIdleTimer: NodeJS.Timeout | null = null;

function noteTerminalOutput(): void {
  keepAwake.setBusy('terminals', true);
  if (terminalIdleTimer) clearTimeout(terminalIdleTimer);
  terminalIdleTimer = setTimeout(() => keepAwake.setBusy('terminals', false), TERMINAL_IDLE_MS);
}

function syncPowerSaveBlocker(): void {
  if (sessions.size > 0) return;
  if (terminalIdleTimer) {
    clearTimeout(terminalIdleTimer);
    terminalIdleTimer = null;
  }
  keepAwake.setBusy('terminals', false);
}

/** Types "continue" into agent tabs that opted in, after a usage limit or a network error. */
export const autoContinue = createAutoContinue({
  write: writeToShell,
  statusOf: (sessionId) => agentStatus.list()[sessionId],
  broadcast: (changes) => {
    broadcastToWindows(IPC.agents.onAutoContinue, changes);
  },
  setBusy: (busy) => keepAwake.setBusy('auto-continue', busy),
});

function sendToOwner(sessionId: string, data: string): void {
  sendToContents(owners.get(sessionId), IPC.terminal.onData, { sessionId, data });
}

function forwardData(sessionId: string, data: string): void {
  agentStatus.output(sessionId, data.length);
  const cliId = sessions.get(sessionId)?.cliId;
  if (cliId && !supportsStatusHooks(cliId) && looksLikeNeedsInput(data)) {
    agentStatus.guessNeedsInput(sessionId);
  }
  autoContinue.output(sessionId, data);
  noteTerminalOutput();
  if (!capturedDisplays.has(sessionId)) sendToOwner(sessionId, data);
  for (const listener of outputSubscribers.get(sessionId) ?? []) listener(data);
}

function forwardExit(sessionId: string, exitCode: number): void {
  agentStatus.exit(sessionId);
  autoContinue.exit(sessionId);
  sendToContents(owners.get(sessionId), IPC.terminal.onExit, { sessionId, exitCode });
  owners.delete(sessionId);
  sessions.delete(sessionId);
  attached.delete(sessionId);
  capturedDisplays.delete(sessionId);
  syncPowerSaveBlocker();
  notifyExitSubscribers(sessionId);
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
      attached.clear();
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
          // The ids let a hook script started inside this shell (Claude Code's, say) say
          // which tab it belongs to. Only a brand-new shell picks them up.
          env: {
            ...(process.env as Record<string, string>),
            AGENTMATE_SESSION_ID: sessionId,
            AGENTMATE_PROJECT_ID: options.projectId ?? '',
          },
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
      attached.add(sessionId);
      const known = sessions.get(sessionId);
      sessions.set(sessionId, {
        // A session remembered from the host list lacks what only the renderer knows.
        projectId: options.projectId ?? known?.projectId,
        cliId: options.cliId ?? known?.cliId,
        surface: options.surface ?? known?.surface,
        // A reattach passes the tab's own shell, so this is right for restored tabs too.
        shell,
        createdAt: known?.createdAt ?? Date.now(),
      });
      if (!known) syncPowerSaveBlocker();
      return { sessionId, isNew: result.isNew, snapshot: result.snapshot };
    },
  );

  ipcMain.handle(IPC.terminal.write, (_event, sessionId: string, data: string): void => {
    writeToSession(sessionId, data);
  });

  ipcMain.handle(
    IPC.terminal.resize,
    (_event, sessionId: string, cols: number, rows: number): void => {
      agentStatus.resize(sessionId);
      autoContinue.resize(sessionId);
      if (host) host.notify({ type: 'resize', payload: { sessionId, cols, rows } });
      else local?.resize(sessionId, cols, rows);
    },
  );

  ipcMain.handle(IPC.terminal.kill, (_event, sessionId: string): void => {
    if (host) host.notify({ type: 'kill', payload: { sessionId } });
    else local?.kill(sessionId);
    autoContinue.exit(sessionId);
    owners.delete(sessionId);
    sessions.delete(sessionId);
    attached.delete(sessionId);
    syncPowerSaveBlocker();
    notifyExitSubscribers(sessionId);
  });

  ipcMain.handle(IPC.terminal.usage, async (): Promise<TerminalUsageResult> => {
    // Only waits on a backend that is already starting; asking for usage never starts a host.
    if (backendReady) await backendReady;
    const running: HostSessionInfo[] = host
      ? await host.request<HostSessionInfo[]>({ type: 'list' }).catch(() => [])
      : (local?.list() ?? []);
    const pids = running.map((info) => info.pid).filter((pid) => Number.isInteger(pid) && pid > 0);
    const sample = await sampleProcessTrees(pids);
    return {
      available: sample.available,
      cpuReady: sample.cpuReady,
      sampledAt: Date.now(),
      sessions: running.map((info) => {
        const known = sessions.get(info.sessionId);
        const tree = sample.trees.get(info.pid);
        return {
          sessionId: info.sessionId,
          pid: info.pid,
          projectId: known?.projectId ?? info.projectId,
          cliId: known?.cliId,
          surface: known?.surface,
          createdAt: info.createdAt,
          cpuPercent: tree?.cpuPercent ?? 0,
          memBytes: tree?.memBytes ?? 0,
          processCount: tree?.processCount ?? 0,
          processes: tree?.processes ?? [],
        };
      }),
    };
  });
}

/**
 * Starts receiving a running session's output without showing it anywhere, so its agent's
 * status stays current. Does nothing for a session that is already attached or has ended.
 */
export async function attachForTracking(entry: AgentSessionEntry): Promise<void> {
  const { sessionId } = entry;
  await ensureBackend();
  if (attached.has(sessionId) || (!host && local)) return;
  const result = await createOrAttach({
    sessionId,
    shell: defaultShell(),
    attachOnly: true,
    projectId: entry.projectId,
  });
  if (!result) {
    // It ended while the app was closed.
    agentStatus.exit(sessionId);
    return;
  }
  attached.add(sessionId);
  const known = sessions.get(sessionId);
  sessions.set(sessionId, {
    projectId: entry.projectId,
    cliId: entry.cliId,
    surface: 'workspace',
    createdAt: known?.createdAt ?? Date.now(),
  });
  if (!known) syncPowerSaveBlocker();
}

/**
 * Marks the next quit as a restart (installing an update, or a relaunch from settings), so
 * every terminal keeps running regardless of the "keep terminals running" setting.
 */
export function preserveTerminalsOnQuit(): void {
  preserveOnQuit = true;
}

/** Agent CLI tabs this process is showing, for the confirmation shown before the app closes. */
export function openCliSessionCount(): number {
  let count = 0;
  for (const [sessionId, session] of sessions) {
    if (session.cliId && attached.has(sessionId)) count += 1;
  }
  return count;
}

/** Whether terminals carry on in the background host after a normal quit. */
export async function terminalsKeepRunningAfterQuit(): Promise<boolean> {
  if (local || !host) return false;
  return store
    .getSettings()
    .then((settings) => settings.keepTerminalsRunning)
    .catch(() => true);
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
  // An agent that is waiting on a question is the one a reply is meant for.
  const waiting = agentStatus.sessionAwaitingInput(projectId);
  if (waiting && sessions.has(waiting)) return waiting;
  let best: { id: string; createdAt: number } | null = null;
  for (const [id, session] of sessions) {
    if (session.projectId === projectId && (!best || session.createdAt > best.createdAt)) {
      best = { id, createdAt: session.createdAt };
    }
  }
  return best?.id ?? null;
}

/** True while `sessionId` is a local shell this process is attached to and can drive. */
export function hasAttachedTerminalSession(sessionId: string): boolean {
  return attached.has(sessionId) && sessions.has(sessionId);
}

/** The shell a session runs, falling back to the platform default when it was never recorded. */
export function terminalSessionShell(sessionId: string): AllowedShell {
  return sessions.get(sessionId)?.shell ?? defaultShell();
}

/** Fires with every chunk of raw output a session produces, until the returned function is called. */
export function subscribeTerminalOutput(
  sessionId: string,
  listener: (data: string) => void,
): () => void {
  let set = outputSubscribers.get(sessionId);
  if (!set) {
    set = new Set();
    outputSubscribers.set(sessionId, set);
  }
  set.add(listener);
  return () => set?.delete(listener);
}

/** Same as `setSshDisplayCaptured`, for a local shell. */
export function setTerminalDisplayCaptured(sessionId: string, captured: boolean): void {
  if (captured) capturedDisplays.add(sessionId);
  else capturedDisplays.delete(sessionId);
}

/** Draws text in a session's terminal pane without sending anything to the shell. */
export function writeToTerminalDisplay(sessionId: string, data: string): void {
  if (data) sendToOwner(sessionId, data);
}

/** Fires once when a session ends, however that happens (shell exit, closed tab, lost host). */
export function subscribeTerminalExit(sessionId: string, listener: () => void): () => void {
  let set = exitSubscribers.get(sessionId);
  if (!set) {
    set = new Set();
    exitSubscribers.set(sessionId, set);
  }
  set.add(listener);
  return () => set?.delete(listener);
}

export function writeToSession(sessionId: string, data: string): void {
  autoContinue.userInput(sessionId, data);
  writeToShell(sessionId, data);
}

/** Sends input to a session's shell. Unlike `writeToSession`, it is not the user typing. */
function writeToShell(sessionId: string, data: string): void {
  agentStatus.input(sessionId);
  if (host) host.notify({ type: 'write', payload: { sessionId, data } });
  else local?.write(sessionId, data);
}
