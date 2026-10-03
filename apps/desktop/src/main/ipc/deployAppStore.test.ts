import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import type { DeployAppStore } from '../deploy/appStore/service';
import { registerDeployAppStoreHandlers } from './deployAppStore';

/** The App Store's channels answer only the main window and check every argument first. */

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const SERVER = 'srv-1';
const STACK = '0f8fad5b-d9cb-469f-a165-70867728950e';
const INSTALL = {
  serverId: SERVER,
  templateId: 'redis',
  version: '8.10',
  name: 'cache',
  params: { port: 6379, appendOnly: true, note: 'text' },
  secrets: { REDIS_PASSWORD: 'Abcdefgh12345678' },
  domain: '',
};

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const store = {
    install: vi.fn(async () => ({ ok: 'install' })),
    update: vi.fn(async () => ({ ok: 'update' })),
    revealSecrets: vi.fn(async () => ({})),
  };
  registerDeployAppStoreHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    store: store as unknown as DeployAppStore,
    guard: () => trusted,
  });
  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { handlers, store, call };
}

describe('registerDeployAppStoreHandlers', () => {
  it('handles every channel of the group', () => {
    expect([...harness().handlers.keys()].sort()).toEqual(Object.values(IPC.deployAppStore).sort());
  });

  it('answers only the main window', async () => {
    const { call, store } = harness(false);
    await expect(call(IPC.deployAppStore.install, INSTALL)).rejects.toThrow(
      'Deploy is only available in the main window.',
    );
    expect(store.install).not.toHaveBeenCalled();
  });

  it('passes checked arguments through, an empty domain as none', async () => {
    const { call, store } = harness();
    await call(IPC.deployAppStore.install, INSTALL);
    expect(store.install).toHaveBeenCalledWith({ ...INSTALL, domain: null });
    await call(IPC.deployAppStore.update, { serverId: SERVER, stackId: STACK, version: '18' });
    expect(store.update).toHaveBeenCalledWith({ serverId: SERVER, stackId: STACK, version: '18' });
    await call(IPC.deployAppStore.revealSecrets, {
      serverId: SERVER,
      stackId: STACK,
      revision: 2,
      password: 'hunter2hunter2',
    });
    expect(store.revealSecrets).toHaveBeenCalledWith({
      serverId: SERVER,
      stackId: STACK,
      revision: 2,
      password: 'hunter2hunter2',
    });
  });

  it('refuses what does not fit, without repeating a secret', async () => {
    const { call, store } = harness();
    const refused: Array<[string, unknown, string]> = [
      [IPC.deployAppStore.install, { ...INSTALL, templateId: '../x' }, 'not an app from'],
      [IPC.deployAppStore.install, { ...INSTALL, version: '' }, 'Pick a version.'],
      [IPC.deployAppStore.install, { ...INSTALL, name: '' }, 'Give the app a name'],
      [IPC.deployAppStore.install, { ...INSTALL, params: { port: {} } }, 'The setting port'],
      [IPC.deployAppStore.install, { ...INSTALL, params: { 'bad key': 1 } }, 'not one'],
      [
        IPC.deployAppStore.install,
        { ...INSTALL, secrets: { REDIS_PASSWORD: 'x'.repeat(300) } },
        'The value for REDIS_PASSWORD',
      ],
      [IPC.deployAppStore.install, { ...INSTALL, domain: 42 }, 'Enter a domain name.'],
      [
        IPC.deployAppStore.update,
        { serverId: SERVER, stackId: 'nope', version: '1' },
        'not an app',
      ],
      [
        IPC.deployAppStore.revealSecrets,
        { serverId: SERVER, stackId: STACK, revision: 0 },
        'A revision is a whole number',
      ],
    ];
    for (const [channel, value, message] of refused) {
      const error = await (call(channel, value) as Promise<unknown>).catch(
        (caught: unknown) => caught,
      );
      expect(String(error), channel).toContain(message);
      expect(String(error)).not.toContain('x'.repeat(300));
    }
    expect(store.install).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
    expect(store.revealSecrets).not.toHaveBeenCalled();
  });
});
