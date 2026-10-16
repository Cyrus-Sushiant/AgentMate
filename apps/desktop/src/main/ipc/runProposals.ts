import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import type { RunProposalDecision } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { portFilePath } from '../notifications/hookServer';
import {
  decideRunProposal,
  getRunProposalsEnabled,
  listPendingRunProposals,
  setRunProposalsEnabled,
  startGuidedRunSession,
} from '../runProposals/service';

/** The renderer's side of run suggestions: the approval dialog, the switch, and starting a setup. */
export function registerRunProposalHandlers(): void {
  ipcMain.handle(IPC.runProposals.list, () => listPendingRunProposals());
  ipcMain.handle(
    IPC.runProposals.decide,
    (_event, args: { id: string; decision: RunProposalDecision }) =>
      decideRunProposal(args.id, args.decision === 'add' ? 'add' : 'discard'),
  );
  ipcMain.handle(IPC.runProposals.getEnabled, (_event, projectId: string) =>
    getRunProposalsEnabled(projectId),
  );
  ipcMain.handle(
    IPC.runProposals.setEnabled,
    (_event, args: { projectId: string; enabled: boolean }) =>
      setRunProposalsEnabled(args.projectId, args.enabled === true, portFilePath()),
  );
  ipcMain.handle(IPC.runProposals.startGuided, (_event, projectId: string) =>
    startGuidedRunSession(projectId, {
      directory: join(app.getPath('userData'), 'run-suggestions'),
      portFile: portFilePath(),
    }),
  );
}
