import type { AgentHistorySession } from '@agentmat/core';
import { ipcMain } from 'electron';
import type {
  AgentRunInfoMap,
  AgentSessionEntry,
  AgentStatusMap,
  LastRunInfoByCli,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { claudeHookSettingsPath, supportsStatusHooks } from '../agents/claudeHooks';
import { listAgentHistory } from '../agents/sessionHistory';
import { agentStatus } from '../agents/statusTracker';
import { store } from '../store';
import { attachForTracking, SESSION_ID_PATTERN } from './terminal';

function isEntry(value: unknown): value is AgentSessionEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.sessionId === 'string' &&
    SESSION_ID_PATTERN.test(entry.sessionId) &&
    typeof entry.projectId === 'string' &&
    typeof entry.title === 'string' &&
    (entry.cliId === undefined || typeof entry.cliId === 'string')
  );
}

export function registerAgentHandlers(): void {
  ipcMain.handle(IPC.agents.sync, (_event, entries: unknown): void => {
    const valid = Array.isArray(entries) ? entries.filter(isEntry) : [];
    const added = agentStatus.sync(valid);
    // Tabs restored after a restart have not been shown yet, so nothing is reading their
    // output. Attach to them now so their status keeps up while they are off screen.
    for (const id of added) {
      const entry = valid.find((e) => e.sessionId === id);
      if (entry) void attachForTracking(entry).catch(() => undefined);
    }
  });

  ipcMain.handle(IPC.agents.setViewing, (_event, visible: unknown, focused: unknown): void => {
    const ids = Array.isArray(visible)
      ? visible.filter((id): id is string => typeof id === 'string')
      : [];
    agentStatus.setViewing(ids, typeof focused === 'string' ? focused : null);
  });

  ipcMain.handle(IPC.agents.acknowledge, (_event, sessionId: string): void => {
    if (typeof sessionId === 'string') agentStatus.acknowledge(sessionId);
  });

  ipcMain.handle(IPC.agents.list, (): AgentStatusMap => agentStatus.list());

  ipcMain.handle(IPC.agents.runInfos, (): AgentRunInfoMap => agentStatus.runInfos());

  ipcMain.handle(
    IPC.agents.lastRunInfoByCli,
    (): Promise<LastRunInfoByCli> => store.getLastRunInfoByCli(),
  );

  ipcMain.handle(
    IPC.agents.history,
    async (_event, projectId: unknown): Promise<AgentHistorySession[]> => {
      if (typeof projectId !== 'string') return [];
      const project = (await store.getProjects()).find((p) => p.id === projectId);
      return project ? listAgentHistory(project.folderPath) : [];
    },
  );

  ipcMain.handle(
    IPC.agents.statusHookSettings,
    async (_event, cliId: string): Promise<string | null> =>
      typeof cliId === 'string' && supportsStatusHooks(cliId) ? claudeHookSettingsPath() : null,
  );
}
