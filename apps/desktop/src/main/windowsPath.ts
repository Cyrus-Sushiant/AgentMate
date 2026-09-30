import { execFile } from 'node:child_process';
import { delimiter } from 'node:path';

/** PATH rarely changes, so reading it back more often than this only costs reg.exe runs. */
const REFRESH_THROTTLE_MS = 30_000;
let lastRefreshAt = 0;
let refreshing: Promise<void> | null = null;

export function pathKey(env: NodeJS.ProcessEnv): string {
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
export async function refreshWindowsPath({ force = false } = {}): Promise<void> {
  if (process.platform !== 'win32') return;
  // A sweep for any usable CLI can miss a dozen in a row, and each miss asks for a refresh.
  if (refreshing) return refreshing;
  if (!force && Date.now() - lastRefreshAt < REFRESH_THROTTLE_MS) return;
  refreshing = readRegistryPath().finally(() => {
    lastRefreshAt = Date.now();
    refreshing = null;
  });
  return refreshing;
}

async function readRegistryPath(): Promise<void> {
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
