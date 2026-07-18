import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';
import {
  CLI_REGISTRY,
  getCliDefinition,
  getInstallCommandForCurrentOS,
  getUpdateCommandForCurrentOS,
} from '@agentmat/core';
import type {
  CliDefinition,
  CliUpdateCheckResult,
  InstalledCli,
  SupportedOS,
  UpdateCheckSource,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';

const execFileAsync = promisify(execFile);
const UPDATE_CHECK_TIMEOUT_MS = 8000;

async function fetchLatestVersion(source: UpdateCheckSource): Promise<string | null> {
  try {
    if (source.type === 'npm') {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(source.package)}/latest`, {
        signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { version?: string };
      return data.version ?? null;
    }
    if (source.type === 'pypi') {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(source.package)}/json`, {
        signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { info?: { version?: string } };
      return data.info?.version ?? null;
    }
    const res = await fetch(`https://api.github.com/repos/${source.package}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string };
    return data.tag_name ? data.tag_name.replace(/^v/, '') : null;
  } catch {
    return null;
  }
}

/** Compares dot/dash-separated numeric version segments; positive when `a` is newer than `b`. */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(/[.-]/).map((part) => parseInt(part, 10));
  const partsB = b.split(/[.-]/).map((part) => parseInt(part, 10));
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const na = partsA[i] || 0;
    const nb = partsB[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

async function detectCli(cli: CliDefinition): Promise<InstalledCli> {
  try {
    // npm-installed global CLIs are typically .cmd shims on Windows, which
    // Node refuses to spawn directly (security fix in Node >=18.20/20.11/21.6).
    // Route through cmd.exe explicitly (argv array, not `shell: true`) so
    // Node doesn't naively string-concatenate args — command/args here are
    // always static, developer-authored registry entries, never renderer input.
    const { stdout } =
      process.platform === 'win32'
        ? await execFileAsync(
            'cmd.exe',
            ['/d', '/s', '/c', cli.versionCommand.command, ...cli.versionCommand.args],
            { timeout: 8000, windowsHide: true },
          )
        : await execFileAsync(cli.versionCommand.command, cli.versionCommand.args, {
            timeout: 8000,
            windowsHide: true,
          });
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

export function registerCliDetectionHandlers(): void {
  ipcMain.handle(IPC.cli.detectAll, async (): Promise<InstalledCli[]> => {
    return Promise.all(CLI_REGISTRY.map((cli) => detectCli(cli)));
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
        return { cliId, supported: false, currentVersion, latestVersion: null, updateAvailable: false, checkedAt };
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
