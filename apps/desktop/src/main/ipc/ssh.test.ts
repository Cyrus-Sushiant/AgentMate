import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StoredSshServer } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import type { SshHostKeyStatus } from '../../shared/sshHostKey';
import { invoke, loadIpc, useTempUserData } from '../../test/main/ipcHarness';
import { type FakeSshServer, startFakeSshServer } from '../ssh/testing/fakeSshServer';

/**
 * Trusting a changed host key is a security decision, so it is explicit: the renderer shows both
 * fingerprints and only then trusts the key, and main re-reads the key before storing it, so it
 * can never store a key the user did not see.
 */

const userData = useTempUserData();
let server: FakeSshServer;

function saved(overrides: Partial<StoredSshServer> = {}): StoredSshServer {
  return {
    id: 'srv-1',
    nickname: 'prod',
    host: server.host,
    port: server.port,
    username: 'deploy',
    authMethod: 'password',
    createdAt: 1,
    lastConnectedAt: null,
    ...overrides,
  };
}

function storedServers(): StoredSshServer[] {
  return JSON.parse(readFileSync(userData.dataFile('ssh-servers.json'), 'utf-8'));
}

beforeEach(async () => {
  server = await startFakeSshServer();
  await loadIpc(
    () => import('./ssh'),
    (module) => module.registerSshHandlers(),
  );
});

afterEach(async () => {
  await server.close();
});

describe('ssh:hostKeyStatus', () => {
  it('reports the stored key and the key the server presents now', async () => {
    userData.writeData('ssh-servers.json', [saved({ hostKeyFingerprint: 'ab'.repeat(32) })]);

    const status = (await invoke(IPC.ssh.hostKeyStatus, 'srv-1')) as SshHostKeyStatus;

    expect(status).toEqual({
      serverId: 'srv-1',
      nickname: 'prod',
      host: server.host,
      port: server.port,
      stored: 'ab'.repeat(32),
      presented: server.fingerprint(),
    });
  });

  it('reports no stored key for a server never connected to', async () => {
    userData.writeData('ssh-servers.json', [saved()]);

    const status = (await invoke(IPC.ssh.hostKeyStatus, 'srv-1')) as SshHostKeyStatus;

    expect(status.stored).toBeNull();
  });

  it('refuses a server id it does not know', async () => {
    userData.writeData('ssh-servers.json', [saved()]);

    await expect(invoke(IPC.ssh.hostKeyStatus, 'srv-gone')).rejects.toThrow(
      'This saved server no longer exists.',
    );
  });
});

describe('ssh:trustHostKey', () => {
  it('stores the key the server presents', async () => {
    userData.writeData('ssh-servers.json', [saved({ hostKeyFingerprint: 'ab'.repeat(32) })]);

    await invoke(IPC.ssh.trustHostKey, 'srv-1', server.fingerprint());

    expect(storedServers()[0].hostKeyFingerprint).toBe(server.fingerprint());
  });

  it('refuses a key the server no longer presents', async () => {
    userData.writeData('ssh-servers.json', [saved({ hostKeyFingerprint: 'ab'.repeat(32) })]);
    const seen = server.fingerprint();
    await server.rotateHostKey();

    await expect(invoke(IPC.ssh.trustHostKey, 'srv-1', seen)).rejects.toThrow(
      /presented a different key/,
    );
    expect(storedServers()[0].hostKeyFingerprint).toBe('ab'.repeat(32));
  });

  it.each([['not-a-fingerprint'], [42], [null]])('refuses %j as a fingerprint', async (value) => {
    userData.writeData('ssh-servers.json', [saved()]);

    await expect(invoke(IPC.ssh.trustHostKey, 'srv-1', value)).rejects.toThrow(
      /not a host key fingerprint/,
    );
  });
});

describe('ssh:saveServer and the trusted key', () => {
  it('keeps the trusted key when the address stays the same', async () => {
    userData.writeData('ssh-servers.json', [saved({ hostKeyFingerprint: 'ab'.repeat(32) })]);

    await invoke(IPC.ssh.saveServer, {
      id: 'srv-1',
      nickname: 'renamed',
      host: server.host,
      port: server.port,
      username: 'deploy',
      authMethod: 'password',
    });

    expect(storedServers()[0].hostKeyFingerprint).toBe('ab'.repeat(32));
  });

  it('forgets the trusted key when the address changes', async () => {
    userData.writeData('ssh-servers.json', [saved({ hostKeyFingerprint: 'ab'.repeat(32) })]);

    await invoke(IPC.ssh.saveServer, {
      id: 'srv-1',
      nickname: 'prod',
      host: 'other.example',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
    });

    expect(storedServers()[0].hostKeyFingerprint).toBeUndefined();
  });
});
