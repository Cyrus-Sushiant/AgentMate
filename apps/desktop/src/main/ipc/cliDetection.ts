import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  CliDefinition,
  CliUpdateCheckResult,
  InstalledCli,
  SupportedOS,
} from '@agentmat/core';
import {
  CLI_REGISTRY,
  getCliDefinition,
  getInstallCommandForCurrentOS,
  getUpdateCommandForCurrentOS,
} from '@agentmat/core';
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { compareVersions, fetchLatestVersion } from '../registryVersions';

const execFileAsync = promisify(execFile);

async function detectCli(cli: CliDefinition): Promise<InstalledCli> {
  try {
    // npm-installed global CLIs are typically .cmd shims on Windows, which
    // Node refuses to spawn directly (security fix in Node >=18.20/20.11/21.6).
    // Route through cmd.exe explicitly (argv array, not `shell: true`) so
    // Node doesn't naively string-concatenate args. command/args here are
    // always static, developer-authored registry entries, never renderer input.
    // Cline's CLI self-updates on every invocation, including a bare version check, by
    // spawning a detached background installer; on Windows that can flash open a visible
    // console. This is a no-op env var for every other CLI we shell out to.
    const execOptions = {
      timeout: 8000,
      windowsHide: true,
      env: { ...process.env, CLINE_NO_AUTO_UPDATE: '1' },
    };
    const { stdout } =
      process.platform === 'win32'
        ? await execFileAsync(
            'cmd.exe',
            ['/d', '/s', '/c', cli.versionCommand.command, ...cli.versionCommand.args],
            execOptions,
          )
        : await execFileAsync(cli.versionCommand.command, cli.versionCommand.args, execOptions);
    const versionMatch = stdout.match(/\d+\.\d+\.\d+[\w.-]*/);
    return {
      id: cli.id,
      installed: true,
      version: versionMatch ? versionMatch[0] : stdout.trim().slice(0, 40) || null,
      executablePath: null,
      lastCheckedAt: new Date().toISOString(),
    };
  } catch {
    return {
      id: cli.id,
      installed: false,
      version: null,
      executablePath: null,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

/**
 * A full sweep spawns one child process per registry entry (two on Windows, via
 * cmd.exe) and five renderer call sites share the same query key, so plain
 * navigation between Dashboard, CLI Manager, Tools and Project Detail used to
 * re-run the whole thing every few seconds. Installing or removing a CLI is rare
 * enough that a few minutes of staleness costs nothing, and the CLI Manager's
 * Refresh button passes `force` when the user genuinely wants a rescan.
 */
const DETECT_CACHE_TTL_MS = 5 * 60 * 1000;

let detectCache: { value: InstalledCli[]; at: number } | null = null;
let detectInFlight: Promise<InstalledCli[]> | null = null;

function detectAllClis(force: boolean): Promise<InstalledCli[]> {
  if (!force && detectCache && Date.now() - detectCache.at < DETECT_CACHE_TTL_MS) {
    return Promise.resolve(detectCache.value);
  }
  // Concurrent callers share one sweep rather than each starting their own.
  if (detectInFlight) return detectInFlight;
  detectInFlight = Promise.all(CLI_REGISTRY.map((cli) => detectCli(cli)))
    .then((value) => {
      detectCache = { value, at: Date.now() };
      return value;
    })
    .finally(() => {
      detectInFlight = null;
    });
  return detectInFlight;
}

export function registerCliDetectionHandlers(): void {
  ipcMain.handle(IPC.cli.detectAll, (_event, force?: boolean): Promise<InstalledCli[]> => {
    return detectAllClis(force === true);
  });

  ipcMain.handle(IPC.cli.getInstallCommand, (_event, cliId: string): string | null => {
    const cli = getCliDefinition(cliId);
    if (!cli) return null;
    return getInstallCommandForCurrentOS(cli, process.platform as SupportedOS);
  });

  ipcMain.handle(
    IPC.cli.checkForUpdate,
    async (_event, cliId: string, currentVersion: string | null): Promise<CliUpdateCheckResult> => {
      const cli = getCliDefinition(cliId);
      const checkedAt = new Date().toISOString();
      if (!cli?.updateCheck) {
        return {
          cliId,
          supported: false,
          currentVersion,
          latestVersion: null,
          updateAvailable: false,
          checkedAt,
        };
      }
      const latestVersion = await fetchLatestVersion(cli.updateCheck);
      const updateAvailable =
        !!latestVersion && !!currentVersion && compareVersions(latestVersion, currentVersion) > 0;
      return { cliId, supported: true, currentVersion, latestVersion, updateAvailable, checkedAt };
    },
  );

  ipcMain.handle(IPC.cli.getUpdateCommand, (_event, cliId: string): string | null => {
    const cli = getCliDefinition(cliId);
    if (!cli) return null;
    return getUpdateCommandForCurrentOS(cli, process.platform as SupportedOS);
  });
}
