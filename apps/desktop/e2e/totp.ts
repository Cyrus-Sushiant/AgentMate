import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * The code an authenticator app shows for a base32 key (RFC 6238: SHA-1, 30-second steps, six
 * digits), `stepsAway` steps from now. The core checks it with its own implementation, which is
 * pinned to the RFC's test vectors.
 */
export function totpCode(base32Key: string, stepsAway = 0, now = Date.now()): string {
  let bits = '';
  for (const character of base32Key.replace(/[\s=]/g, '').toUpperCase()) {
    const value = BASE32.indexOf(character);
    if (value < 0) throw new Error(`Not a base32 key: ${base32Key}`);
    bits += value.toString(2).padStart(5, '0');
  }
  const secret = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000) + stepsAway));
  const hash = createHmac('sha1', secret).update(counter).digest();
  const offset = (hash.at(-1) ?? 0) & 0x0f;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
