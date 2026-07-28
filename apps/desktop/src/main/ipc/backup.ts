import { readFile, writeFile } from 'node:fs/promises';
import { app, dialog, ipcMain } from 'electron';
import type {
  ActivityEvent,
  AppSettings,
  Project,
  ProjectDraft,
  PromptTemplate,
  ScheduledTask,
  SkillRepository,
  McpRepository,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type {
  BackupExportResult,
  BackupImportResult,
  PromptHistoryEntry,
} from '../../shared/apiTypes';
import { store } from '../store';
import { promptHistoryDb } from '../promptHistoryDb';

const BACKUP_VERSION = 1;

interface BackupEnvelope {
  version: number;
  exportedAt: string;
  appVersion: string;
  data: {
    projects?: Project[];
    settings?: AppSettings;
    activity?: ActivityEvent[];
    templates?: PromptTemplate[];
    repositories?: SkillRepository[];
    mcpRepositories?: McpRepository[];
    projectDrafts?: ProjectDraft[];
    scheduledTasks?: ScheduledTask[];
    promptHistory?: PromptHistoryEntry[];
  };
}

function isBackupEnvelope(value: unknown): value is BackupEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { version?: unknown; data?: unknown };
  return candidate.version === BACKUP_VERSION && typeof candidate.data === 'object' && candidate.data !== null;
}

export function registerBackupHandlers(): void {
  ipcMain.handle(IPC.backup.export, async (): Promise<BackupExportResult> => {
    const result = await dialog.showSaveDialog({
      defaultPath: `agentmate-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'AgentMate Backup', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };

    const envelope: BackupEnvelope = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: app.isPackaged ? app.getVersion() : 'dev',
      data: {
        projects: await store.getProjects(),
        settings: await store.getSettings(),
        activity: await store.getActivity(),
        templates: await store.getTemplates(),
        repositories: await store.getRepositories(),
        mcpRepositories: await store.getMcpRepositories(),
        projectDrafts: await store.getProjectDrafts(),
        scheduledTasks: await store.getScheduledTasks(),
        promptHistory: promptHistoryDb.exportAll(),
      },
    };

    await writeFile(result.filePath, JSON.stringify(envelope, null, 2), 'utf-8');
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle(IPC.backup.import, async (): Promise<BackupImportResult> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'AgentMate Backup', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false };

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(result.filePaths[0], 'utf-8'));
    } catch {
      return { ok: false, error: 'Could not read that file.' };
    }

    if (!isBackupEnvelope(parsed)) {
      return { ok: false, error: 'That file is not a valid AgentMate backup.' };
    }

    const { data } = parsed;
    if (Array.isArray(data.projects)) await store.setProjects(data.projects);
    if (data.settings) await store.setSettings(data.settings);
    if (Array.isArray(data.activity)) await store.setActivity(data.activity);
    if (Array.isArray(data.templates)) await store.setTemplates(data.templates);
    if (Array.isArray(data.repositories)) await store.setRepositories(data.repositories);
    if (Array.isArray(data.mcpRepositories)) await store.setMcpRepositories(data.mcpRepositories);
    if (Array.isArray(data.projectDrafts)) await store.setProjectDrafts(data.projectDrafts);
    if (Array.isArray(data.scheduledTasks)) await store.setScheduledTasks(data.scheduledTasks);
    if (Array.isArray(data.promptHistory)) promptHistoryDb.importAll(data.promptHistory);

    return { ok: true };
  });
}
