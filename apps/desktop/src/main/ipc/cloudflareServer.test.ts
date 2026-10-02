import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import {
  type CloudflareServerHandlerDeps,
  registerCloudflareServerHandlers,
} from './cloudflareServer';

/** The server-side Cloudflare channels answer only the main window and check every argument. */

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const ZONE = '023e105f4ecef8ad9ca31a8372d0c353';

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const names = Object.keys(IPC.cloudflareServer);
  const ops = Object.fromEntries(names.map((name) => [name, vi.fn(async () => undefined)]));
  registerCloudflareServerHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    ops: ops as unknown as CloudflareServerHandlerDeps['ops'],
    guard: () => trusted,
  });
  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { ops, call, handlers };
}

describe('registerCloudflareServerHandlers', () => {
  it('handles every channel in the group, for the main window only', async () => {
    const { handlers, call, ops } = harness(false);

    expect([...handlers.keys()].sort()).toEqual(Object.values(IPC.cloudflareServer).sort());
    await expect(call(IPC.cloudflareServer.originLock, 'srv-1')).rejects.toThrow(/main window/);
    expect(ops.originLock).not.toHaveBeenCalled();
  });

  it('passes checked arguments through', async () => {
    const { ops, call } = harness();

    await call(IPC.cloudflareServer.originLock, 'srv-1');
    await call(IPC.cloudflareServer.applyOriginLock, {
      serverId: 'srv-1',
      enabled: true,
      authenticatedOriginPulls: false,
      extra: 'dropped',
    });
    await call(IPC.cloudflareServer.originCertificate, { serverId: 'srv-1', siteId: 'blog' });
    await call(IPC.cloudflareServer.provisionDnsToken, {
      serverId: 'srv-1',
      zoneId: ZONE,
      mode: 'paste',
      token: ' abc \n',
    });
    await call(IPC.cloudflareServer.provisionDnsToken, {
      serverId: 'srv-1',
      zoneId: ZONE,
      mode: 'mint',
      token: 'ignored',
    });
    await call(IPC.cloudflareServer.removeDnsToken, {
      serverId: 'srv-1',
      zone: 'example.com',
      deleteAtCloudflare: true,
    });

    expect(ops.originLock).toHaveBeenCalledWith('srv-1');
    expect(ops.applyOriginLock).toHaveBeenCalledWith({
      serverId: 'srv-1',
      enabled: true,
      authenticatedOriginPulls: false,
    });
    expect(ops.originCertificate).toHaveBeenCalledWith({ serverId: 'srv-1', siteId: 'blog' });
    expect(ops.provisionDnsToken).toHaveBeenNthCalledWith(1, {
      serverId: 'srv-1',
      zoneId: ZONE,
      mode: 'paste',
      token: 'abc',
    });
    expect(ops.provisionDnsToken).toHaveBeenNthCalledWith(2, {
      serverId: 'srv-1',
      zoneId: ZONE,
      mode: 'mint',
    });
    expect(ops.removeDnsToken).toHaveBeenCalledWith({
      serverId: 'srv-1',
      zone: 'example.com',
      deleteAtCloudflare: true,
    });
  });

  it.each([
    [IPC.cloudflareServer.originLock, '../etc'],
    [
      IPC.cloudflareServer.applyOriginLock,
      { serverId: 'srv-1', enabled: 'yes', authenticatedOriginPulls: false },
    ],
    [IPC.cloudflareServer.originCertificate, { serverId: 'srv-1', siteId: 'Blog;' }],
    [IPC.cloudflareServer.provisionDnsToken, { serverId: 'srv-1', zoneId: 'nope', mode: 'mint' }],
    [IPC.cloudflareServer.provisionDnsToken, { serverId: 'srv-1', zoneId: ZONE, mode: 'steal' }],
    [
      IPC.cloudflareServer.provisionDnsToken,
      { serverId: 'srv-1', zoneId: ZONE, mode: 'paste', token: 'x'.repeat(2000) },
    ],
    [
      IPC.cloudflareServer.removeDnsToken,
      { serverId: 'srv-1', zone: 'example.com\n', deleteAtCloudflare: false },
    ],
  ])('refuses %s with %j', async (channel, input) => {
    const { ops, call } = harness();

    await expect(call(channel, input)).rejects.toThrow();
    for (const method of Object.values(ops)) expect(method).not.toHaveBeenCalled();
  });
});
