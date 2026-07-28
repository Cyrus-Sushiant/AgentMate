import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  PackageInfo,
  PackageManagerKind,
  PackageManagerSection,
  PackageUpdateItemResult,
  PackageUpdateRequest,
  PackageUpdateResult,
} from '../../shared/apiTypes';
import { CliNotFoundError, mapWithConcurrency, runCli, tryParseJson } from './execUtils';
import type { PackageManagerAdapter, UpdateProgressTick } from './types';

const REGISTRY_TIMEOUT_MS = 8000;
const REGISTRY_CONCURRENCY = 5;

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: unknown;
}

interface DeclaredDep {
  name: string;
  isDev: boolean;
}

function detectManager(folderPath: string): PackageManagerKind {
  if (existsSync(join(folderPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(folderPath, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function readPackageJson(folderPath: string): Promise<PackageJsonShape | null> {
  try {
    const raw = await readFile(join(folderPath, 'package.json'), 'utf-8');
    return JSON.parse(raw) as PackageJsonShape;
  } catch {
    return null;
  }
}

async function readInstalledVersion(folderPath: string, name: string): Promise<string | null> {
  try {
    const raw = await readFile(join(folderPath, 'node_modules', name, 'package.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

interface OutdatedEntry {
  current?: string;
  wanted?: string;
  latest?: string;
}

async function runOutdated(
  manager: PackageManagerKind,
  folderPath: string,
): Promise<Record<string, OutdatedEntry> | null> {
  try {
    if (manager === 'npm') {
      const { stdout } = await runCli('npm', ['outdated', '--json', '--long'], folderPath);
      return tryParseJson<Record<string, OutdatedEntry>>(stdout.trim() || '{}');
    }
    if (manager === 'pnpm') {
      const { stdout } = await runCli('pnpm', ['outdated', '--format', 'json'], folderPath);
      return tryParseJson<Record<string, OutdatedEntry>>(stdout.trim() || '{}');
    }
    // yarn classic: NDJSON, one line per event; the "table" line holds the data we want.
    const { stdout } = await runCli('yarn', ['outdated', '--json'], folderPath);
    const map: Record<string, OutdatedEntry> = {};
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const parsed = tryParseJson<{ type: string; data?: { head?: string[]; body?: string[][] } }>(line);
      if (parsed?.type !== 'table' || !parsed.data?.body) continue;
      const head = parsed.data.head ?? [];
      const nameIdx = head.indexOf('Package');
      const currentIdx = head.indexOf('Current');
      const latestIdx = head.indexOf('Latest');
      for (const row of parsed.data.body) {
        const name = row[nameIdx];
        if (!name) continue;
        map[name] = { current: row[currentIdx], latest: row[latestIdx] };
      }
      return map;
    }
    return null; // yarn berry or unrecognized output — trigger registry fallback
  } catch (err) {
    if (err instanceof CliNotFoundError) throw err;
    return null;
  }
}

async function fetchLatestFromRegistry(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

async function detect(folderPath: string): Promise<boolean> {
  return existsSync(join(folderPath, 'package.json'));
}

async function listPackages(folderPath: string): Promise<PackageManagerSection> {
  const manager = detectManager(folderPath);
  const pkgJson = await readPackageJson(folderPath);
  if (!pkgJson) {
    return { ecosystem: 'node', manager, status: 'error', message: 'Failed to read package.json', packages: [] };
  }

  const declared: DeclaredDep[] = [
    ...Object.keys(pkgJson.dependencies ?? {}).map((name) => ({ name, isDev: false })),
    ...Object.keys(pkgJson.devDependencies ?? {}).map((name) => ({ name, isDev: true })),
  ];

  const manifestPath = join(folderPath, 'package.json');
  const workspaceNote =
    pkgJson.workspaces !== undefined ? ' (workspace root only — member packages not scanned)' : '';

  let outdated: Record<string, OutdatedEntry> | null;
  try {
    outdated = await runOutdated(manager, folderPath);
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      return {
        ecosystem: 'node',
        manager,
        status: 'cli-missing',
        message: `Install ${manager} to manage packages for this project.`,
        packages: [],
      };
    }
    outdated = null;
  }

  const needsFallback = outdated === null;
  const packages: PackageInfo[] = await mapWithConcurrency(declared, REGISTRY_CONCURRENCY, async (dep) => {
    const installedVersion = await readInstalledVersion(folderPath, dep.name);
    const entry = outdated?.[dep.name];
    const currentVersion = entry?.current ?? installedVersion ?? pkgJson.dependencies?.[dep.name] ?? pkgJson.devDependencies?.[dep.name] ?? 'unknown';
    let latestVersion = entry?.latest ?? null;
    if (latestVersion === null && needsFallback) {
      latestVersion = await fetchLatestFromRegistry(dep.name);
    }
    const isOutdated = latestVersion !== null && latestVersion !== currentVersion;
    return {
      name: dep.name,
      currentVersion,
      latestVersion: latestVersion ?? (isOutdated ? null : currentVersion),
      isOutdated,
      isDev: dep.isDev,
      isInstalled: installedVersion !== null,
      manifestPath,
    };
  });

  return {
    ecosystem: 'node',
    manager,
    status: 'ok',
    message: workspaceNote ? `Workspace root only — member packages not scanned.` : null,
    packages,
  };
}

function updateArgsFor(manager: PackageManagerKind, updates: PackageUpdateRequest[]): { command: string; args: string[] } {
  const targets = updates.map((u) => `${u.name}@${u.targetVersion}`);
  if (manager === 'yarn') return { command: 'yarn', args: ['upgrade', ...targets] };
  if (manager === 'pnpm') return { command: 'pnpm', args: ['update', ...targets] };
  return { command: 'npm', args: ['install', ...targets] };
}

async function updatePackages(
  folderPath: string,
  updates: PackageUpdateRequest[],
  onProgress: (tick: UpdateProgressTick) => void,
): Promise<PackageUpdateResult> {
  if (updates.length === 0) return { ok: true, results: [] };
  const manager = detectManager(folderPath);
  const total = updates.length;

  updates.forEach((u) => onProgress({ packageName: u.name, status: 'running', completed: 0, total }));

  const { command, args } = updateArgsFor(manager, updates);
  const { code, stdout, stderr } = await runCli(command, args, folderPath, 5 * 60 * 1000);
  const ok = code === 0;
  const message = ok ? 'Updated' : (stderr || stdout).slice(-500) || `${command} exited with code ${code}`;

  const results: PackageUpdateItemResult[] = updates.map((u) => ({ name: u.name, ok, message }));
  results.forEach((r) =>
    onProgress({
      packageName: r.name,
      status: r.ok ? 'done' : 'error',
      message: r.ok ? undefined : r.message,
      completed: total,
      total,
    }),
  );

  return { ok, results };
}

export const nodeAdapter: PackageManagerAdapter = {
  ecosystem: 'node',
  detect,
  listPackages,
  updatePackages,
};
