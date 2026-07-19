import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { ProgressInfo, UpdateInfo as ElectronUpdateInfo } from 'electron-updater';
import { IPC } from '../shared/ipcChannels';
import type { UpdateInfo, UpdateStatus } from '../shared/apiTypes';

/**
 * electron-builder.yml publishes releases via GitHub (see the `publish` block
 * there), so this reads update metadata straight off the project's GitHub
 * Releases. Downloads never start on their own — `autoDownload` is off, and
 * every state transition is broadcast to the renderer, which is responsible
 * for asking the user to confirm before a download begins and again before
 * restarting to install.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

let currentStatus: UpdateStatus = { state: 'idle' };
let activeUpdateInfo: UpdateInfo | null = null;
let pendingResolvers: Array<(status: UpdateStatus) => void> = [];
let wired = false;

function toUpdateInfo(info: ElectronUpdateInfo): UpdateInfo {
  const notes = info.releaseNotes;
  const releaseNotes =
    typeof notes === 'string'
      ? notes
      : Array.isArray(notes)
        ? notes.map((n) => n.note ?? '').filter(Boolean).join('\n\n') || null
        : null;
  return {
    version: info.version,
    releaseDate: info.releaseDate ?? null,
    releaseNotes,
  };
}

function broadcast(status: UpdateStatus): void {
  currentStatus = status;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(IPC.app.onUpdateStatus, status);
    }
  }
}

function settlePending(status: UpdateStatus): void {
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  for (const resolve of resolvers) resolve(status);
}

function wireEvents(): void {
  if (wired) return;
  wired = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  // An unhandled 'error' event on an EventEmitter throws — always keep a listener.
  autoUpdater.on('error', (error) => {
    const status: UpdateStatus = {
      state: 'error',
      message: error instanceof Error ? error.message : 'Update check failed.',
    };
    broadcast(status);
    settlePending(status);
  });

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }));

  autoUpdater.on('update-available', (info) => {
    activeUpdateInfo = toUpdateInfo(info);
    const status: UpdateStatus = { state: 'available', info: activeUpdateInfo };
    broadcast(status);
    settlePending(status);
  });

  autoUpdater.on('update-not-available', () => {
    activeUpdateInfo = null;
    const status: UpdateStatus = { state: 'not-available' };
    broadcast(status);
    settlePending(status);
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    if (!activeUpdateInfo) return;
    broadcast({
      state: 'downloading',
      info: activeUpdateInfo,
      progress: {
        percent: progress.percent,
        transferredBytes: progress.transferred,
        totalBytes: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    activeUpdateInfo = toUpdateInfo(info);
    broadcast({ state: 'downloaded', info: activeUpdateInfo });
  });
}

/**
 * Unpackaged runs (electron-vite dev, or a build run without an installer)
 * never have real release metadata to check against, so update checks are a
 * no-op there — this feature only applies to installed, released builds.
 */
export async function checkForUpdates(manual: boolean): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    const status: UpdateStatus = {
      state: 'error',
      message: 'Update checks are only available in installed builds, not in development.',
    };
    if (manual) broadcast(status);
    return status;
  }

  wireEvents();
  return new Promise((resolve) => {
    pendingResolvers.push(resolve);
    autoUpdater.checkForUpdates().catch((error: unknown) => {
      const status: UpdateStatus = {
        state: 'error',
        message: error instanceof Error ? error.message : 'Update check failed.',
      };
      broadcast(status);
      settlePending(status);
    });
  });
}

export async function downloadUpdate(): Promise<void> {
  if (!app.isPackaged) return;
  await autoUpdater.downloadUpdate();
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall();
}

/** Runs an initial check on startup, then re-checks hourly while packaged. */
export function startHourlyUpdateChecks(): void {
  if (!app.isPackaged) return;
  wireEvents();
  void checkForUpdates(false);
  setInterval(() => {
    // Don't clobber a check/download/restart-confirmation the user is already in.
    const idleStates: UpdateStatus['state'][] = ['idle', 'not-available', 'error'];
    if (idleStates.includes(currentStatus.state)) void checkForUpdates(false);
  }, ONE_HOUR_MS);
}
