import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { app, dialog, ipcMain } from 'electron';
import AdmZip from 'adm-zip';
import { IPC } from '../../shared/ipcChannels';
import type { BackupExportResult, BackupImportResult } from '../../shared/apiTypes';
import {
  BACKUP_VERSION,
  parseBackup,
  type BackupData,
  type BackupEnvelope,
} from '../backup/envelope';
import { store } from '../store';
import { petManager } from '../pet/petWindow';
import { promptHistoryDb } from '../promptHistoryDb';
import { skillAuditDb } from '../skillAuditDb';

const ZIP_ENTRY_NAME = 'backup.json';

async function readCurrentData(): Promise<Required<BackupData>> {
  return {
    projects: await store.getProjects(),
    settings: await store.getSettings(),
    activity: await store.getActivity(),
    templates: await store.getTemplates(),
    repositories: await store.getRepositories(),
    mcpRepositories: await store.getMcpRepositories(),
    projectDrafts: await store.getProjectDrafts(),
    scheduledTasks: await store.getScheduledTasks(),
    promptHistory: promptHistoryDb.exportAll(),
    skillAudits: skillAuditDb.exportAll(),
    appNotifications: await store.getAppNotifications(),
  };
}

/**
 * Persists whatever sections the payload carries. Every section is validated
 * before this runs, so the only way it can fail here is a disk error, which the
 * caller rolls back from with the snapshot it took first.
 */
async function writeData(data: BackupData): Promise<void> {
  if (data.projects) await store.setProjects(data.projects);
  if (data.settings) await store.setSettings(data.settings);
  if (data.activity) await store.setActivity(data.activity);
  if (data.templates) await store.setTemplates(data.templates);
  if (data.repositories) await store.setRepositories(data.repositories);
  if (data.mcpRepositories) await store.setMcpRepositories(data.mcpRepositories);
  if (data.projectDrafts) await store.setProjectDrafts(data.projectDrafts);
  if (data.scheduledTasks) await store.setScheduledTasks(data.scheduledTasks);
  if (data.promptHistory) promptHistoryDb.importAll(data.promptHistory);
  if (data.skillAudits) skillAuditDb.importAll(data.skillAudits);
  if (data.appNotifications) await store.setAppNotifications(data.appNotifications);
}

export function registerBackupHandlers(): void {
  ipcMain.handle(
    IPC.backup.export,
    async (_event, compress: boolean): Promise<BackupExportResult> => {
      const dateStamp = new Date().toISOString().slice(0, 10);
      const result = await dialog.showSaveDialog({
        defaultPath: compress
          ? `agentmate-backup-${dateStamp}.zip`
          : `agentmate-backup-${dateStamp}.json`,
        filters: compress
          ? [{ name: 'AgentMate Backup (zip)', extensions: ['zip'] }]
          : [{ name: 'AgentMate Backup', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { ok: false };

      const envelope: BackupEnvelope = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: app.isPackaged ? app.getVersion() : 'dev',
        data: await readCurrentData(),
      };
      const json = JSON.stringify(envelope, null, 2);

      // A full disk or a read-only folder is an ordinary outcome here, and the
      // import handler already answers with { ok, error } rather than rejecting.
      try {
        if (compress) {
          const zip = new AdmZip();
          zip.addFile(ZIP_ENTRY_NAME, Buffer.from(json, 'utf-8'));
          zip.writeZip(result.filePath);
        } else {
          await writeFile(result.filePath, json, 'utf-8');
        }
      } catch (error) {
        return {
          ok: false,
          error: `Could not write that file: ${error instanceof Error ? error.message : 'unknown error'}`,
        };
      }
      return { ok: true, path: result.filePath };
    },
  );

  ipcMain.handle(IPC.backup.import, async (): Promise<BackupImportResult> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'AgentMate Backup', extensions: ['json', 'zip'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false };

    let parsed: unknown;
    try {
      const filePath = result.filePaths[0];
      const raw =
        extname(filePath).toLowerCase() === '.zip'
          ? new AdmZip(filePath).readAsText(ZIP_ENTRY_NAME)
          : await readFile(filePath, 'utf-8');
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Could not read that file.' };
    }

    // Validate everything up front. The old code wrote each section as it went,
    // so one malformed row left the user with half their data replaced and half
    // restored, and no error to show for it.
    const backup = parseBackup(parsed);
    if (!backup.ok) return { ok: false, error: backup.error };

    const snapshot = await readCurrentData();
    try {
      await writeData(backup.data);
    } catch (error) {
      // Put back what was there before rather than leaving a half-written store.
      await writeData(snapshot).catch(() => undefined);
      return {
        ok: false,
        error: `Could not restore that backup: ${error instanceof Error ? error.message : 'unknown error'}. Your existing data was left in place.`,
      };
    }

    void petManager.syncFromSettings();
    return { ok: true, warnings: backup.warnings };
  });
}
