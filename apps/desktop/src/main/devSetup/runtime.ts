import { randomUUID } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import type {
  DevArch,
  DevDetection,
  DevItemId,
  DevJobState,
  DevOs,
  DevSetupEnvironment,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import { getAndroidSdk, refreshAndroidSdk } from '../android/sdk';
import { broadcastToWindows } from '../ipc/send';
import { cancelSpawn, spawnStreaming } from '../process/spawnStreaming';
import { store } from '../store';
import { refreshExtraToolPathDirs } from '../toolPaths';
import { refreshWindowsEnvVars, refreshWindowsPath } from '../windowsPath';
import { createDevSetupDetector } from './detectors';
import { createDevSetupInstaller, type InstallRequest } from './installer';
import { createPackageManagerDetector } from './packageManagers';
import { findExecutable, isExecutableFile, runProbe } from './probe';
import { createPackageManagerRunner } from './runners/packageManagerRunner';

/**
 * Binds the Dev Setup detectors and installer to the real machine: its processes, its disk, its
 * Android SDK and its windows. Everything with logic in it takes these as injected dependencies, so
 * this file stays thin.
 */

export interface DevSetupService {
  environment(options?: { force?: boolean }): Promise<DevSetupEnvironment>;
  detect(id: DevItemId, options?: { force?: boolean }): Promise<DevDetection>;
  /** What is remembered, without probing anything. */
  peek(ids: readonly DevItemId[]): Record<DevItemId, DevDetection | undefined>;
  install(request: InstallRequest): Promise<DevJobState>;
  /** With an id, takes that waiting step out of the queue; without, stops the whole run. */
  cancel(id?: DevItemId): void;
  jobState(): DevJobState;
  /** Stops anything running. For quitting the app. */
  dispose(): void;
}

/** Variables an installer is likely to set, read back into this process after an install. */
const INSTALL_ENV_VARS = [
  'JAVA_HOME',
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'DOTNET_ROOT',
  'FLUTTER_ROOT',
] as const;

function currentOs(): DevOs {
  return process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux';
}

function currentArch(): DevArch {
  return process.arch === 'x64' || process.arch === 'arm64' ? process.arch : 'other';
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createService(): DevSetupService {
  const os = currentOs();

  const packageManagers = createPackageManagerDetector({
    os,
    probe: (command, args) => runProbe(command, args),
    now: Date.now,
  });

  const detector = createDevSetupDetector({
    os,
    home: homedir(),
    env: () => process.env,
    probe: (command, args, options) => runProbe(command, args, options),
    exists: pathExists,
    readFile: async (path) => readFile(path, 'utf-8').catch(() => null),
    listDir: async (path) => readdir(path).catch(() => []),
    findExecutable: (command) =>
      findExecutable(command, { env: process.env, os, exists: isExecutableFile }),
    androidSdk: () => getAndroidSdk(),
    now: Date.now,
  });

  const environment = async (options: { force?: boolean } = {}): Promise<DevSetupEnvironment> => {
    // PATH is read once at launch, so a tool installed since then is invisible until it is read
    // back from the registry.
    await refreshWindowsPath({ force: options.force });
    return {
      os,
      arch: currentArch(),
      packageManagers: await packageManagers.detect({ force: options.force }),
    };
  };

  const detect = async (
    id: DevItemId,
    options: { force?: boolean } = {},
  ): Promise<DevDetection> => {
    await refreshWindowsPath({ force: options.force });
    return detector.detect(id, options);
  };

  const packageManagerRunner = createPackageManagerRunner({
    spawn: spawnStreaming,
    cwd: homedir(),
  });

  const installer = createDevSetupInstaller({
    environment: () => environment(),
    stacks: async () => (await store.getSettings()).devSetupStacks,
    detect,
    run: async (step, hooks) => {
      const { recipe, intent } = step.mode;
      if (recipe.kind === 'managed') {
        return {
          ok: false,
          code: null,
          cancelled: false,
          message: 'This install is not available in the app yet.',
        };
      }
      return packageManagerRunner.run(recipe, intent, hooks);
    },
    afterInstall: async () => {
      // What the installer changed: PATH, the variables it set, and the folders cached from them.
      await refreshWindowsPath({ force: true });
      await refreshWindowsEnvVars(INSTALL_ENV_VARS);
      refreshExtraToolPathDirs();
      refreshAndroidSdk();
    },
    cancelRun: cancelSpawn,
    emit: (event) => broadcastToWindows(IPC.devSetup.onEvent, event),
    newJobId: randomUUID,
  });

  return {
    environment,
    detect,
    peek: (ids) => detector.peek(ids),
    install: (request) => installer.install(request),
    cancel: (id) => installer.cancel(id),
    jobState: () => installer.jobState(),
    dispose: () => installer.dispose(),
  };
}

let service: DevSetupService | null = null;

export function getDevSetupService(): DevSetupService {
  service ??= createService();
  return service;
}

/** Stops a running install on quit. Does nothing when the page was never opened. */
export function disposeDevSetup(): void {
  service?.dispose();
}
