import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type {
  PackageInfo,
  PackageManagerSection,
  PackageUpdateItemResult,
  PackageUpdateRequest,
  PackageUpdateResult,
} from '../../shared/apiTypes';
import { CliNotFoundError, runCli, tryParseJson } from './execUtils';
import type { PackageManagerAdapter, UpdateProgressTick } from './types';

const MAX_SCAN_DEPTH = 4;
const PRUNED_DIRS = new Set(['bin', 'obj', 'node_modules', '.git']);

async function findCsprojFiles(root: string, dir = root, depth = 0): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (PRUNED_DIRS.has(entry.name)) continue;
      found.push(...(await findCsprojFiles(root, join(dir, entry.name), depth + 1)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csproj')) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

interface DotnetListPackage {
  id: string;
  resolvedVersion?: string;
  requestedVersion?: string;
  latestVersion?: string;
}

interface DotnetListJson {
  projects?: {
    path?: string;
    frameworks?: { topLevelPackages?: DotnetListPackage[] }[];
  }[];
}

function collectTopLevelPackages(json: DotnetListJson | null): Map<string, DotnetListPackage> {
  const map = new Map<string, DotnetListPackage>();
  for (const project of json?.projects ?? []) {
    for (const framework of project.frameworks ?? []) {
      for (const pkg of framework.topLevelPackages ?? []) {
        if (!map.has(pkg.id)) map.set(pkg.id, pkg);
      }
    }
  }
  return map;
}

async function detect(folderPath: string): Promise<boolean> {
  const files = await findCsprojFiles(folderPath);
  return files.length > 0;
}

async function listPackagesForProject(csprojPath: string): Promise<PackageInfo[]> {
  const cwd = dirname(csprojPath);
  const projectLabel = basename(csprojPath, '.csproj');
  const [installedRes, outdatedRes] = await Promise.all([
    runCli('dotnet', ['list', csprojPath, 'package', '--format', 'json'], cwd),
    runCli('dotnet', ['list', csprojPath, 'package', '--outdated', '--format', 'json'], cwd),
  ]);

  const installed = collectTopLevelPackages(tryParseJson<DotnetListJson>(installedRes.stdout));
  const outdated = collectTopLevelPackages(tryParseJson<DotnetListJson>(outdatedRes.stdout));

  const packages: PackageInfo[] = [];
  for (const [id, pkg] of installed) {
    const currentVersion = pkg.resolvedVersion ?? pkg.requestedVersion ?? 'unknown';
    const latestVersion = outdated.get(id)?.latestVersion ?? null;
    packages.push({
      name: id,
      currentVersion,
      latestVersion: latestVersion ?? currentVersion,
      isOutdated: latestVersion !== null && latestVersion !== currentVersion,
      isDev: false,
      isInstalled: true,
      manifestPath: csprojPath,
      projectLabel,
    });
  }
  return packages;
}

async function listPackages(folderPath: string): Promise<PackageManagerSection> {
  const csprojFiles = await findCsprojFiles(folderPath);
  if (csprojFiles.length === 0) {
    return { ecosystem: 'dotnet', manager: 'nuget', status: 'ok', message: null, packages: [] };
  }

  try {
    const perProject = await Promise.all(csprojFiles.map((path) => listPackagesForProject(path)));
    return {
      ecosystem: 'dotnet',
      manager: 'nuget',
      status: 'ok',
      message: null,
      packages: perProject.flat(),
    };
  } catch (err) {
    if (err instanceof CliNotFoundError) {
      return {
        ecosystem: 'dotnet',
        manager: 'nuget',
        status: 'cli-missing',
        message: 'Install the .NET SDK to manage NuGet packages for this project.',
        packages: [],
      };
    }
    return {
      ecosystem: 'dotnet',
      manager: 'nuget',
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to list NuGet packages.',
      packages: [],
    };
  }
}

async function updatePackages(
  _folderPath: string,
  updates: PackageUpdateRequest[],
  onProgress: (tick: UpdateProgressTick) => void,
): Promise<PackageUpdateResult> {
  const total = updates.length;
  const results: PackageUpdateItemResult[] = [];
  let completed = 0;

  // Run sequentially: concurrent `dotnet add` calls against different .csproj
  // in the same solution can race on the shared NuGet global-packages cache.
  for (const update of updates) {
    onProgress({ packageName: update.name, status: 'running', completed, total });
    const { code, stdout, stderr } = await runCli(
      'dotnet',
      ['add', update.manifestPath, 'package', update.name, '--version', update.targetVersion],
      dirname(update.manifestPath),
      2 * 60 * 1000,
    );
    const ok = code === 0;
    const message = ok ? 'Updated' : (stderr || stdout).slice(-500) || `dotnet exited with code ${code}`;
    completed++;
    results.push({ name: update.name, ok, message });
    onProgress({
      packageName: update.name,
      status: ok ? 'done' : 'error',
      message: ok ? undefined : message,
      completed,
      total,
    });
  }

  return { ok: results.every((r) => r.ok), results };
}

export const dotnetAdapter: PackageManagerAdapter = {
  ecosystem: 'dotnet',
  detect,
  listPackages,
  updatePackages,
};
