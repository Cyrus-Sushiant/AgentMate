import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import type { DeployServerRegistries } from '../deploy/registry/serverCredentials';
import type { DeployRegistries } from '../deploy/registry/service';
import { registerDeployRegistryHandlers } from './deployRegistry';

/**
 * The registries' channels answer only the main window and check every argument (secrets
 * included) before the main process seals or sends anything.
 */

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const SERVER = 'srv-1';
const STACK = '0f8fad5b-d9cb-469f-a165-70867728950e';
const CREDENTIAL = '1f8fad5b-d9cb-469f-a165-70867728950e';

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const fake = (names: string[]) =>
    Object.fromEntries(names.map((name) => [name, vi.fn(async () => ({ ok: name }))])) as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
  const registries = fake([
    'list',
    'checkGithubToken',
    'saveGithubToken',
    'githubCliStatus',
    'saveGithubCli',
    'saveCredential',
    'remove',
    'setSendSignIns',
  ]);
  const servers = fake(['list', 'save', 'remove']);
  const plan = vi.fn(async () => ({ sendSignIns: true, entries: [] }));
  registerDeployRegistryHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    registries: registries as unknown as DeployRegistries,
    servers: servers as unknown as DeployServerRegistries,
    plan,
    guard: () => trusted,
  });
  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { handlers, registries, servers, plan, call };
}

describe('registerDeployRegistryHandlers', () => {
  it('handles every channel of the group', () => {
    const { handlers } = harness();
    expect([...handlers.keys()].sort()).toEqual(Object.values(IPC.deployRegistry).sort());
  });

  it('answers only the main window', async () => {
    const { call, registries } = harness(false);
    await expect(call(IPC.deployRegistry.saveGithubToken, { token: 'x' })).rejects.toThrow(
      'Deploy is only available in the main window.',
    );
    expect(registries.saveGithubToken).not.toHaveBeenCalled();
  });

  it('passes checked arguments through', async () => {
    const { call, registries, servers, plan } = harness();

    await call(IPC.deployRegistry.list);
    await call(IPC.deployRegistry.checkGithubToken, '  ghp_token  ');
    await call(IPC.deployRegistry.saveGithubToken, {
      token: 'ghp_token',
      acceptBroaderScopes: false,
    });
    await call(IPC.deployRegistry.githubCliStatus);
    await call(IPC.deployRegistry.saveGithubCli, { acceptBroaderScopes: true });
    await call(IPC.deployRegistry.saveCredential, {
      kind: 'custom',
      registry: 'Registry.Example.com:5000',
      username: 'ci',
      secret: 'pass-word',
    });
    await call(IPC.deployRegistry.saveCredential, {
      kind: 'dockerhub',
      registry: 'ignored',
      username: 'hubber',
      secret: 'dckr_pat',
    });
    await call(IPC.deployRegistry.remove, CREDENTIAL);
    await call(IPC.deployRegistry.setAppChoice, {
      serverId: SERVER,
      stackId: STACK,
      sendSignIns: false,
    });
    await call(IPC.deployRegistry.plan, { serverId: SERVER, stackId: STACK, revision: 2 });
    await call(IPC.deployRegistry.plan, {
      serverId: SERVER,
      images: ['ghcr.io/acme/web:1', 'not an image', 3],
    });
    await call(IPC.deployRegistry.serverList, SERVER);
    await call(IPC.deployRegistry.serverSave, {
      serverId: SERVER,
      registry: 'ghcr.io',
      username: 'octocat',
      secret: 'ghp_token',
      password: 'pw',
    });
    await call(IPC.deployRegistry.serverSave, {
      serverId: SERVER,
      credentialId: CREDENTIAL,
      totpCode: '123456',
    });
    await call(IPC.deployRegistry.serverRemove, { serverId: SERVER, credentialId: CREDENTIAL });

    expect(registries.checkGithubToken).toHaveBeenCalledWith('ghp_token');
    expect(registries.saveGithubToken).toHaveBeenCalledWith({
      token: 'ghp_token',
      acceptBroaderScopes: false,
    });
    expect(registries.saveGithubCli).toHaveBeenCalledWith({ acceptBroaderScopes: true });
    expect(registries.saveCredential).toHaveBeenNthCalledWith(1, {
      kind: 'custom',
      registry: 'registry.example.com:5000',
      username: 'ci',
      secret: 'pass-word',
    });
    expect(registries.saveCredential).toHaveBeenNthCalledWith(2, {
      kind: 'dockerhub',
      username: 'hubber',
      secret: 'dckr_pat',
    });
    expect(registries.setSendSignIns).toHaveBeenCalledWith(SERVER, STACK, false);
    expect(plan).toHaveBeenNthCalledWith(1, {
      serverId: SERVER,
      stackId: STACK,
      revision: 2,
      images: null,
    });
    expect(plan).toHaveBeenNthCalledWith(2, {
      serverId: SERVER,
      stackId: null,
      revision: null,
      images: ['ghcr.io/acme/web:1'],
    });
    expect(servers.save).toHaveBeenNthCalledWith(1, {
      serverId: SERVER,
      registry: 'ghcr.io',
      username: 'octocat',
      secret: 'ghp_token',
      password: 'pw',
    });
    expect(servers.save).toHaveBeenNthCalledWith(2, {
      serverId: SERVER,
      credentialId: CREDENTIAL,
      totpCode: '123456',
    });
    expect(servers.remove).toHaveBeenCalledWith({ serverId: SERVER, credentialId: CREDENTIAL });
  });

  it('refuses arguments that are not what they claim', async () => {
    const { call, registries, servers, plan } = harness();

    await expect(call(IPC.deployRegistry.checkGithubToken, '')).rejects.toThrow(/token/);
    await expect(call(IPC.deployRegistry.checkGithubToken, 'x'.repeat(2000))).rejects.toThrow();
    await expect(
      call(IPC.deployRegistry.saveGithubToken, { token: 'ghp', acceptBroaderScopes: 'yes' }),
    ).rejects.toThrow(/broader scopes/);
    await expect(
      call(IPC.deployRegistry.saveCredential, { kind: 'github', username: 'u', secret: 'pass' }),
    ).rejects.toThrow(/Docker Hub or a custom/);
    await expect(
      call(IPC.deployRegistry.saveCredential, {
        kind: 'custom',
        registry: 'ghcr.io/org',
        username: 'u',
        secret: 'pass',
      }),
    ).rejects.toThrow(/registry host/);
    await expect(call(IPC.deployRegistry.remove, '../etc')).rejects.toThrow(/saved sign-in/);
    await expect(
      call(IPC.deployRegistry.setAppChoice, {
        serverId: SERVER,
        stackId: 'app',
        sendSignIns: true,
      }),
    ).rejects.toThrow(/an app/);
    await expect(call(IPC.deployRegistry.plan, { serverId: SERVER })).rejects.toThrow(/revision/);
    await expect(
      call(IPC.deployRegistry.plan, { serverId: SERVER, stackId: STACK, revision: 0 }),
    ).rejects.toThrow(/whole number/);
    await expect(call(IPC.deployRegistry.serverList, 'bad id!')).rejects.toThrow(/saved server/);
    await expect(
      call(IPC.deployRegistry.serverSave, { serverId: SERVER, credentialId: 'nope' }),
    ).rejects.toThrow(/saved sign-in/);

    expect(registries.saveCredential).not.toHaveBeenCalled();
    expect(servers.save).not.toHaveBeenCalled();
    expect(plan).not.toHaveBeenCalled();
  });
});
