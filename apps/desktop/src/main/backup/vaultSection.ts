import { readVaultFileShape, type VaultFileV1 } from '../vault/format';
import type { VaultFilePort } from '../vault/ports';

/**
 * The Vault rides along in backups as its own encrypted file, byte for byte. It stays locked with
 * its master password the whole way, so the backup needs no extra password for it.
 */
export function readVaultSection(raw: unknown): VaultFileV1 | null {
  return readVaultFileShape(raw);
}

export async function currentVaultSection(files: VaultFilePort): Promise<VaultFileV1 | null> {
  return readVaultFileShape(await files.read());
}

/**
 * Locks the vault, sets the current file aside as `vault.json.pre-restore-<time>` and writes the
 * one from the backup. If that write fails, the old file goes back where it was.
 */
export async function restoreVaultSection(
  section: VaultFileV1,
  files: VaultFilePort,
  lock: () => Promise<void>,
  now: Date,
): Promise<void> {
  await lock();
  // Set aside even when damaged: it might still be the only copy someone can recover.
  const previous = await files.read();
  if (previous !== null) {
    await files.moveAside(`pre-restore-${now.toISOString().replace(/[:.]/g, '-')}`);
  }
  try {
    await files.write(section);
  } catch (error) {
    if (previous !== null) await files.write(previous as VaultFileV1).catch(() => undefined);
    throw error;
  }
}
