import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { safeStorage } from 'electron';
import type {
  PassphraseSecretEnvelope,
  SecretEnvelope,
  SshVaultStatus,
  StoredRdpServer,
  StoredSshServer,
} from '../../shared/apiTypes';
import { store } from '../store';

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
/** Encrypted under a just-derived key and stashed alongside the salt, so a wrong passkey is
 *  rejected right away instead of producing garbage the first time a server tries to connect. */
const VERIFIER_PLAINTEXT = 'agentmate-ssh-vault';

/** Cached for the running app session only; cleared on `before-quit`. Never persisted. */
let unlockedKey: Buffer | null = null;

async function deriveKey(passphrase: string, salt: string): Promise<Buffer> {
  return (await scrypt(passphrase, salt, KEY_LENGTH)) as Buffer;
}

function encryptWithKey(plaintext: string, key: Buffer): PassphraseSecretEnvelope {
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

function decryptWithKey(envelope: PassphraseSecretEnvelope, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf-8');
}

function verifyKey(key: Buffer, verifier: string): boolean {
  try {
    const envelope = JSON.parse(
      Buffer.from(verifier, 'base64').toString('utf-8'),
    ) as PassphraseSecretEnvelope;
    const plain = decryptWithKey(envelope, key);
    const actual = Buffer.from(plain, 'utf-8');
    const expected = Buffer.from(VERIFIER_PLAINTEXT, 'utf-8');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    // Wrong key: GCM auth-tag check fails before the string comparison is reached.
    return false;
  }
}

function makeVerifier(key: Buffer): string {
  const envelope = encryptWithKey(VERIFIER_PLAINTEXT, key);
  return Buffer.from(JSON.stringify(envelope), 'utf-8').toString('base64');
}

export async function getVaultStatus(): Promise<SshVaultStatus> {
  const vault = await store.getSshVault();
  return { hasPasskey: vault != null, unlocked: unlockedKey != null };
}

export async function unlockVault(passphrase: string): Promise<boolean> {
  const vault = await store.getSshVault();
  if (!vault) {
    unlockedKey = null;
    return true;
  }
  const key = await deriveKey(passphrase, vault.salt);
  if (!verifyKey(key, vault.verifier)) return false;
  unlockedKey = key;
  return true;
}

export function lockVault(): void {
  unlockedKey = null;
}

/**
 * Turns the optional Servers passkey on, off, or to a new value. Re-encrypts every saved
 * server's secret between safeStorage and passphrase-derived modes so nothing is left stuck
 * under a key nothing can reach anymore. Changing away from an existing passkey requires the
 * vault to already be unlocked, since decrypting the current secrets needs that key.
 */
export async function setPasskey(
  passphrase: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const currentVault = await store.getSshVault();
  if (currentVault && !unlockedKey) {
    return { ok: false, error: 'Unlock the current passkey first.' };
  }

  const salt = randomBytes(16).toString('base64');
  const nextKey = passphrase ? await deriveKey(passphrase, salt) : null;

  // SSH and Remote Desktop servers share the one passkey, so both lists move together.
  async function reencrypt<T extends { secretEnvelope?: SecretEnvelope }>(
    servers: T[],
  ): Promise<T[]> {
    return Promise.all(
      servers.map(async (server) => {
        if (!server.secretEnvelope) return server;
        const plaintext = await decryptSecret(server.secretEnvelope);
        const secretEnvelope = nextKey
          ? encryptWithKey(plaintext, nextKey)
          : await encryptWithSafeStorage(plaintext);
        return { ...server, secretEnvelope };
      }),
    );
  }

  let sshServers: StoredSshServer[];
  let rdpServers: StoredRdpServer[];
  try {
    sshServers = await reencrypt(await store.getSshServers());
    rdpServers = await reencrypt(await store.getRdpServers());
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  await store.setSshServers(sshServers);
  await store.setRdpServers(rdpServers);
  await store.setSshVault(nextKey ? { salt, verifier: makeVerifier(nextKey) } : null);
  unlockedKey = nextKey;
  return { ok: true };
}

async function encryptWithSafeStorage(plaintext: string): Promise<SecretEnvelope> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Secure storage is not available on this system. Set a Servers passkey to encrypt credentials.',
    );
  }
  return {
    mode: 'safeStorage',
    ciphertext: safeStorage.encryptString(plaintext).toString('base64'),
  };
}

/** Encrypts under the unlocked passkey if one is set, otherwise under safeStorage. */
export async function encryptSecret(plaintext: string): Promise<SecretEnvelope> {
  if (unlockedKey) return encryptWithKey(plaintext, unlockedKey);
  const vault = await store.getSshVault();
  if (vault) throw new Error('Servers vault is locked. Unlock it with your passkey first.');
  return encryptWithSafeStorage(plaintext);
}

export async function decryptSecret(envelope: SecretEnvelope): Promise<string> {
  if (envelope.mode === 'safeStorage') {
    return safeStorage.decryptString(Buffer.from(envelope.ciphertext, 'base64'));
  }
  if (!unlockedKey) throw new Error('Servers vault is locked. Unlock it with your passkey first.');
  return decryptWithKey(envelope, unlockedKey);
}
