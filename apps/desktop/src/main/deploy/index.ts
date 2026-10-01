import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, dialog, type IpcMainInvokeEvent, ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { registerDeployHandlers } from '../ipc/deploy';
import { registerDeploySecurityHandlers } from '../ipc/deploySecurity';
import { sendToWindow } from '../ipc/send';
import { getMainWindow } from '../mainWindow';
import { SshConnectionPool } from '../ssh/pool';
import { savedServerPoolSource } from '../ssh/savedServers';
import { decryptSecret, encryptSecret, registerSealedSecretStore } from '../ssh/vault';
import { store } from '../store';
import { DownloadAbortedError, ResumableDownload } from '../updater/resumableDownload';
import {
  githubReleaseSource,
  localArtifactSource,
  parseReleaseManifest,
  type ReleaseSource,
  repoReleaseDirectory,
} from './bootstrap/releaseSource';
import { DeploySecurity } from './security';
import { DeployService } from './service';
import { DeployState, jsonFilePort } from './state';

/**
 * Wires the Deploy service into Electron. Packaged builds install the core release published
 * with their own version, checked against the manifest built into the app. Development builds
 * use `pnpm server-core:publish` output, and can add the DevHost with AGENTMATE_DEPLOY_DEV_CORE
 * (a loopback port); packaged builds ignore both.
 */

const MANIFEST = 'server-core-manifest.json';
const DOWNLOAD_ATTEMPTS = 5;

interface CoreSource {
  releases: ReleaseSource;
  availableVersion: () => Promise<string | null>;
  unavailableReason?: string;
}

function unavailable(reason: string): CoreSource {
  return {
    releases: {
      release: async () => {
        throw new Error(reason);
      },
    },
    availableVersion: async () => null,
    unavailableReason: reason,
  };
}

async function downloadRelease(url: string, destination: string): Promise<void> {
  const download = new ResumableDownload();
  try {
    await download.run({
      url,
      destPath: destination,
      expectedSize: null,
      userAgent: `AgentMate/${app.getVersion()}`,
      onProgress: () => undefined,
      onReconnect: (attempt) => {
        if (attempt >= DOWNLOAD_ATTEMPTS) download.abort();
      },
    });
  } catch (error) {
    if (error instanceof DownloadAbortedError) {
      throw new Error('The server core download kept failing. Check the connection and try again.');
    }
    throw error;
  }
}

function packagedSource(): CoreSource {
  const path = join(process.resourcesPath, MANIFEST);
  if (!existsSync(path))
    return unavailable('This build of AgentMate has no server core to install.');
  const manifest = parseReleaseManifest(JSON.parse(readFileSync(path, 'utf-8')));
  return {
    releases: githubReleaseSource(
      manifest,
      join(app.getPath('userData'), 'server-core'),
      downloadRelease,
    ),
    availableVersion: async () => manifest.version,
  };
}

const NO_DEV_BUILD =
  'No server core build found. Run "pnpm server-core:publish linux-x64" (or linux-arm64) first.';

function developmentSource(): CoreSource {
  const directory =
    process.env.AGENTMATE_SERVER_CORE_ARTIFACTS ?? repoReleaseDirectory(app.getAppPath());
  if (!directory) return unavailable(NO_DEV_BUILD);
  return {
    releases: localArtifactSource(directory),
    unavailableReason: NO_DEV_BUILD,
    availableVersion: async () => {
      try {
        const manifest = readFileSync(join(directory, MANIFEST), 'utf-8');
        return parseReleaseManifest(JSON.parse(manifest)).version;
      } catch {
        return null;
      }
    },
  };
}

function devCorePort(): number | null {
  if (app.isPackaged) return null;
  const port = Number(process.env.AGENTMATE_DEPLOY_DEV_CORE);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

export function registerDeployIpc(): void {
  const pool = new SshConnectionPool(savedServerPoolSource);
  const source = app.isPackaged ? packagedSource() : developmentSource();
  const state = new DeployState(jsonFilePort(join(app.getPath('userData'), 'data', 'deploy.json')));
  // Device keys are sealed with the Servers vault, so they move with a passkey change.
  registerSealedSecretStore(state.sealedKeys);
  const service = new DeployService({
    servers: () => store.getSshServers(),
    pool,
    state,
    seal: encryptSecret,
    unseal: decryptSecret,
    releases: source.releases,
    availableVersion: source.availableVersion,
    unavailableReason: source.unavailableReason,
    devCorePort: devCorePort(),
    progress: (event) => sendToWindow(getMainWindow(), IPC.deploy.onSetupProgress, event),
  });
  registerDeployHandlers({
    ipc: ipcMain,
    service,
    guard: (event) => {
      const win = getMainWindow();
      return (
        !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
      );
    },
  });
  registerDeploySecurityIpc(service);
  app.on('will-quit', () => pool.closeAll());
}

function fromMainWindow(event: IpcMainInvokeEvent): boolean {
  const win = getMainWindow();
  return (
    !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
  );
}

/** The Security area: users, devices, sessions, enrollment codes and the audit trail. */
function registerDeploySecurityIpc(service: DeployService): void {
  const security = new DeploySecurity({
    withHub: (serverId, work) => service.withHub(serverId, work),
    forgetTokens: (serverId) => service.forgetTokens(serverId),
    serverName: async (serverId) =>
      (await service.listServers()).find((server) => server.id === serverId)?.nickname ?? serverId,
    pickExportPath: async (format, suggestedName) => {
      const options = {
        title: 'Export the audit trail',
        defaultPath: suggestedName,
        filters: [
          format === 'csv'
            ? { name: 'CSV', extensions: ['csv'] }
            : { name: 'JSON', extensions: ['json'] },
        ],
      };
      const win = getMainWindow();
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      return result.canceled ? null : (result.filePath ?? null);
    },
    writeFile: (path, content) => writeFile(path, content, 'utf-8'),
  });
  registerDeploySecurityHandlers({ ipc: ipcMain, security, service, guard: fromMainWindow });
}
