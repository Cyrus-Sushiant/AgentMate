import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DeployCoreRecord, DeployTransport } from '../../shared/deployTypes';

/**
 * The app's record of the core it installed on each saved server, in `deploy.json` beside the
 * other stores. It only caches what the server can confirm again, so anything unreadable is
 * dropped rather than trusted. One write queue keeps two installs from losing each other's record.
 */

export interface DeployStateFile {
  version: 1;
  cores: Record<string, DeployCoreRecord>;
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

function parse(value: unknown): DeployStateFile {
  const file = (value ?? {}) as { version?: unknown; cores?: unknown };
  const cores: Record<string, DeployCoreRecord> = {};
  if (file.version === 1 && typeof file.cores === 'object' && file.cores !== null) {
    for (const [serverId, record] of Object.entries(file.cores)) {
      if (isRecord(record)) cores[serverId] = record;
    }
  }
  return { version: 1, cores };
}

export class DeployState {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly port: DeployStatePort) {}

  async all(): Promise<Record<string, DeployCoreRecord>> {
    await this.queue.catch(() => undefined);
    return parse(await this.port.read()).cores;
  }

  async get(serverId: string): Promise<DeployCoreRecord | null> {
    return (await this.all())[serverId] ?? null;
  }

  set(serverId: string, record: DeployCoreRecord): Promise<void> {
    return this.update((cores) => ({ ...cores, [serverId]: record }));
  }

  remove(serverId: string): Promise<void> {
    return this.update((cores) => {
      const { [serverId]: _removed, ...rest } = cores;
      return rest;
    });
  }

  private update(
    change: (cores: Record<string, DeployCoreRecord>) => Record<string, DeployCoreRecord>,
  ): Promise<void> {
    const next = this.queue
      .catch(() => undefined)
      .then(async () => {
        const current = parse(await this.port.read());
        await this.port.write({ version: 1, cores: change(current.cores) });
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
