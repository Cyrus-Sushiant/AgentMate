import { type ChildProcess, execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
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
import { mapWithConcurrency } from '../packageManagers/execUtils';
import { compareVersions, fetchLatestVersion } from '../registryVersions';
import { killProcessTree } from '../security/exec';

/**
 * Some CLIs take a long time to answer `--version` (Cline and Cursor's agent run past ten seconds,
 * a cold Node start under antivirus is slow too). Being slow no longer means "not installed", since
 * finding the executable decides that, so this only bounds how long the version is waited for.
 */
const VERSION_TIMEOUT_MS = 20_000;
/** Fifteen Node CLIs starting at once slowed each other past the timeout. */
const PROBE_CONCURRENCY = 4;

function pathKey(env: NodeJS.ProcessEnv): string {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
}

function regQueryPath(hive: string): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'reg.exe',
      ['query', hive, '/v', 'Path'],
      { windowsHide: true, timeout: 5000 },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        const match = /\bPath\s+REG_(?:EXPAND_)?SZ\s+(.*)/i.exec(stdout);
        const value = (match?.[1] ?? '').trim().replace(/%([^%]+)%/g, (whole, name: string) => {
          const key = Object.keys(process.env).find((k) => k.toUpperCase() === name.toUpperCase());
          return key ? (process.env[key] ?? whole) : whole;
        });
        resolve(value.split(';').filter(Boolean));
      },
    );
  });
}

/**
 * The app keeps the PATH it started with, so a CLI installed (or a PATH entry added) after that
 * showed as missing for the whole session while a new cmd window found it. On Windows the current
 * PATH is read back from the registry and any new folders are added to this process's PATH, which
 * also lets what the app starts from here on find the CLI.
 */
async function refreshWindowsPath(): Promise<void> {
  if (process.platform !== 'win32') return;
  const [machine, user] = await Promise.all([
    regQueryPath('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'),
    regQueryPath('HKCU\\Environment'),
  ]);
  const key = pathKey(process.env);
  const current = (process.env[key] ?? '').split(delimiter).filter(Boolean);
  const known = new Set(current.map((dir) => dir.toLowerCase().replace(/[\\/]+$/, '')));
  const added = [...machine, ...user].filter((dir) => {
    const normalized = dir.toLowerCase().replace(/[\\/]+$/, '');
    if (known.has(normalized)) return false;
    known.add(normalized);
    return true;
  });
  if (added.length > 0) process.env[key] = [...current, ...added].join(delimiter);
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Where on PATH the CLI lives, looked up the way the shell would, without starting it. */
async function findOnPath(cli: CliDefinition): Promise<string | null> {
  const dirs = (process.env[pathKey(process.env)] ?? '').split(delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
      : [''];
  const names = [...new Set([cli.versionCommand.command, ...cli.executableNames])];
  for (const dir of dirs) {
    for (const name of names) {
      for (const ext of extensions) {
        const candidate = join(dir, name + ext);
        if (await isExecutable(candidate)) return candidate;
      }
    }
  }
  return null;
}

interface VersionProbe {
  stdout: string;
  ok: boolean;
}

function probeVersion(cli: CliDefinition): Promise<VersionProbe> {
  return new Promise((resolve) => {
    // npm-installed global CLIs are typically .cmd shims on Windows, which
    // Node refuses to spawn directly (security fix in Node >=18.20/20.11/21.6).
    // Route through cmd.exe explicitly (argv array, not `shell: true`) so
    // Node doesn't naively string-concatenate args. command/args here are
    // always static, developer-authored registry entries, never renderer input.
    // Cline's CLI self-updates on every invocation, including a bare version check, by
    // spawning a detached background installer; on Windows that can flash open a visible
    // console. This is a no-op env var for every other CLI we shell out to.
    const options = {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, CLINE_NO_AUTO_UPDATE: '1' },
    };
    let settled = false;
    const finish = (probe: VersionProbe): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(probe);
    };
    const callback = (error: Error | null, stdout: string): void => {
      finish({ stdout: stdout ?? '', ok: !error });
    };
    const child: ChildProcess =
      process.platform === 'win32'
        ? execFile(
            'cmd.exe',
            ['/d', '/s', '/c', cli.versionCommand.command, ...cli.versionCommand.args],
            options,
            callback,
          )
        : execFile(cli.versionCommand.command, cli.versionCommand.args, options, callback);
    // Killing only cmd.exe left the CLI itself running and holding the output pipe open.
    const timer = setTimeout(() => {
      killProcessTree(child);
      finish({ stdout: '', ok: false });
    }, VERSION_TIMEOUT_MS);
  });
}

async function detectCli(cli: CliDefinition): Promise<InstalledCli> {
  const lastCheckedAt = new Date().toISOString();
  const executablePath = await findOnPath(cli);
  const probe = await probeVersion(cli);
  // Found on PATH is installed even when the version check fails or runs long (a CLI in the
  // middle of updating itself, a slow cold start). Otherwise the check answering at all is proof.
  const installed = executablePath !== null || probe.ok;
  const stdout = probe.ok ? probe.stdout : '';
  const versionMatch = stdout.match(/\d+\.\d+\.\d+[\w.-]*/);
  return {
    id: cli.id,
    installed,
    version: installed
      ? versionMatch
        ? versionMatch[0]
        : stdout.trim().slice(0, 40) || null
      : null,
    executablePath,
    lastCheckedAt,
  };
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
/** A sweep that found something missing is kept only briefly, so a CLI installed since shows up. */
const MISSING_CACHE_TTL_MS = 20 * 1000;

let detectCache: { value: InstalledCli[]; at: number } | null = null;
let detectInFlight: Promise<InstalledCli[]> | null = null;

function detectAllClis(force: boolean): Promise<InstalledCli[]> {
  if (!force && detectCache) {
    const ttl = detectCache.value.every((cli) => cli.installed)
      ? DETECT_CACHE_TTL_MS
      : MISSING_CACHE_TTL_MS;
    if (Date.now() - detectCache.at < ttl) return Promise.resolve(detectCache.value);
  }
  // Concurrent callers share one sweep rather than each starting their own. A forced rescan
  // still waits for a running one to end first, then starts over with a fresh PATH.
  if (detectInFlight && !force) return detectInFlight;
  const previous = detectInFlight ?? Promise.resolve([]);
  const sweep = previous
    .catch(() => [])
    .then(async () => {
      await refreshWindowsPath();
      return mapWithConcurrency(CLI_REGISTRY, PROBE_CONCURRENCY, detectCli);
    })
    .then((value) => {
      detectCache = { value, at: Date.now() };
      return value;
    })
    .finally(() => {
      if (detectInFlight === sweep) detectInFlight = null;
    });
  detectInFlight = sweep;
  return sweep;
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
