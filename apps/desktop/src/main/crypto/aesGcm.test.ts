import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptWithKey, encryptWithKey } from './aesGcm';

describe('aesGcm', () => {
  const key = randomBytes(32);

  it('round-trips text and uses a fresh IV every time', () => {
    const first = encryptWithKey('hello', key);
    const second = encryptWithKey('hello', key);
    expect(first.iv).not.toBe(second.iv);
    expect(decryptWithKey(first, key)).toBe('hello');
  });

  it('rejects a wrong key', () => {
    const envelope = encryptWithKey('hello', key);
    expect(() => decryptWithKey(envelope, randomBytes(32))).toThrow();
  });

  it('binds additional authenticated data when given', () => {
    const aad = Buffer.from('header-v1');
    const envelope = encryptWithKey('hello', key, aad);
    expect(decryptWithKey(envelope, key, aad)).toBe('hello');
    expect(() => decryptWithKey(envelope, key, Buffer.from('header-v2'))).toThrow();
    expect(() => decryptWithKey(envelope, key)).toThrow();
  });

  it('still opens envelopes written without AAD, so existing callers keep working', () => {
    const envelope = encryptWithKey('legacy', key);
    expect(decryptWithKey(envelope, key)).toBe('legacy');
  });
});
