import type {
  ScannerPreflight,
  SecurityScannerSettings,
  SecurityScanOptions,
  SecurityScanRecord,
} from '@agentmat/core';
import { DEFAULT_SCAN_OPTIONS } from '@agentmat/core';
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { SecurityScannerConfig } from '../security/adapters';
import { suggestCodeqlLanguage } from '../security/languageDetect';
import { checkAllPreflight, clearPreflightCache } from '../security/preflight';
import { cancelSecurityScan, newScanRunId, runSecurityScan } from '../security/scanRunner';
import { securityScanDb } from '../securityScanDb';
import { store } from '../store';

/**
 * The Security tab's IPC surface.
 *
 * Every entry point takes a projectId and resolves the folder here rather than accepting a path
 * from the renderer, matching how packageManagers does it. That matters more than usual for this
 * feature: a path from the renderer would let a compromised page aim a Docker bind mount at any
 * folder on the machine.
 */

async function getProject(projectId: string): Promise<{ path: string; name: string }> {
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return { path: project.folderPath, name: project.name };
}

async function getScannerSettings(projectId: string): Promise<SecurityScannerSettings> {
  const settings = await store.getSettings();
  return settings.securityScannerConfigs?.[projectId] ?? {};
}

function toConfig(settings: SecurityScannerSettings): SecurityScannerConfig {
  return {
    sonarToken: settings.sonarToken ?? null,
    sonarUrl: settings.sonarUrl ?? 'http://localhost:9000',
    strixModel: settings.strixModel ?? null,
    strixApiKey: settings.strixApiKey ?? null,
  };
}

/** Merge stored per-project preferences into the options the renderer sent. */
function resolveOptions(
  requested: Partial<SecurityScanOptions>,
  saved: SecurityScannerSettings,
): SecurityScanOptions {
  const trivyScanners = (requested.trivyScanners ??
    saved.trivyScanners ??
    DEFAULT_SCAN_OPTIONS.trivyScanners) as SecurityScanOptions['trivyScanners'];
  return {
    ...DEFAULT_SCAN_OPTIONS,
    ...requested,
    semgrepConfig:
      requested.semgrepConfig ?? saved.semgrepConfig ?? DEFAULT_SCAN_OPTIONS.semgrepConfig,
    trivyScanners,
    codeqlLanguage: requested.codeqlLanguage ?? saved.codeqlLanguage ?? null,
    codeqlBuildCommand: requested.codeqlBuildCommand ?? saved.codeqlBuildCommand ?? null,
    sonarProjectKey: requested.sonarProjectKey ?? saved.sonarProjectKey ?? null,
  };
}

export function registerSecurityHandlers(): void {
  ipcMain.handle(
    IPC.security.preflight,
    async (_event, projectId: string): Promise<ScannerPreflight[]> => {
      const project = await getProject(projectId);
      const saved = await getScannerSettings(projectId);
      const options = resolveOptions({}, saved);
      return checkAllPreflight({
        projectPath: project.path,
        config: toConfig(saved),
        codeqlLanguage: options.codeqlLanguage,
        codeqlBuildCommand: options.codeqlBuildCommand,
        sonarProjectKey: options.sonarProjectKey,
      });
    },
  );

  ipcMain.handle(
    IPC.security.runScan,
    async (
      event,
      projectId: string,
      requested: Partial<SecurityScanOptions>,
      runId: string,
    ): Promise<SecurityScanRecord> => {
      const project = await getProject(projectId);
      const saved = await getScannerSettings(projectId);
      const options = resolveOptions(requested, saved);

      const record = await runSecurityScan(
        runId || newScanRunId(),
        {
          projectId,
          projectName: project.name,
          projectPath: project.path,
          options,
          config: toConfig(saved),
        },
        event.sender,
      );

      // A cancelled run with nothing in it is not worth keeping in the history dropdown.
      if (record.status !== 'cancelled' || record.findings.length > 0) {
        securityScanDb.add(record);
      }
      return record;
    },
  );

  ipcMain.handle(IPC.security.cancelScan, (_event, runId: string): boolean =>
    cancelSecurityScan(runId),
  );

  ipcMain.handle(IPC.security.history, (_event, projectId: string): SecurityScanRecord[] =>
    securityScanDb.list(projectId),
  );

  ipcMain.handle(IPC.security.getScan, (_event, id: string): SecurityScanRecord | null =>
    securityScanDb.get(id),
  );

  ipcMain.handle(IPC.security.latest, (_event, projectId: string): SecurityScanRecord | null =>
    securityScanDb.latest(projectId),
  );

  ipcMain.handle(IPC.security.deleteScan, (_event, id: string): void => {
    securityScanDb.remove(id);
  });

  ipcMain.handle(
    IPC.security.getConfig,
    async (_event, projectId: string): Promise<SecurityScannerSettings> =>
      getScannerSettings(projectId),
  );

  ipcMain.handle(
    IPC.security.setConfig,
    async (_event, projectId: string, config: SecurityScannerSettings): Promise<void> => {
      const settings = await store.getSettings();
      const configs = { ...(settings.securityScannerConfigs ?? {}) };
      configs[projectId] = { ...configs[projectId], ...config };
      await store.setSettings({ ...settings, securityScannerConfigs: configs });
      // A new token or language changes what preflight would say, so the memo has to go.
      clearPreflightCache();
    },
  );

  ipcMain.handle(
    IPC.security.suggestCodeqlLanguage,
    async (_event, projectId: string): Promise<string | null> => {
      const project = await getProject(projectId);
      return suggestCodeqlLanguage(project.path);
    },
  );
}
