import { EventEmitter } from 'node:events';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import type { DeploySubscriptions } from '../deploy/live/subscriptions';
import type { DeploySystem } from '../deploy/system';
import { registerDeploySystemHandlers, subscriptionOwners } from './deploySystem';

/**
 * The Overview's channels answer only the main window, check every argument before the core
 * hears of it, and tie each live subscription to the window that opened it.
 */

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const JOB = '00000000-0000-4000-8000-000000000001';
const SUBSCRIPTION = '5b0e0f3c-8d6e-4c55-9d0e-3f7a1c2b9e10';

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const answer = vi.fn(async () => ({}));
  const system = Object.fromEntries(
    [
      'info',
      'services',
      'metricsHistory',
      'updates',
      'checkUpdates',
      'upgradeSecurity',
      'upgradeAll',
      'setAutomaticUpdates',
      'reboot',
      'restartService',
      'jobs',
      'job',
      'cancelJob',
      'alerts',
      'acknowledgeAlert',
    ].map((name) => [name, vi.fn(answer)]),
  ) as unknown as Record<string, ReturnType<typeof vi.fn>>;
  const subscriptions = {
    watchMetrics: vi.fn(() => 'sub-m'),
    watchJob: vi.fn(() => 'sub-j'),
    watchAlerts: vi.fn(() => 'sub-a'),
    unwatch: vi.fn(() => true),
  };
  const owner = { id: 7, send: vi.fn() };
  registerDeploySystemHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    system: system as unknown as DeploySystem,
    subscriptions: subscriptions as unknown as DeploySubscriptions,
    guard: () => trusted,
    owner: () => owner,
  });
  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { handlers, system, subscriptions, owner, call };
}

function invokes(group: Record<string, string>): string[] {
  return Object.entries(group)
    .filter(([name]) => !name.startsWith('on'))
    .map(([, channel]) => channel);
}

describe('registerDeploySystemHandlers', () => {
  it('handles every invoke channel of the three groups', () => {
    const { handlers } = harness();

    expect([...handlers.keys()].sort()).toEqual(
      [
        ...invokes(IPC.deploySystem),
        ...invokes(IPC.deployJobs),
        ...invokes(IPC.deployAlerts),
      ].sort(),
    );
  });

  it('answers only the main window', async () => {
    const { system, subscriptions, call } = harness(false);

    await expect(call(IPC.deploySystem.info, 'srv-1')).rejects.toThrow(/main window/);
    await expect(call(IPC.deployJobs.watch, { serverId: 'srv-1', jobId: JOB })).rejects.toThrow(
      /main window/,
    );
    expect(system.info).not.toHaveBeenCalled();
    expect(subscriptions.watchJob).not.toHaveBeenCalled();
  });

  it('passes checked reads and jobs on to the Overview service', async () => {
    const { system, call } = harness();

    await call(IPC.deploySystem.info, 'srv-1');
    await call(IPC.deploySystem.services, 'srv-1');
    await call(IPC.deploySystem.updates, 'srv-1');
    await call(IPC.deploySystem.checkUpdates, 'srv-1');
    await call(IPC.deploySystem.upgradeSecurity, 'srv-1');
    await call(IPC.deploySystem.metricsHistory, {
      serverId: 'srv-1',
      resolution: 'minute',
      fromUnixMs: 10,
    });
    await call(IPC.deploySystem.upgradeAll, { serverId: 'srv-1', password: 'pw' });
    await call(IPC.deploySystem.reboot, { serverId: 'srv-1', totpCode: '123456' });
    await call(IPC.deploySystem.setAutomaticUpdates, 'srv-1', true);
    await call(IPC.deploySystem.restartService, 'srv-1', 'nginx');
    await call(IPC.deployJobs.list, { serverId: 'srv-1', activeOnly: true, limit: 20 });
    await call(IPC.deployJobs.get, 'srv-1', JOB);
    await call(IPC.deployJobs.cancel, 'srv-1', JOB);
    await call(IPC.deployAlerts.list, { serverId: 'srv-1', includeResolved: true });
    await call(IPC.deployAlerts.acknowledge, 'srv-1', 12);

    expect(system.info).toHaveBeenCalledWith('srv-1');
    expect(system.metricsHistory).toHaveBeenCalledWith('srv-1', {
      resolution: 'minute',
      fromUnixMs: 10,
    });
    expect(system.upgradeAll).toHaveBeenCalledWith({ serverId: 'srv-1', password: 'pw' });
    expect(system.reboot).toHaveBeenCalledWith({ serverId: 'srv-1', totpCode: '123456' });
    expect(system.setAutomaticUpdates).toHaveBeenCalledWith('srv-1', true);
    expect(system.restartService).toHaveBeenCalledWith('srv-1', 'nginx');
    expect(system.jobs).toHaveBeenCalledWith('srv-1', { activeOnly: true, limit: 20 });
    expect(system.job).toHaveBeenCalledWith('srv-1', JOB);
    expect(system.cancelJob).toHaveBeenCalledWith('srv-1', JOB);
    expect(system.alerts).toHaveBeenCalledWith('srv-1', { includeResolved: true });
    expect(system.acknowledgeAlert).toHaveBeenCalledWith('srv-1', 12);
  });

  it('asks for the defaults the core expects when a query leaves them out', async () => {
    const { system, call } = harness();

    await call(IPC.deployJobs.list, { serverId: 'srv-1' });
    await call(IPC.deployAlerts.list, { serverId: 'srv-1' });

    expect(system.jobs).toHaveBeenCalledWith('srv-1', { activeOnly: false });
    expect(system.alerts).toHaveBeenCalledWith('srv-1', { includeResolved: false });
  });

  it('opens and closes live subscriptions for the window that asked', async () => {
    const { subscriptions, owner, call } = harness();

    expect(
      await call(IPC.deploySystem.watchMetrics, { serverId: 'srv-1', intervalMs: 5_000 }),
    ).toBe('sub-m');
    expect(await call(IPC.deployJobs.watch, { serverId: 'srv-1', jobId: JOB, afterSeq: 3 })).toBe(
      'sub-j',
    );
    expect(await call(IPC.deployAlerts.watch, 'srv-1')).toBe('sub-a');
    await call(IPC.deploySystem.unwatchMetrics, SUBSCRIPTION);
    await call(IPC.deployJobs.unwatch, SUBSCRIPTION);
    await call(IPC.deployAlerts.unwatch, SUBSCRIPTION);

    expect(subscriptions.watchMetrics).toHaveBeenCalledWith(owner, {
      serverId: 'srv-1',
      intervalMs: 5_000,
    });
    expect(subscriptions.watchJob).toHaveBeenCalledWith(owner, {
      serverId: 'srv-1',
      jobId: JOB,
      afterSeq: 3,
    });
    expect(subscriptions.watchAlerts).toHaveBeenCalledWith(owner, 'srv-1');
    expect(subscriptions.unwatch.mock.calls).toEqual([
      [owner, 'metrics', SUBSCRIPTION],
      [owner, 'job', SUBSCRIPTION],
      [owner, 'alerts', SUBSCRIPTION],
    ]);
  });

  it('refuses arguments that are not what the channel takes', async () => {
    const { system, subscriptions, call } = harness();
    const refused = async (channel: string, ...args: unknown[]) =>
      expect(call(channel, ...args)).rejects.toThrow();

    await refused(IPC.deploySystem.info, '../etc');
    await refused(IPC.deploySystem.metricsHistory, { serverId: 'srv-1', resolution: 'hourly' });
    await refused(IPC.deploySystem.metricsHistory, {
      serverId: 'srv-1',
      resolution: 'live',
      toUnixMs: -1,
    });
    await refused(IPC.deploySystem.setAutomaticUpdates, 'srv-1', 'yes');
    await refused(IPC.deploySystem.restartService, 'srv-1', 'postgres');
    await refused(IPC.deploySystem.upgradeAll, { serverId: 'srv-1', password: 7 });
    await refused(IPC.deploySystem.watchMetrics, { serverId: 'srv-1', intervalMs: 50 });
    await refused(IPC.deploySystem.watchMetrics, { serverId: 'srv-1', intervalMs: 1_500.5 });
    await refused(IPC.deploySystem.watchMetrics, { serverId: 'srv-1', sinceUnixMs: 'now' });
    await refused(IPC.deploySystem.unwatchMetrics, 'not-an-id');
    await refused(IPC.deployJobs.get, 'srv-1', 'job-1');
    await refused(IPC.deployJobs.list, { serverId: 'srv-1', limit: 5_000 });
    await refused(IPC.deployJobs.list, { serverId: 'srv-1', activeOnly: 'no' });
    await refused(IPC.deployJobs.watch, { serverId: 'srv-1', jobId: JOB, afterSeq: -2 });
    await refused(IPC.deployAlerts.acknowledge, 'srv-1', 0);
    await refused(IPC.deployAlerts.acknowledge, 'srv-1', 2 ** 60);
    await refused(IPC.deployAlerts.list, { serverId: 'srv-1', limit: 0 });
    await refused(IPC.deployAlerts.list, null);

    for (const fn of Object.values(system)) expect(fn).not.toHaveBeenCalled();
    expect(subscriptions.watchMetrics).not.toHaveBeenCalled();
    expect(subscriptions.unwatch).not.toHaveBeenCalled();
  });
});

describe('subscriptionOwners', () => {
  function contents(id: number) {
    const emitter = new EventEmitter();
    const sent: unknown[][] = [];
    const fake = Object.assign(emitter, {
      id,
      isDestroyed: () => false,
      send: (...args: unknown[]) => sent.push(args),
    });
    return { fake: fake as unknown as WebContents, emitter, sent };
  }

  it('gives each window one owner, and drops its subscriptions when it reloads, crashes or closes', () => {
    const dropped: number[] = [];
    const ownerOf = subscriptionOwners((id) => dropped.push(id));
    const main = contents(3);

    const owner = ownerOf(main.fake);
    expect(ownerOf(main.fake)).toBe(owner);
    owner.send('deploySystem:onMetrics', { samples: [] });
    main.emitter.emit('did-navigate');
    main.emitter.emit('render-process-gone');
    main.emitter.emit('destroyed');

    expect(owner.id).toBe(3);
    expect(main.sent).toEqual([['deploySystem:onMetrics', { samples: [] }]]);
    expect(dropped).toEqual([3, 3, 3]);
  });
});
