import { randomUUID } from 'node:crypto';
import * as pty from 'node-pty';
import { ipcMain, powerSaveBlocker, type IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { CreateTerminalOptions } from '../../shared/apiTypes';

const ALLOWED_SHELLS = ['powershell.exe', 'pwsh.exe', 'cmd.exe', 'bash', 'zsh', 'fish'] as const;
type AllowedShell = (typeof ALLOWED_SHELLS)[number];

function defaultShell(): AllowedShell {
  if (process.platform === 'win32') return 'powershell.exe';
  return (process.env.SHELL?.split('/').pop() as AllowedShell) ?? 'bash';
}

interface TerminalSession {
  pty: pty.IPty;
  projectId?: string;
  createdAt: number;
}

const sessions = new Map<string, TerminalSession>();

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

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    IPC.terminal.create,
    (event: IpcMainInvokeEvent, options: CreateTerminalOptions = {}): string => {
      const shell = ALLOWED_SHELLS.includes(options.shell as AllowedShell)
        ? (options.shell as AllowedShell)
        : defaultShell();

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: options.cols ?? 80,
        rows: options.rows ?? 24,
        cwd: options.cwd ?? process.env.HOME ?? process.env.USERPROFILE,
        env: process.env as Record<string, string>,
      });

      const sessionId = randomUUID();
      sessions.set(sessionId, {
        pty: ptyProcess,
        projectId: options.projectId,
        createdAt: Date.now(),
      });
      syncPowerSaveBlocker();

      const sender = event.sender;
      ptyProcess.onData((data) => {
        if (!sender.isDestroyed()) {
          sender.send(IPC.terminal.onData, { sessionId, data });
        }
      });
      ptyProcess.onExit(({ exitCode }) => {
        if (!sender.isDestroyed()) {
          sender.send(IPC.terminal.onExit, { sessionId, exitCode });
        }
        sessions.delete(sessionId);
        syncPowerSaveBlocker();
      });

      if (options.initialInput) {
        ptyProcess.write(options.initialInput);
      }

      return sessionId;
    },
  );

  ipcMain.handle(IPC.terminal.write, (_event, sessionId: string, data: string): void => {
    sessions.get(sessionId)?.pty.write(data);
  });

  ipcMain.handle(
    IPC.terminal.resize,
    (_event, sessionId: string, cols: number, rows: number): void => {
      sessions.get(sessionId)?.pty.resize(cols, rows);
    },
  );

  ipcMain.handle(IPC.terminal.kill, (_event, sessionId: string): void => {
    sessions.get(sessionId)?.pty.kill();
    sessions.delete(sessionId);
    syncPowerSaveBlocker();
  });
}

export function killAllTerminalSessions(): void {
  for (const session of sessions.values()) {
    session.pty.kill();
  }
  sessions.clear();
  syncPowerSaveBlocker();
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
  sessions.get(sessionId)?.pty.write(data);
}
