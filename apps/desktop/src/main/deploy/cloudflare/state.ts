import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SecretEnvelope } from '../../../shared/apiTypes';
import type {
  CloudflarePermissionCheck,
  CloudflarePermissionId,
  CloudflareTokenReport,
} from '../../../shared/cloudflareTypes';
import type { SealedSecretStore } from '../../ssh/vault';

/**
 * The Cloudflare API token at rest, in cloudflare.json beside the other stores. The token itself
 * is only ever stored sealed with the Servers vault (safeStorage, or the passkey when one is set)
 * and never leaves the main process; the last permission check sits next to it in the clear,
 * since it holds nothing secret. Anything unreadable is dropped rather than trusted, and one
 * write queue keeps two changes from losing each other.
 */

export interface StoredCloudflareToken {
  envelope: SecretEnvelope;
  /** Cloudflare's id for the token, which is not a secret. */
  tokenId: string;
  savedAt: number;
}

export interface CloudflareStateFile {
  version: 1;
  token: StoredCloudflareToken | null;
  report: CloudflareTokenReport | null;
}

export interface CloudflareStatePort {
  /** The parsed file, or null when there is none or it is not JSON. */
  read: () => Promise<unknown>;
  write: (value: CloudflareStateFile) => Promise<void>;
}

const PERMISSION_IDS: ReadonlySet<string> = new Set<CloudflarePermissionId>([
  'zone',
  'dns',
  'zoneSettings',
  'cachePurge',
  'waf',
  'accessRules',
]);
const PERMISSION_STATES: ReadonlySet<string> = new Set(['granted', 'missing', 'unverified']);
const TOKEN_STATUSES: ReadonlySet<string> = new Set(['active', 'disabled', 'expired']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnvelope(value: unknown): value is SecretEnvelope {
  if (!isObject(value) || typeof value.ciphertext !== 'string') return false;
  if (value.mode === 'safeStorage') return true;
  return (
    value.mode === 'passphrase' && typeof value.iv === 'string' && typeof value.authTag === 'string'
  );
}

function isToken(value: unknown): value is StoredCloudflareToken {
  return (
    isObject(value) &&
    isEnvelope(value.envelope) &&
    typeof value.tokenId === 'string' &&
    typeof value.savedAt === 'number'
  );
}

function isCheck(value: unknown): value is CloudflarePermissionCheck {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    PERMISSION_IDS.has(value.id) &&
    typeof value.state === 'string' &&
    PERMISSION_STATES.has(value.state)
  );
}

function isReport(value: unknown): value is CloudflareTokenReport {
  return (
    isObject(value) &&
    typeof value.tokenId === 'string' &&
    typeof value.status === 'string' &&
    TOKEN_STATUSES.has(value.status) &&
    (value.expiresOn === null || typeof value.expiresOn === 'string') &&
    (value.source === 'policies' || value.source === 'probes') &&
    Array.isArray(value.permissions) &&
    value.permissions.every(isCheck) &&
    typeof value.zoneCount === 'number' &&
    typeof value.checkedAt === 'number'
  );
}

function parse(value: unknown): CloudflareStateFile {
  if (!isObject(value) || value.version !== 1) return { version: 1, token: null, report: null };
  return {
    version: 1,
    token: isToken(value.token) ? value.token : null,
    report: isReport(value.report) ? value.report : null,
  };
}

export class CloudflareState {
  private queue: Promise<unknown> = Promise.resolve();

  /** Moves the sealed token when the Servers passkey changes (see vault.ts). */
  readonly sealedKeys: SealedSecretStore = {
    prepare: async (move) => {
      const token = (await this.read()).token;
      if (!token) return async () => undefined;
      const envelope = await move(token.envelope);
      return () =>
        this.update((file) =>
          file.token ? { ...file, token: { ...file.token, envelope } } : file,
        );
    },
  };

  constructor(private readonly port: CloudflareStatePort) {}

  async token(): Promise<StoredCloudflareToken | null> {
    return (await this.read()).token;
  }

  async report(): Promise<CloudflareTokenReport | null> {
    return (await this.read()).report;
  }

  save(token: StoredCloudflareToken, report: CloudflareTokenReport): Promise<void> {
    return this.update(() => ({ version: 1, token, report }));
  }

  setReport(report: CloudflareTokenReport): Promise<void> {
    return this.update((file) => ({ ...file, report }));
  }

  /** Records that Cloudflare refused a change for want of this permission. */
  markMissing(permission: CloudflarePermissionId): Promise<void> {
    return this.update((file) => {
      if (!file.report) return file;
      const permissions = file.report.permissions.map((check) =>
        check.id === permission ? { ...check, state: 'missing' as const } : check,
      );
      return { ...file, report: { ...file.report, permissions } };
    });
  }

  clear(): Promise<void> {
    return this.update(() => ({ version: 1, token: null, report: null }));
  }

  private async read(): Promise<CloudflareStateFile> {
    await this.queue.catch(() => undefined);
    return parse(await this.port.read());
  }

  private update(change: (file: CloudflareStateFile) => CloudflareStateFile): Promise<void> {
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
export function cloudflareFilePort(path: string): CloudflareStatePort {
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
