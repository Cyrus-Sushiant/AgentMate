import type { VaultFileV1 } from './format';

/** Where vault.json lives. The Electron version writes atomically under userData/data. */
export interface VaultFilePort {
  /** The parsed file, or null when there is no vault yet. */
  read(): Promise<unknown | null>;
  write(file: VaultFileV1): Promise<void>;
  /** Renames the file to `vault.json.<suffix>` and returns that name, or null if there was none. */
  moveAside(suffix: string): Promise<string | null>;
}

export interface PowerPort {
  /** Subscribes to the OS locking the screen or going to sleep. Returns an unsubscribe. */
  onSystemLock(listener: () => void): () => void;
}
