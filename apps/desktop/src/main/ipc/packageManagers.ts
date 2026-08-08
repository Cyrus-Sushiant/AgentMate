import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type {
  PackageScanResult,
  PackageUpdateProgress,
  PackageUpdateRequest,
  PackageUpdateResult,
} from '../../shared/apiTypes';
import { PACKAGE_MANAGER_ADAPTERS, scanProjectPackages } from '../packageManagers';
import { store } from '../store';

async function getProjectPath(projectId: string): Promise<string> {
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.folderPath;
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
          event.sender.send(IPC.packages.onUpdateProgress, progress);
        });
        ok = ok && result.ok;
        results.push(...result.results);
      }

      return { ok, results };
    },
  );
}
