import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { StoredSshServer } from '../../shared/apiTypes';
import { useTempUserData } from '../../test/main/ipcHarness';

/**
 * Saved Remote servers as connection endpoints. Secrets are decrypted only here, in main, and
 * every write to ssh-servers.json goes through one queue so concurrent updates never lose each
 * other's changes.
 */

const userData = useTempUserData();

type Module = typeof import('./savedServers');
let saved: Module;
let vault: typeof import('./vault');

function server(overrides: Partial<StoredSshServer> = {}): StoredSshServer {
  return {
    id: 'srv-1',
    nickname: 'prod',
    host: 'prod.example',
    port: 22,
    username: 'deploy',
    authMethod: 'password',
    createdAt: 1,
    lastConnectedAt: null,
    ...overrides,
  };
}

function stored(): StoredSshServer[] {
  return JSON.parse(readFileSync(userData.dataFile('ssh-servers.json'), 'utf-8'));
}

beforeEach(async () => {
  saved = await import('./savedServers');
  vault = await import('./vault');
});

describe('savedServerEndpoint', () => {
  it('decrypts a saved login password', async () => {
    userData.writeData('ssh-servers.json', [
      server({
        secretEnvelope: await vault.encryptSecret('login pw'),
        hostKeyFingerprint: 'ab'.repeat(32),
      }),
    ]);

    expect(await saved.savedServerEndpoint('srv-1')).toEqual({
      host: 'prod.example',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'login pw',
      privateKeyPath: undefined,
      passphrase: undefined,
      storedFingerprint: 'ab'.repeat(32),
    });
  });

  it('treats the secret of a key login as the key passphrase', async () => {
    userData.writeData('ssh-servers.json', [
      server({
        authMethod: 'privateKey',
        privateKeyPath: '/home/me/.ssh/id_ed25519',
        secretEnvelope: await vault.encryptSecret('key passphrase'),
      }),
    ]);

    const endpoint = await saved.savedServerEndpoint('srv-1');

    expect(endpoint.passphrase).toBe('key passphrase');
    expect(endpoint.password).toBeUndefined();
    expect(endpoint.privateKeyPath).toBe('/home/me/.ssh/id_ed25519');
  });

  it('refuses a server that was removed', async () => {
    userData.writeData('ssh-servers.json', [server()]);

    await expect(saved.savedServerEndpoint('srv-gone')).rejects.toThrow(
      'This saved server no longer exists.',
    );
  });
});

describe('savedServerPoolSource', () => {
  it('stores a key trusted on first use', async () => {
    userData.writeData('ssh-servers.json', [server()]);

    await saved.savedServerPoolSource.trustHostKey('srv-1', 'cd'.repeat(32));

    expect(stored()[0].hostKeyFingerprint).toBe('cd'.repeat(32));
  });

  it('never replaces a key that was already trusted', async () => {
    userData.writeData('ssh-servers.json', [server({ hostKeyFingerprint: 'ab'.repeat(32) })]);

    await saved.savedServerPoolSource.trustHostKey('srv-1', 'cd'.repeat(32));

    expect(stored()[0].hostKeyFingerprint).toBe('ab'.repeat(32));
  });

  it('records when the server was last connected to', async () => {
    userData.writeData('ssh-servers.json', [server()]);

    saved.savedServerPoolSource.connected?.('srv-1');
    await saved.updateSshServer('srv-1', (s) => s);

    expect(stored()[0].lastConnectedAt).toEqual(expect.any(Number));
  });
});

describe('updateSshServer', () => {
  it('applies concurrent updates one after another so none is lost', async () => {
    userData.writeData('ssh-servers.json', [server()]);

    await Promise.all([
      saved.updateSshServer('srv-1', (s) => ({ ...s, hostKeyFingerprint: 'ab'.repeat(32) })),
      saved.updateSshServer('srv-1', (s) => ({ ...s, lastConnectedAt: 42 })),
    ]);

    expect(stored()[0]).toMatchObject({ hostKeyFingerprint: 'ab'.repeat(32), lastConnectedAt: 42 });
  });

  it('ignores a server that is no longer saved', async () => {
    userData.writeData('ssh-servers.json', [server()]);

    await saved.updateSshServer('srv-gone', (s) => ({ ...s, nickname: 'changed' }));

    expect(stored()).toEqual([server()]);
  });
});
