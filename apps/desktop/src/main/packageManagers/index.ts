import type { PackageManagerSection } from '../../shared/apiTypes';
import { dotnetAdapter } from './dotnetAdapter';
import { nodeAdapter } from './nodeAdapter';
import type { PackageManagerAdapter } from './types';

export const PACKAGE_MANAGER_ADAPTERS: PackageManagerAdapter[] = [nodeAdapter, dotnetAdapter];

export async function scanProjectPackages(folderPath: string): Promise<PackageManagerSection[]> {
  const detected = await Promise.all(
    PACKAGE_MANAGER_ADAPTERS.map(async (adapter) => ({
      adapter,
      matched: await adapter.detect(folderPath),
    })),
  );
  const sections = await Promise.all(
    detected.filter((d) => d.matched).map((d) => d.adapter.listPackages(folderPath)),
  );
  return sections;
}

export type { PackageManagerAdapter, UpdateProgressTick } from './types';
