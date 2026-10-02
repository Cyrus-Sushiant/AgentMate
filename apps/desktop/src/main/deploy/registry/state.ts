import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SecretEnvelope } from '../../../shared/apiTypes';
import { normalizeRegistry } from '../../../shared/deploy/registries';
import type { DeployRegistryKind, DeployRegistrySource } from '../../../shared/deployRegistryTypes';
import type { SealedSecretStore } from '../../ssh/vault';

/**
 * Registry sign-ins on this computer (E08), in registries.json beside the other stores. Each
 * secret is sealed with the Servers vault (safeStorage, or the passkey when one is set) and only
 * the main process unseals it, to send it with a deploy. One sign-in per registry, as the docker
 * CLI keeps them. Each app's choice to send them or not sits here too, keyed by server and app.
 * Anything unreadable is dropped rather than trusted, and one write queue keeps two changes from
 * losing each other.
 */

export interface StoredRegistryCredential {
  id: string;
  kind: DeployRegistryKind;
  source: DeployRegistrySource;
  registry: string;
  username: string;
  envelope: SecretEnvelope;
  scopes: string[] | null;
  broaderScopes: string[];
  savedAt: number;
  checkedAt: number | null;
}

export interface RegistryStateFile {
  version: 1;
  credentials: StoredRegistryCredential[];
  /** `${serverId}:${stackId}` to whether that app's deploys send this computer's sign-ins. */
  apps: Record<string, { sendSignIns: boolean }>;
}

export interface RegistryStatePort {
  read: () => Promise<unknown>;
  write: (value: RegistryStateFile) => Promise<void>;
}

const KINDS: ReadonlySet<string> = new Set<DeployRegistryKind>(['github', 'dockerhub', 'custom']);
const SOURCES: ReadonlySet<string> = new Set<DeployRegistrySource>([
  'packagesToken',
  'ghCli',
  'password',
]);
const APP_KEY = /^[A-Za-z0-9_-]{1,128}:[0-9a-f-]{36}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnvelope(value: unknown): value is SecretEnvelope {
  if (!isObject(value) || typeof value.ciphertext !== 'string') return false;
  if (value.mode === 'safeStorage') return true;
  return (
    value.mode === 'passphrase' && typeof value.iv === 'string' && typeof value.authTag === 'string'
  );
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCredential(value: unknown): value is StoredRegistryCredential {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    KINDS.has(value.kind) &&
    typeof value.source === 'string' &&
    SOURCES.has(value.source) &&
    typeof value.registry === 'string' &&
    normalizeRegistry(value.registry) === value.registry &&
    typeof value.username === 'string' &&
    isEnvelope(value.envelope) &&
    (value.scopes === null || isStrings(value.scopes)) &&
    isStrings(value.broaderScopes) &&
    typeof value.savedAt === 'number' &&
    (value.checkedAt === null || typeof value.checkedAt === 'number')
  );
}

function parse(value: unknown): RegistryStateFile {
  const empty: RegistryStateFile = { version: 1, credentials: [], apps: {} };
  if (!isObject(value) || value.version !== 1) return empty;
  const credentials: StoredRegistryCredential[] = [];
  for (const item of Array.isArray(value.credentials) ? value.credentials : []) {
    if (isCredential(item) && !credentials.some((other) => other.registry === item.registry)) {
      credentials.push(item);
    }
  }
  const apps: RegistryStateFile['apps'] = {};
  if (isObject(value.apps)) {
    for (const [key, choice] of Object.entries(value.apps)) {
      if (APP_KEY.test(key) && isObject(choice) && typeof choice.sendSignIns === 'boolean') {
        apps[key] = { sendSignIns: choice.sendSignIns };
      }
    }
  }
  return { version: 1, credentials, apps };
}

export function appKey(serverId: string, stackId: string): string {
  return `${serverId}:${stackId}`;
}

export class RegistryState {
  private queue: Promise<unknown> = Promise.resolve();

  /** Moves every sealed secret when the Servers passkey changes (see vault.ts). */
  readonly sealedKeys: SealedSecretStore = {
    prepare: async (move) => {
      const credentials = (await this.read()).credentials;
      const moved = await Promise.all(
        credentials.map(async (item) => ({ id: item.id, envelope: await move(item.envelope) })),
      );
      return () =>
        this.update((file) => ({
          ...file,
          credentials: file.credentials.map((item) => {
            const next = moved.find((entry) => entry.id === item.id);
            return next ? { ...item, envelope: next.envelope } : item;
          }),
        }));
    },
  };

  constructor(private readonly port: RegistryStatePort) {}

  async credentials(): Promise<StoredRegistryCredential[]> {
    return (await this.read()).credentials;
  }

  /** Saves the sign-in, replacing any other one for the same registry. */
  save(credential: StoredRegistryCredential): Promise<void> {
    return this.update((file) => ({
      ...file,
      credentials: [
        ...file.credentials.filter((item) => item.registry !== credential.registry),
        credential,
      ],
    }));
  }

  remove(id: string): Promise<void> {
    return this.update((file) => ({
      ...file,
      credentials: file.credentials.filter((item) => item.id !== id),
    }));
  }

  async sendSignIns(serverId: string, stackId: string): Promise<boolean> {
    return (await this.read()).apps[appKey(serverId, stackId)]?.sendSignIns ?? true;
  }

  setSendSignIns(serverId: string, stackId: string, sendSignIns: boolean): Promise<void> {
    return this.update((file) => ({
      ...file,
      apps: { ...file.apps, [appKey(serverId, stackId)]: { sendSignIns } },
    }));
  }

  private async read(): Promise<RegistryStateFile> {
    await this.queue.catch(() => undefined);
    return parse(await this.port.read());
  }

  private update(change: (file: RegistryStateFile) => RegistryStateFile): Promise<void> {
    const next = this.queue
      .catch(() => undefined)
      .then(async () => {
        await this.port.write(change(parse(await this.port.read())));
      });
    this.queue = next;
    return next;
  }
}

/** A JSON file written to a temporary name and renamed over, readable only by the user. */
export function registryFilePort(path: string): RegistryStatePort {
  return {
    async read() {
      let raw: string;
      try {
        raw = await readFile(path, 'utf-8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },
    async write(value) {
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(value, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
      await rename(temporary, path);
    },
  };
}
