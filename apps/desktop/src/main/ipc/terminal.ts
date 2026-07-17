import { randomUUID } from 'node:crypto';
import * as pty from 'node-pty';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
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
}

const sessions = new Map<string, TerminalSession>();

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
      sessions.set(sessionId, { pty: ptyProcess });

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
  });
}

export function killAllTerminalSessions(): void {
  for (const session of sessions.values()) {
    session.pty.kill();
  }
  sessions.clear();
}
