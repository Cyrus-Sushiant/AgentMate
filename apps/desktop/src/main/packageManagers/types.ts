import type {
  PackageManagerEcosystem,
  PackageManagerSection,
  PackageUpdateRequest,
  PackageUpdateResult,
} from '../../shared/apiTypes';

export interface UpdateProgressTick {
  packageName: string;
  status: 'running' | 'done' | 'error';
  message?: string;
  completed: number;
  total: number;
}

export interface PackageManagerAdapter {
  ecosystem: PackageManagerEcosystem;
  /** Filesystem-only check — must not spawn a CLI. */
  detect(folderPath: string): Promise<boolean>;
  listPackages(folderPath: string): Promise<PackageManagerSection>;
  updatePackages(
    folderPath: string,
    updates: PackageUpdateRequest[],
    onProgress: (tick: UpdateProgressTick) => void,
  ): Promise<PackageUpdateResult>;
}
