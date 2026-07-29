import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
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
const MAX_SCAN_DEPTH = 4;
const PRUNED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.turbo', 'coverage']);

interface PackageJsonShape {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: unknown;
}

interface DeclaredDep {
  name: string;
  isDev: boolean;
}

/** Recursively finds every package.json under root, skipping node_modules and other noisy dirs. */
async function findPackageJsonFiles(root: string, dir = root, depth = 0): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  if (entries.some((e) => e.isFile() && e.name === 'package.json')) {
    found.push(join(dir, 'package.json'));
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !PRUNED_DIRS.has(entry.name)) {
      found.push(...(await findPackageJsonFiles(root, join(dir, entry.name), depth + 1)));
    }
  }
  return found;
}

function detectManager(folderPath: string): PackageManagerKind {
  if (existsSync(join(folderPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(folderPath, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function readPackageJson(manifestPath: string): Promise<PackageJsonShape | null> {
  try {
    const raw = await readFile(manifestPath, 'utf-8');
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
    return null; // yarn berry or unrecognized output, trigger registry fallback
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
  const manifests = await findPackageJsonFiles(folderPath);
  return manifests.length > 0;
}

function labelForManifest(rootFolder: string, manifestPath: string, pkgJson: PackageJsonShape): string {
  if (pkgJson.name) return pkgJson.name;
  const rel = relative(rootFolder, dirname(manifestPath));
  return rel === '' ? basename(rootFolder) : rel;
}

interface ProjectScanOutcome {
  status: 'ok' | 'cli-missing' | 'error';
  message: string | null;
  packages: PackageInfo[];
}

async function listPackagesForManifest(rootFolder: string, manifestPath: string): Promise<ProjectScanOutcome> {
  const folderPath = dirname(manifestPath);
  const manager = detectManager(folderPath);
  const pkgJson = await readPackageJson(manifestPath);
  if (!pkgJson) {
    return { status: 'error', message: `Failed to read ${manifestPath}`, packages: [] };
  }

  const declared: DeclaredDep[] = [
    ...Object.keys(pkgJson.dependencies ?? {}).map((name) => ({ name, isDev: false })),
    ...Object.keys(pkgJson.devDependencies ?? {}).map((name) => ({ name, isDev: true })),
  ];
  const projectLabel = labelForManifest(rootFolder, manifestPath, pkgJson);

  let outdated: Record<string, OutdatedEntry> | null;
  try {
    outdated = await runOutdated(manager, folderPath);
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      return {
        status: 'cli-missing',
        message: `Install ${manager} to manage packages for ${projectLabel}.`,
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
      projectLabel,
    };
  });

  return { status: 'ok', message: null, packages };
}

async function listPackages(folderPath: string): Promise<PackageManagerSection> {
  const manifests = await findPackageJsonFiles(folderPath);
  if (manifests.length === 0) {
    return { ecosystem: 'node', manager: detectManager(folderPath), status: 'ok', message: null, packages: [] };
  }

  const outcomes = await Promise.all(manifests.map((m) => listPackagesForManifest(folderPath, m)));
  const packages = outcomes.flatMap((o) => o.packages);
  const errored = outcomes.filter((o) => o.status !== 'ok');

  if (packages.length === 0 && errored.length > 0) {
    const cliMissing = errored.find((o) => o.status === 'cli-missing');
    const first = cliMissing ?? errored[0];
    return { ecosystem: 'node', manager: detectManager(folderPath), status: first.status, message: first.message, packages: [] };
  }

  const message =
    errored.length > 0
      ? `${errored.length} of ${manifests.length} sub-project${manifests.length === 1 ? '' : 's'} failed to scan.`
      : null;

  return { ecosystem: 'node', manager: detectManager(folderPath), status: 'ok', message, packages };
}

function updateArgsFor(manager: PackageManagerKind, updates: PackageUpdateRequest[]): { command: string; args: string[] } {
  const targets = updates.map((u) => `${u.name}@${u.targetVersion}`);
  if (manager === 'yarn') return { command: 'yarn', args: ['upgrade', ...targets] };
  if (manager === 'pnpm') return { command: 'pnpm', args: ['update', ...targets] };
  return { command: 'npm', args: ['install', ...targets] };
}

async function updatePackages(
  _folderPath: string,
  updates: PackageUpdateRequest[],
  onProgress: (tick: UpdateProgressTick) => void,
): Promise<PackageUpdateResult> {
  if (updates.length === 0) return { ok: true, results: [] };
  const total = updates.length;

  const groups = new Map<string, PackageUpdateRequest[]>();
  for (const update of updates) {
    const dir = dirname(update.manifestPath);
    const group = groups.get(dir);
    if (group) group.push(update);
    else groups.set(dir, [update]);
  }

  updates.forEach((u) => onProgress({ packageName: u.name, status: 'running', completed: 0, total }));

  let completed = 0;
  const results: PackageUpdateItemResult[] = [];
  let ok = true;

  for (const [dir, groupUpdates] of groups) {
    const manager = detectManager(dir);
    const { command, args } = updateArgsFor(manager, groupUpdates);
    const { code, stdout, stderr } = await runCli(command, args, dir, 5 * 60 * 1000);
    const groupOk = code === 0;
    const message = groupOk ? 'Updated' : (stderr || stdout).slice(-500) || `${command} exited with code ${code}`;
    ok = ok && groupOk;
    completed += groupUpdates.length;

    for (const u of groupUpdates) {
      results.push({ name: u.name, ok: groupOk, message });
      onProgress({
        packageName: u.name,
        status: groupOk ? 'done' : 'error',
        message: groupOk ? undefined : message,
        completed,
        total,
      });
    }
  }

  return { ok, results };
}

export const nodeAdapter: PackageManagerAdapter = {
  ecosystem: 'node',
  detect,
  listPackages,
  updatePackages,
};
