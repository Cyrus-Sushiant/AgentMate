import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SecretEnvelope } from '../../shared/apiTypes';
import type { DeployCoreRecord, DeployTransport } from '../../shared/deployTypes';
import type { SealedSecretStore } from '../ssh/vault';

/**
 * The app's record of the core it installed on each saved server, and of this computer's device
 * on it, in `deploy.json` beside the other stores. Core records only cache what the server can
 * confirm again, so anything unreadable is dropped rather than trusted. Device credentials never
 * go to the renderer; their private key is only ever stored sealed with the Servers vault. One
 * write queue keeps two installs from losing each other's record.
 */

/** This computer's enrolled device on one server core. Main process only. */
export interface DeviceCredentials {
  deviceId: string;
  userName: string;
  /** The device's PKCS#8 private key, sealed with the Servers vault. */
  privateKey: SecretEnvelope;
  /** The current device session, renewed with a signature; not a secret on its own. */
  sessionId?: string;
}

export interface DeployStateFile {
  version: 1;
  cores: Record<string, DeployCoreRecord>;
  devices: Record<string, DeviceCredentials>;
}

export interface DeployStatePort {
  /** The parsed file, or null when there is none or it is not JSON. */
  read: () => Promise<unknown>;
  write: (value: DeployStateFile) => Promise<void>;
}

const TRANSPORTS: ReadonlySet<string> = new Set<DeployTransport>([
  'streamlocal',
  'bridge',
  'dev-tcp',
]);

function isRecord(value: unknown): value is DeployCoreRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === 'string' &&
    typeof record.release === 'string' &&
    typeof record.transport === 'string' &&
    TRANSPORTS.has(record.transport) &&
    typeof record.installedAt === 'number' &&
    typeof record.os === 'string' &&
    typeof record.architecture === 'string'
  );
}

function isEnvelope(value: unknown): value is SecretEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const envelope = value as Record<string, unknown>;
  if (typeof envelope.ciphertext !== 'string') return false;
  if (envelope.mode === 'safeStorage') return true;
  return (
    envelope.mode === 'passphrase' &&
    typeof envelope.iv === 'string' &&
    typeof envelope.authTag === 'string'
  );
}

function isDevice(value: unknown): value is DeviceCredentials {
  if (typeof value !== 'object' || value === null) return false;
  const device = value as Record<string, unknown>;
  return (
    typeof device.deviceId === 'string' &&
    typeof device.userName === 'string' &&
    isEnvelope(device.privateKey) &&
    (device.sessionId === undefined || typeof device.sessionId === 'string')
  );
}

function parse(value: unknown): DeployStateFile {
  const file = (value ?? {}) as { version?: unknown; cores?: unknown; devices?: unknown };
  const cores: Record<string, DeployCoreRecord> = {};
  const devices: Record<string, DeviceCredentials> = {};
  if (file.version === 1) {
    if (typeof file.cores === 'object' && file.cores !== null) {
      for (const [serverId, record] of Object.entries(file.cores)) {
        if (isRecord(record)) cores[serverId] = record;
      }
    }
    if (typeof file.devices === 'object' && file.devices !== null) {
      for (const [serverId, device] of Object.entries(file.devices)) {
        if (isDevice(device)) devices[serverId] = device;
      }
    }
  }
  return { version: 1, cores, devices };
}

export class DeployState {
  private queue: Promise<unknown> = Promise.resolve();

  /** Moves every sealed device key when the Servers passkey changes (see vault.ts). */
  readonly sealedKeys: SealedSecretStore = {
    prepare: async (move) => {
      const devices = (await this.read()).devices;
      const moved: Record<string, SecretEnvelope> = {};
      for (const [serverId, device] of Object.entries(devices)) {
        moved[serverId] = await move(device.privateKey);
      }
      return () =>
        this.update((file) => {
          const next = { ...file.devices };
          for (const [serverId, privateKey] of Object.entries(moved)) {
            const device = next[serverId];
            if (device) next[serverId] = { ...device, privateKey };
          }
          return { ...file, devices: next };
        });
    },
  };

  constructor(private readonly port: DeployStatePort) {}

  async all(): Promise<Record<string, DeployCoreRecord>> {
    return (await this.read()).cores;
  }

  async get(serverId: string): Promise<DeployCoreRecord | null> {
    return (await this.all())[serverId] ?? null;
  }

  set(serverId: string, record: DeployCoreRecord): Promise<void> {
    return this.update((file) => ({ ...file, cores: { ...file.cores, [serverId]: record } }));
  }

  /** Forgets the core, and this computer's device on it with it. */
  remove(serverId: string): Promise<void> {
    return this.update((file) => {
      const { [serverId]: _core, ...cores } = file.cores;
      const { [serverId]: _device, ...devices } = file.devices;
      return { ...file, cores, devices };
    });
  }

  /** Servers this computer has a device on. */
  async enrolledServers(): Promise<Set<string>> {
    return new Set(Object.keys((await this.read()).devices));
  }

  async device(serverId: string): Promise<DeviceCredentials | null> {
    return (await this.read()).devices[serverId] ?? null;
  }

  setDevice(serverId: string, device: DeviceCredentials): Promise<void> {
    return this.update((file) => ({ ...file, devices: { ...file.devices, [serverId]: device } }));
  }

  removeDevice(serverId: string): Promise<void> {
    return this.update((file) => {
      const { [serverId]: _device, ...devices } = file.devices;
      return { ...file, devices };
    });
  }

  private async read(): Promise<DeployStateFile> {
    await this.queue.catch(() => undefined);
    return parse(await this.port.read());
  }

  private update(change: (file: DeployStateFile) => DeployStateFile): Promise<void> {
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
export function jsonFilePort(path: string): DeployStatePort {
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
