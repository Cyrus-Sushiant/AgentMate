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
 * The Cloudflare accounts at rest, in cloudflare.json beside the other stores. Each account is a
 * name the user gave it plus its API token. A token is only ever stored sealed with the Servers
 * vault (safeStorage, or the passkey when one is set) and never leaves the main process; the last
 * permission check sits next to it in the clear, since it holds nothing secret. Anything
 * unreadable is dropped rather than trusted, and one write queue keeps two changes from losing
 * each other. The first version of the file held a single token; it is read as one account.
 */

export interface StoredCloudflareToken {
  envelope: SecretEnvelope;
  /** Cloudflare's id for the token, which is not a secret. */
  tokenId: string;
  savedAt: number;
}

export interface StoredCloudflareAccount {
  id: string;
  label: string;
  token: StoredCloudflareToken;
  report: CloudflareTokenReport | null;
}

export interface CloudflareStateFile {
  version: 2;
  accounts: StoredCloudflareAccount[];
}

export interface CloudflareStatePort {
  /** The parsed file, or null when there is none or it is not JSON. */
  read: () => Promise<unknown>;
  write: (value: CloudflareStateFile) => Promise<void>;
}

/** The id and name the single token of the first file version gets when read as an account. */
export const MIGRATED_ACCOUNT_ID = 'primary';
export const MIGRATED_ACCOUNT_LABEL = 'Cloudflare';

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

function toAccount(value: unknown): StoredCloudflareAccount | null {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    value.id === '' ||
    typeof value.label !== 'string' ||
    !isToken(value.token)
  ) {
    return null;
  }
  return {
    id: value.id,
    label: value.label,
    token: value.token,
    report: isReport(value.report) ? value.report : null,
  };
}

function parse(value: unknown): CloudflareStateFile {
  if (!isObject(value)) return { version: 2, accounts: [] };
  if (value.version === 1) {
    return {
      version: 2,
      accounts: isToken(value.token)
        ? [
            {
              id: MIGRATED_ACCOUNT_ID,
              label: MIGRATED_ACCOUNT_LABEL,
              token: value.token,
              report: isReport(value.report) ? value.report : null,
            },
          ]
        : [],
    };
  }
  if (value.version !== 2 || !Array.isArray(value.accounts)) return { version: 2, accounts: [] };
  const seen = new Set<string>();
  const accounts: StoredCloudflareAccount[] = [];
  for (const raw of value.accounts) {
    const account = toAccount(raw);
    if (account && !seen.has(account.id)) {
      seen.add(account.id);
      accounts.push(account);
    }
  }
  return { version: 2, accounts };
}

export class CloudflareState {
  private queue: Promise<unknown> = Promise.resolve();

  /** Moves every sealed token when the Servers passkey changes (see vault.ts). */
  readonly sealedKeys: SealedSecretStore = {
    prepare: async (move) => {
      const accounts = (await this.read()).accounts;
      if (accounts.length === 0) return async () => undefined;
      const moved = new Map<string, SecretEnvelope>();
      for (const account of accounts) moved.set(account.id, await move(account.token.envelope));
      return () =>
        this.update((file) => ({
          ...file,
          accounts: file.accounts.map((account) => {
            const envelope = moved.get(account.id);
            return envelope ? { ...account, token: { ...account.token, envelope } } : account;
          }),
        }));
    },
  };

  constructor(private readonly port: CloudflareStatePort) {}

  async accounts(): Promise<StoredCloudflareAccount[]> {
    return (await this.read()).accounts;
  }

  async account(id: string): Promise<StoredCloudflareAccount | null> {
    return (await this.read()).accounts.find((account) => account.id === id) ?? null;
  }

  /** Adds an account, or replaces the account with the same id. */
  save(account: StoredCloudflareAccount): Promise<void> {
    return this.update((file) => ({
      ...file,
      accounts: file.accounts.some((item) => item.id === account.id)
        ? file.accounts.map((item) => (item.id === account.id ? account : item))
        : [...file.accounts, account],
    }));
  }

  setReport(id: string, report: CloudflareTokenReport): Promise<void> {
    return this.change(id, (account) => ({ ...account, report }));
  }

  /** Records that Cloudflare refused a change for want of this permission. */
  markMissing(id: string, permission: CloudflarePermissionId): Promise<void> {
    return this.change(id, (account) => {
      if (!account.report) return account;
      const permissions = account.report.permissions.map((check) =>
        check.id === permission ? { ...check, state: 'missing' as const } : check,
      );
      return { ...account, report: { ...account.report, permissions } };
    });
  }

  remove(id: string): Promise<void> {
    return this.update((file) => ({
      ...file,
      accounts: file.accounts.filter((account) => account.id !== id),
    }));
  }

  private change(
    id: string,
    edit: (account: StoredCloudflareAccount) => StoredCloudflareAccount,
  ): Promise<void> {
    return this.update((file) => ({
      ...file,
      accounts: file.accounts.map((account) => (account.id === id ? edit(account) : account)),
    }));
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
