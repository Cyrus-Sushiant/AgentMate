import { randomBytes } from 'node:crypto';
import { deriveKey } from '../crypto/aesGcm';

export interface KdfCost {
  N: number;
  r: number;
  p: number;
}

export interface VaultKdfParams extends KdfCost {
  name: 'scrypt';
  /** Base64 of 32 random bytes. */
  salt: string;
}

/**
 * About 64 MB and a few hundred milliseconds per unlock. Stronger than the backup cipher on
 * purpose: the vault file sits on disk for years.
 */
export const DEFAULT_VAULT_KDF_COST: KdfCost = { N: 2 ** 16, r: 8, p: 1 };

/** scrypt needs 128 * N * r bytes. Anything asking for more than this is refused outright. */
export const VAULT_KDF_MAXMEM = 128 * 1024 * 1024;

const isPowerOfTwo = (n: number) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

/**
 * Checked before scrypt ever runs, so a vault or backup file with made-up parameters can't make
 * the app allocate gigabytes or spin for minutes. The floor is low only so tests can run fast;
 * a weak file is upgraded to the default cost the first time it is unlocked.
 */
export function isKdfWithinBounds(kdf: VaultKdfParams): boolean {
  return (
    kdf.name === 'scrypt' &&
    isPowerOfTwo(kdf.N) &&
    kdf.N >= 2 ** 10 &&
    kdf.N <= 2 ** 20 &&
    Number.isInteger(kdf.r) &&
    kdf.r >= 1 &&
    kdf.r <= 32 &&
    Number.isInteger(kdf.p) &&
    kdf.p >= 1 &&
    kdf.p <= 16 &&
    128 * kdf.N * kdf.r <= VAULT_KDF_MAXMEM &&
    typeof kdf.salt === 'string' &&
    kdf.salt.length >= 16 &&
    kdf.salt.length <= 128
  );
}

export function isWeakerThan(kdf: KdfCost, cost: KdfCost): boolean {
  return kdf.N * kdf.r * kdf.p < cost.N * cost.r * cost.p;
}

export function newKdfParams(cost: KdfCost = DEFAULT_VAULT_KDF_COST): VaultKdfParams {
  return { name: 'scrypt', ...cost, salt: randomBytes(32).toString('base64') };
}

export function deriveVaultKey(password: string, kdf: VaultKdfParams): Promise<Buffer> {
  if (!isKdfWithinBounds(kdf)) {
    return Promise.reject(new Error('The vault key settings are out of range.'));
  }
  return deriveKey(password, kdf.salt, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: VAULT_KDF_MAXMEM });
}
