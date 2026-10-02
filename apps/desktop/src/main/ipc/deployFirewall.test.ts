import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import type { DeployFirewall } from '../deploy/firewall';
import { registerDeployFirewallHandlers } from './deployFirewall';

/**
 * The Firewall channels answer only the main window and check every change before the core
 * hears of it: kinds, actions, protocols, ports and ranges, sources as addresses or networks,
 * comments, the typed phrase and the change set's id.
 */

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const CHANGE = '00000000-0000-4000-9000-000000000001';
const tcp = (fields: Record<string, unknown> = {}) => ({
  kind: 'addRule',
  rule: { action: 'allow', protocol: 'tcp', port: 8080, ...fields },
});

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const firewall = Object.fromEntries(
    ['status', 'presets', 'history', 'exposure', 'preview', 'apply', 'confirm', 'revert'].map(
      (name) => [name, vi.fn(async () => ({}))],
    ),
  ) as unknown as Record<string, ReturnType<typeof vi.fn>>;
  registerDeployFirewallHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    firewall: firewall as unknown as DeployFirewall,
    guard: () => trusted,
  });
  const call = async (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { handlers, firewall, call };
}

describe('registerDeployFirewallHandlers', () => {
  it('handles every invoke channel of the group', () => {
    const { handlers } = harness();
    const invokes = Object.entries(IPC.deployFirewall)
      .filter(([name]) => !name.startsWith('on'))
      .map(([, channel]) => channel);

    expect([...handlers.keys()].sort()).toEqual(invokes.sort());
  });

  it('answers only the main window', async () => {
    const { call, firewall } = harness(false);

    await expect(call(IPC.deployFirewall.status, 'srv-1')).rejects.toThrow(/main window/);
    expect(firewall.status).not.toHaveBeenCalled();
  });

  it('passes the reads on with a checked server', async () => {
    const { call, firewall } = harness();

    await call(IPC.deployFirewall.status, 'srv-1');
    await call(IPC.deployFirewall.presets, 'srv-1');
    await call(IPC.deployFirewall.exposure, 'srv-1');
    await call(IPC.deployFirewall.history, { serverId: 'srv-1', limit: 20 });
    await call(IPC.deployFirewall.history, { serverId: 'srv-1' });

    expect(firewall.status).toHaveBeenCalledWith('srv-1');
    expect(firewall.history).toHaveBeenNthCalledWith(1, { serverId: 'srv-1', limit: 20 });
    expect(firewall.history).toHaveBeenNthCalledWith(2, { serverId: 'srv-1' });
    await expect(call(IPC.deployFirewall.status, '../etc')).rejects.toThrow(/saved server/);
    await expect(call(IPC.deployFirewall.history, { serverId: 'srv-1', limit: 0 })).rejects.toThrow(
      /page size/,
    );
  });

  it('passes a checked change set on to preview and apply', async () => {
    const { call, firewall } = harness();
    const changes = [
      tcp({ portTo: 8090, source: '10.0.0.0/8', comment: 'app servers' }),
      { kind: 'removeRule', ruleId: 'r2' },
      { kind: 'setDefaultIncoming', policy: 'deny' },
      { kind: 'enable' },
    ];

    await call(IPC.deployFirewall.preview, { serverId: 'srv-1', changes });
    await call(IPC.deployFirewall.apply, {
      serverId: 'srv-1',
      changes: [{ kind: 'disable' }],
      overrideConfirmation: 'block ssh on port 22',
      password: 'secret',
    });

    expect(firewall.preview).toHaveBeenCalledWith({ serverId: 'srv-1', changes });
    expect(firewall.apply).toHaveBeenCalledWith({
      serverId: 'srv-1',
      changes: [{ kind: 'disable' }],
      overrideConfirmation: 'block ssh on port 22',
      password: 'secret',
    });
  });

  it.each([
    [[], /needs a change/],
    [[{ kind: 'flush' }], /not a firewall change/],
    [[tcp({ action: 'drop' })], /not a firewall action/],
    [[tcp({ protocol: 'icmp' })], /not a firewall protocol/],
    [[tcp({ port: 70_000 })], /Ports go from 1 to 65535/],
    [[tcp({ port: 9000, portTo: 8000 })], /can't be higher/],
    [[{ kind: 'addRule', rule: { action: 'allow', protocol: 'tcp', portTo: 80 } }], /first port/],
    [[tcp({ protocol: 'any' })], /Pick TCP or UDP/],
    [[tcp({ source: '10.0.0.5/8' })], /bits set past the prefix/],
    [[tcp({ source: 'example.com' })], /./],
    [[tcp({ source: 7 })], /must be text/],
    [[tcp({ comment: "it's" })], /Leave quotes/],
    [[tcp({ comment: 3 })], /must be text/],
    [[{ kind: 'removeRule' }], /not a firewall rule/],
    [[{ kind: 'setDefaultIncoming', policy: 'drop' }], /not a firewall policy/],
    [[null], /Expected a firewall change/],
    [[{ kind: 'addRule', rule: null }], /Expected a firewall rule/],
    [Array.from({ length: 51 }, () => ({ kind: 'enable' })), /at most 50/],
  ])('refuses the change set %j', async (changes, reason) => {
    const { call, firewall } = harness();

    await expect(call(IPC.deployFirewall.preview, { serverId: 'srv-1', changes })).rejects.toThrow(
      reason,
    );
    expect(firewall.preview).not.toHaveBeenCalled();
  });

  it('checks the change set id for confirm and revert, and the phrase for apply', async () => {
    const { call, firewall } = harness();

    await call(IPC.deployFirewall.confirm, { serverId: 'srv-1', changeSetId: CHANGE });
    await call(IPC.deployFirewall.revert, { serverId: 'srv-1', changeSetId: CHANGE });
    expect(firewall.confirm).toHaveBeenCalledWith({ serverId: 'srv-1', changeSetId: CHANGE });
    expect(firewall.revert).toHaveBeenCalledWith({ serverId: 'srv-1', changeSetId: CHANGE });

    await expect(
      call(IPC.deployFirewall.confirm, { serverId: 'srv-1', changeSetId: 'r1' }),
    ).rejects.toThrow(/not a firewall change/);
    await expect(
      call(IPC.deployFirewall.apply, {
        serverId: 'srv-1',
        changes: [{ kind: 'enable' }],
        overrideConfirmation: 'x'.repeat(201),
      }),
    ).rejects.toThrow(/confirmation phrase/);
    await expect(call(IPC.deployFirewall.apply, 'nope')).rejects.toThrow(/Expected/);
  });
});
