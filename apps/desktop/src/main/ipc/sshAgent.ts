import { type IpcMainInvokeEvent, ipcMain, type WebContents } from 'electron';
import type { SshAgentProgress, StartSshAgentTaskInput } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  answerSshTaskInput,
  answerSshTaskPassword,
  approveSshTaskCommand,
  skipSshTaskCommand,
  startSshTask,
  stopSshTask,
} from '../agents/sshTaskRunner';
import { sendToContents } from './send';

/** The window that started each session's task, so progress events go back to it. */
const owners = new Map<string, WebContents>();

function forwardProgress(progress: SshAgentProgress): void {
  sendToContents(owners.get(progress.sessionId), IPC.sshAgent.onProgress, progress);
  if (progress.phase === 'finished' || progress.phase === 'error' || progress.phase === 'stopped') {
    owners.delete(progress.sessionId);
  }
}

export function registerSshAgentHandlers(): void {
  ipcMain.handle(
    IPC.sshAgent.start,
    (event: IpcMainInvokeEvent, input: StartSshAgentTaskInput): void => {
      owners.set(input.sessionId, event.sender);
      startSshTask(input, forwardProgress);
    },
  );

  ipcMain.handle(
    IPC.sshAgent.answerPassword,
    (_event, sessionId: string, approved: boolean): void => {
      answerSshTaskPassword(sessionId, approved);
    },
  );

  ipcMain.handle(IPC.sshAgent.approveCommand, (_event, sessionId: string): void => {
    approveSshTaskCommand(sessionId);
  });

  ipcMain.handle(IPC.sshAgent.skipCommand, (_event, sessionId: string): void => {
    skipSshTaskCommand(sessionId);
  });

  ipcMain.handle(
    IPC.sshAgent.answerNeedsInput,
    (_event, sessionId: string, answer: string): void => {
      answerSshTaskInput(sessionId, answer);
    },
  );

  ipcMain.handle(IPC.sshAgent.stop, (_event, sessionId: string): void => {
    stopSshTask(sessionId);
  });
}
