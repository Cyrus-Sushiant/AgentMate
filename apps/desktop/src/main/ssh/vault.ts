import { randomBytes, timingSafeEqual } from 'node:crypto';
import { safeStorage } from 'electron';
import type {
  PassphraseSecretEnvelope,
  SecretEnvelope,
  SshVaultStatus,
  StoredProjectEnvironment,
  StoredRdpServer,
  StoredSshServer,
} from '../../shared/apiTypes';
import { decryptWithKey, deriveKey, encryptWithKey } from '../crypto/aesGcm';
import { store } from '../store';

/** Encrypted under a just-derived key and stashed alongside the salt, so a wrong passkey is
 *  rejected right away instead of producing garbage the first time a server tries to connect. */
const VERIFIER_PLAINTEXT = 'agentmate-ssh-vault';

const LOCKED_MESSAGE = 'The vault is locked. Unlock it with your passkey first.';

/** Cached for the running app session only; cleared on `before-quit`. Never persisted. */
let unlockedKey: Buffer | null = null;

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

  async function move(envelope: SecretEnvelope): Promise<SecretEnvelope>;
  async function move(envelope: SecretEnvelope | undefined): Promise<SecretEnvelope | undefined>;
  async function move(envelope: SecretEnvelope | undefined): Promise<SecretEnvelope | undefined> {
    if (!envelope) return undefined;
    const plaintext = await decryptSecret(envelope);
    return nextKey ? encryptWithKey(plaintext, nextKey) : encryptWithSafeStorage(plaintext);
  }

  // SSH servers, Remote Desktop servers and project environments share the one passkey, so
  // every list moves together.
  async function reencrypt<T extends { secretEnvelope?: SecretEnvelope }>(
    servers: T[],
  ): Promise<T[]> {
    return Promise.all(
      servers.map(async (server) =>
        server.secretEnvelope
          ? { ...server, secretEnvelope: await move(server.secretEnvelope) }
          : server,
      ),
    );
  }

  let sshServers: StoredSshServer[];
  let rdpServers: StoredRdpServer[];
  let environments: StoredProjectEnvironment[];
  try {
    sshServers = await reencrypt(await store.getSshServers());
    rdpServers = await reencrypt(await store.getRdpServers());
    environments = await Promise.all(
      (await store.getProjectEnvironments()).map(async (environment) => ({
        ...environment,
        files: await Promise.all(
          environment.files.map(async (file) => ({
            ...file,
            contentEnvelope: await move(file.contentEnvelope),
          })),
        ),
        credentials: await Promise.all(
          environment.credentials.map(async (credential) => ({
            ...credential,
            secretEnvelope: await move(credential.secretEnvelope),
            notesEnvelope: await move(credential.notesEnvelope),
          })),
        ),
      })),
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  await store.setSshServers(sshServers);
  await store.setRdpServers(rdpServers);
  await store.setProjectEnvironments(environments);
  await store.setSshVault(nextKey ? { salt, verifier: makeVerifier(nextKey) } : null);
  unlockedKey = nextKey;
  return { ok: true };
}

function encryptWithSafeStorage(plaintext: string): SecretEnvelope {
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
  if (vault) throw new Error(LOCKED_MESSAGE);
  return encryptWithSafeStorage(plaintext);
}

/** Whether reading this secret needs the passkey, which is locked right now. */
export function isLockedEnvelope(envelope: SecretEnvelope | undefined): boolean {
  return envelope?.mode === 'passphrase' && unlockedKey == null;
}

export async function decryptSecret(envelope: SecretEnvelope): Promise<string> {
  if (envelope.mode === 'safeStorage') {
    return safeStorage.decryptString(Buffer.from(envelope.ciphertext, 'base64'));
  }
  if (!unlockedKey) throw new Error(LOCKED_MESSAGE);
  return decryptWithKey(envelope, unlockedKey);
}
