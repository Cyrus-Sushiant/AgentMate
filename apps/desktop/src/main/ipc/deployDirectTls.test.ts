import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import type { DeployDirectTls } from '../deploy/directTls/service';
import { registerDeployDirectTlsHandlers } from './deployDirectTls';

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const directTls = {
    status: vi.fn(async () => ({})),
    enable: vi.fn(async () => ({})),
    disable: vi.fn(async () => ({})),
    acceptPin: vi.fn(async () => ({})),
  };
  registerDeployDirectTlsHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    directTls: directTls as unknown as DeployDirectTls,
    guard: () => trusted,
  });
  const call = async (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { handlers, directTls, call };
}

describe('registerDeployDirectTlsHandlers', () => {
  it('handles every channel of the group', () => {
    const { handlers } = harness();

    expect([...handlers.keys()].sort()).toEqual(Object.values(IPC.deployDirectTls).sort());
  });

  it('answers only the main window', async () => {
    const { call, directTls } = harness(false);

    await expect(call(IPC.deployDirectTls.status, 'srv-1')).rejects.toThrow(/main window/);
    expect(directTls.status).not.toHaveBeenCalled();
  });

  it('passes reads, turning off and a new pin on with a checked server', async () => {
    const { call, directTls } = harness();

    await call(IPC.deployDirectTls.status, 'srv-1');
    await call(IPC.deployDirectTls.disable, 'srv-1');
    await call(IPC.deployDirectTls.acceptPin, 'srv-1');

    expect(directTls.status).toHaveBeenCalledWith('srv-1');
    expect(directTls.disable).toHaveBeenCalledWith('srv-1');
    expect(directTls.acceptPin).toHaveBeenCalledWith('srv-1');
    await expect(call(IPC.deployDirectTls.status, '../etc')).rejects.toThrow(/saved server/);
  });

  it('checks the port and normalizes the sources before the core hears of them', async () => {
    const { call, directTls } = harness();

    await call(IPC.deployDirectTls.enable, {
      serverId: 'srv-1',
      port: 9443,
      sources: ['10.0.0.0/8', '203.0.113.7/32'],
      password: 'secret',
    });

    expect(directTls.enable).toHaveBeenCalledWith({
      serverId: 'srv-1',
      port: 9443,
      sources: ['10.0.0.0/8', '203.0.113.7'],
      password: 'secret',
    });
  });

  it.each([
    [{ port: 80, sources: [] }, /1024/],
    [{ port: '9443', sources: [] }, /number/],
    [{ port: 9443, sources: '10.0.0.0/8' }, /list/],
    [{ port: 9443, sources: [7] }, /list/],
    [{ port: 9443, sources: ['10.0.0.1/8'] }, /./],
    [{ port: 9443, sources: ['0.0.0.0/0'] }, /every address/],
  ])('refuses %o', async (fields, reason) => {
    const { call, directTls } = harness();

    await expect(
      call(IPC.deployDirectTls.enable, { serverId: 'srv-1', ...fields }),
    ).rejects.toThrow(reason);
    expect(directTls.enable).not.toHaveBeenCalled();
  });
});
