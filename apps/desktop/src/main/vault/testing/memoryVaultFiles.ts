import type { VaultFileV1 } from '../format';
import type { VaultFilePort } from '../ports';

/** An in-memory vault.json for tests, with a switch to make the next writes fail. */
export class MemoryVaultFiles implements VaultFilePort {
  current: unknown | null = null;
  aside: Record<string, unknown> = {};
  writes = 0;
  failWrites = false;

  async read(): Promise<unknown | null> {
    return this.current === null ? null : structuredClone(this.current);
  }

  async write(file: VaultFileV1): Promise<void> {
    if (this.failWrites) throw new Error('disk full');
    this.writes++;
    this.current = structuredClone(file);
  }

  async moveAside(suffix: string): Promise<string | null> {
    if (this.current === null) return null;
    const name = `vault.json.${suffix}`;
    this.aside[name] = this.current;
    this.current = null;
    return name;
  }
}
