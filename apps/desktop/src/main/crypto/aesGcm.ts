import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type ScryptOptions,
  scrypt as scryptCallback,
} from 'node:crypto';
import type { PassphraseSecretEnvelope } from '../../shared/apiTypes';

const KEY_LENGTH = 32;
const IV_LENGTH = 12;

function scrypt(passphrase: string, salt: string, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(passphrase, salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** An AES-256 key from a passphrase. `options` defaults to Node's scrypt cost (N = 16384). */
export function deriveKey(
  passphrase: string,
  salt: string,
  options: ScryptOptions = {},
): Promise<Buffer> {
  return scrypt(passphrase, salt, options);
}

export function encryptWithKey(plaintext: string, key: Buffer): PassphraseSecretEnvelope {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return {
    mode: 'passphrase',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/** Throws when the key is wrong or the data was changed, since the GCM auth tag won't match. */
export function decryptWithKey(envelope: PassphraseSecretEnvelope, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf-8');
}
