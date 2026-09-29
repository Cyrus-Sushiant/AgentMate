import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import type { DeployService } from '../deploy/service';
import { registerDeployHandlers } from './deploy';

/**
 * The Deploy channels only answer the app's main window (a browser tab or widget sharing the
 * preload gets an error), and every argument is checked before it reaches the service.
 */

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const service = {
    listServers: vi.fn(async () => []),
    preflight: vi.fn(async () => ({})),
    install: vi.fn(async () => ({ version: '1.53.0' })),
    uninstall: vi.fn(async () => undefined),
    health: vi.fn(async () => ({ version: '1.53.0' })),
  };
  registerDeployHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    service: service as unknown as DeployService,
    guard: () => trusted,
  });
  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { service, call, handlers };
}

describe('registerDeployHandlers', () => {
  it('handles every invoke channel in the deploy group', () => {
    const { handlers } = harness();
    const invokes = Object.entries(IPC.deploy)
      .filter(([name]) => !name.startsWith('on'))
      .map(([, channel]) => channel);

    expect([...handlers.keys()].sort()).toEqual(invokes.sort());
  });

  it('passes checked arguments through to the service', async () => {
    const { service, call } = harness();

    await call(IPC.deploy.listServers);
    await call(IPC.deploy.preflight, 'srv-1');
    await call(IPC.deploy.install, { serverId: 'srv-1', sudoPassword: 'pw' });
    await call(IPC.deploy.uninstall, { serverId: 'srv-1', sudoPassword: null, keepData: true });
    await call(IPC.deploy.health, 'srv-1');

    expect(service.listServers).toHaveBeenCalled();
    expect(service.preflight).toHaveBeenCalledWith('srv-1');
    expect(service.install).toHaveBeenCalledWith({ serverId: 'srv-1', sudoPassword: 'pw' });
    expect(service.uninstall).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: null,
      keepData: true,
    });
    expect(service.health).toHaveBeenCalledWith('srv-1');
  });

  it('answers only the main window', async () => {
    const { service, call } = harness(false);

    await expect(call(IPC.deploy.listServers)).rejects.toThrow(/main window/);
    await expect(
      call(IPC.deploy.install, { serverId: 'srv-1', sudoPassword: 'pw' }),
    ).rejects.toThrow(/main window/);
    expect(service.listServers).not.toHaveBeenCalled();
    expect(service.install).not.toHaveBeenCalled();
  });

  it('refuses arguments that are not what the channel takes', async () => {
    const { service, call } = harness();

    for (const serverId of [42, '', 'x'.repeat(200), '../etc', null]) {
      await expect(call(IPC.deploy.health, serverId)).rejects.toThrow(/server/);
    }
    await expect(call(IPC.deploy.install, { serverId: 'srv-1', sudoPassword: 7 })).rejects.toThrow(
      /password/,
    );
    await expect(
      call(IPC.deploy.install, { serverId: 'srv-1', sudoPassword: 'a'.repeat(5000) }),
    ).rejects.toThrow(/password/);
    await expect(
      call(IPC.deploy.uninstall, { serverId: 'srv-1', sudoPassword: null, keepData: 'yes' }),
    ).rejects.toThrow(/keep/);
    await expect(call(IPC.deploy.install, null)).rejects.toThrow();
    expect(service.install).not.toHaveBeenCalled();
    expect(service.uninstall).not.toHaveBeenCalled();
    expect(service.health).not.toHaveBeenCalled();
  });
});
