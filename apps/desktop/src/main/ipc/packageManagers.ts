import { resolve, sep } from 'node:path';
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type {
  PackageManagerEcosystem,
  PackageScanResult,
  PackageUpdateProgress,
  PackageUpdateRequest,
  PackageUpdateResult,
} from '../../shared/apiTypes';
import { PACKAGE_MANAGER_ADAPTERS, scanProjectPackages } from '../packageManagers';
import { store } from '../store';

/**
 * Package names and versions end up as arguments to npm/yarn/pnpm/dotnet, so
 * they are checked against what each ecosystem actually allows before they get
 * anywhere near a spawn. Anything outside these sets is refused rather than
 * escaped: no real package is named with a shell metacharacter.
 */
const NAME_PATTERNS: Record<PackageManagerEcosystem, RegExp> = {
  // Uppercase is allowed because npm names registered before it was banned still exist.
  node: /^(@[A-Za-z0-9-~][A-Za-z0-9-._~]*\/)?[A-Za-z0-9-~][A-Za-z0-9-._~]*$/,
  dotnet: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
};
/** Semver plus NuGet's four-part and pre-release/build forms. */
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;

async function getProjectPath(projectId: string): Promise<string> {
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.folderPath;
}

function isInside(candidate: string, root: string): boolean {
  const resolvedRoot = resolve(root);
  const resolved = resolve(candidate);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + sep);
}

/**
 * The adapters derive their working directory from `manifestPath`, so an
 * unchecked one would run an install (and that folder's lifecycle scripts)
 * anywhere on disk. Everything here has to belong to the selected project.
 */
function rejectUnsafeUpdate(update: PackageUpdateRequest, folderPath: string): string | null {
  const pattern = NAME_PATTERNS[update.ecosystem];
  if (!pattern) return `Unknown package ecosystem "${String(update.ecosystem)}".`;
  if (typeof update.name !== 'string' || !pattern.test(update.name)) {
    return `"${String(update.name)}" is not a valid package name.`;
  }
  if (typeof update.targetVersion !== 'string' || !VERSION_PATTERN.test(update.targetVersion)) {
    return `"${String(update.targetVersion)}" is not a valid version.`;
  }
  if (typeof update.manifestPath !== 'string' || !isInside(update.manifestPath, folderPath)) {
    return `"${String(update.manifestPath)}" is outside the project folder.`;
  }
  return null;
}

export function registerPackageManagerHandlers(): void {
  ipcMain.handle(
    IPC.packages.list,
    async (_event, projectId: string): Promise<PackageScanResult> => {
      const folderPath = await getProjectPath(projectId);
      return { projectId, sections: await scanProjectPackages(folderPath) };
    },
  );

  ipcMain.handle(
    IPC.packages.update,
    async (
      event,
      projectId: string,
      updates: PackageUpdateRequest[],
    ): Promise<PackageUpdateResult> => {
      const folderPath = await getProjectPath(projectId);

      // Refuse the whole batch rather than updating some of it: a request
      // carrying anything invalid did not come from the package list.
      for (const update of updates) {
        const problem = rejectUnsafeUpdate(update, folderPath);
        if (problem) {
          return {
            ok: false,
            results: [{ name: String(update?.name ?? ''), ok: false, message: problem }],
          };
        }
      }

      const results: PackageUpdateResult['results'] = [];
      let ok = true;

      for (const adapter of PACKAGE_MANAGER_ADAPTERS) {
        const forAdapter = updates.filter((u) => u.ecosystem === adapter.ecosystem);
        if (forAdapter.length === 0) continue;
        const result = await adapter.updatePackages(folderPath, forAdapter, (tick) => {
          const progress: PackageUpdateProgress = {
            projectId,
            ecosystem: adapter.ecosystem,
            packageName: tick.packageName,
            status: tick.status,
            message: tick.message,
            completed: tick.completed,
            total: tick.total,
          };
          // An update can run for minutes; closing or reloading the window
          // mid-run would otherwise throw from inside the adapter's callback
          // and abort the install partway through.
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC.packages.onUpdateProgress, progress);
          }
        });
        ok = ok && result.ok;
        results.push(...result.results);
      }

      return { ok, results };
    },
  );
}
