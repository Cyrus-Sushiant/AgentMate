import { type RandomFill, randomInt } from '../../vault/generator.js';
import type { CatalogSecretSpec } from './types.js';

/**
 * The passwords and keys an app is installed with. Each install draws its own from the platform's
 * cryptographic random source (Web Crypto, which in Node is node:crypto's), so no two installs
 * share one and no template ships a default.
 *
 * Generated passwords use letters and digits only. They go into connection strings, URLs, shell
 * healthchecks and .env files, and none of those need escaping for them. A password someone types
 * in instead may also use `.`, `_`, `~` and `-`, the other characters a URL leaves alone.
 */

export const CATALOG_PASSWORD_MIN_LENGTH = 16;
export const CATALOG_PASSWORD_MAX_LENGTH = 128;
/** Bytes. 16 bytes is 128 bits, the least any key here gets. */
export const CATALOG_KEY_MIN_BYTES = 16;
export const CATALOG_KEY_MAX_BYTES = 64;

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const GENERATED = LOWER + UPPER + DIGITS;
const ACCEPTED = /^[A-Za-z0-9._~-]*$/;

const platformRandom: RandomFill = (array) => globalThis.crypto.getRandomValues(array);

function specProblem(spec: CatalogSecretSpec): string | null {
  const [min, max] =
    spec.kind === 'password'
      ? [CATALOG_PASSWORD_MIN_LENGTH, CATALOG_PASSWORD_MAX_LENGTH]
      : [CATALOG_KEY_MIN_BYTES, CATALOG_KEY_MAX_BYTES];
  return Number.isInteger(spec.length) && spec.length >= min && spec.length <= max
    ? null
    : `${spec.key} needs a length from ${min} to ${max}, not ${spec.length}.`;
}

/** One fresh value for the spec. */
export function generateCatalogSecret(
  spec: CatalogSecretSpec,
  rng: RandomFill = platformRandom,
): string {
  const problem = specProblem(spec);
  if (problem) throw new RangeError(problem);
  if (spec.kind === 'hex') {
    let hex = '';
    for (let i = 0; i < spec.length; i++) hex += randomInt(256, rng).toString(16).padStart(2, '0');
    return hex;
  }
  // One of each class, the rest from all of them, then shuffled so the three are not up front.
  const chars = [LOWER, UPPER, DIGITS].map((set) => set[randomInt(set.length, rng)]);
  while (chars.length < spec.length) chars.push(GENERATED[randomInt(GENERATED.length, rng)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** A fresh value for every spec, by env key. */
export function generateCatalogSecrets(
  specs: readonly CatalogSecretSpec[],
  rng: RandomFill = platformRandom,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const spec of specs) values[spec.key] = generateCatalogSecret(spec, rng);
  return values;
}

/**
 * Why a value cannot be used for the spec, or null when it can. The reason never repeats the
 * value, so it is safe to show and to log.
 */
export function checkCatalogSecret(spec: CatalogSecretSpec, value: string): string | null {
  if (typeof value !== 'string' || value.length === 0) return `Enter a value for ${spec.label}.`;
  if (spec.kind === 'hex') {
    const chars = spec.length * 2;
    return value.length === chars && /^[0-9a-fA-F]+$/.test(value)
      ? null
      : `${spec.label} must be ${chars} hex characters (0-9 and a-f).`;
  }
  if (value.length < CATALOG_PASSWORD_MIN_LENGTH) {
    return `${spec.label} must be at least ${CATALOG_PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (value.length > CATALOG_PASSWORD_MAX_LENGTH) {
    return `${spec.label} can be at most ${CATALOG_PASSWORD_MAX_LENGTH} characters long.`;
  }
  if (!ACCEPTED.test(value)) {
    return `${spec.label} can use letters, digits and . _ ~ - only, so it works in connection strings and URLs.`;
  }
  if (!/[a-z]/.test(value)) return `${spec.label} needs at least one lowercase letter.`;
  if (!/[A-Z]/.test(value)) return `${spec.label} needs at least one capital letter.`;
  if (!/[0-9]/.test(value)) return `${spec.label} needs at least one digit.`;
  return null;
}
