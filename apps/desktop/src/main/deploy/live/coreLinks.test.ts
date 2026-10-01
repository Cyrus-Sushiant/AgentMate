import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeCore } from '../../../shared/deploy/testing/fakeCore';
import type { DeployConnection } from '../../../shared/deployTypes';
import { fakeLiveHubs } from '../testing/fakeLiveHub';
import { CoreLinks } from './coreLinks';
import { AlertsFeed } from './feeds';

/**
 * One link per server, with the streams everyone shares: one metrics stream per interval, one
 * alerts stream for the app's windows, and job logs counted against the core's limit of four,
 * so a window that mounts twice never runs into the core's refusal.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

function setup() {
  const core = new FakeCore(() => Date.now());
  const hubs = fakeLiveHubs(core);
  const states: DeployConnection[] = [];
  const links = new CoreLinks({
    open: async (serverId) => {
      if (serverId !== 'srv-1') throw new Error(`No fake for ${serverId}`);
      return hubs.open();
    },
    onState: (connection) => states.push(connection),
  });
  return { core, hubs, links, states };
}

describe('CoreLinks', () => {
  it('reports a server nothing has needed yet as offline, then each change with its server', async () => {
    const { links, states } = setup();
    expect(links.info('srv-1')).toMatchObject({ serverId: 'srv-1', state: 'offline' });
    expect(links.isOnline('srv-1')).toBe(false);

    await links.call('srv-1', (hub) => hub.ping());

    expect(links.isOnline('srv-1')).toBe(true);
    expect(states.map((state) => [state.serverId, state.state])).toEqual([
      ['srv-1', 'connecting'],
      ['srv-1', 'online'],
    ]);
  });

  it('shares one metrics stream per interval, and refuses a third interval', async () => {
    const { core, hubs, links } = setup();
    const a: number[] = [];
    const b: number[] = [];
    links.watchMetrics('srv-1', 2_000, (sample) => a.push(sample.atUnixMs));
    links.watchMetrics('srv-1', 2_000, (sample) => b.push(sample.atUnixMs));
    links.watchMetrics('srv-1', 5_000, () => undefined);
    await settle();

    core.sample();

    expect(a).toHaveLength(1);
    expect(b).toEqual(a);
    expect(hubs.latest()?.openStreams('metrics')).toBe(2);
    expect(() => links.watchMetrics('srv-1', 10_000, () => undefined)).toThrow(/two intervals/);
  });

  it('keeps a metrics stream a moment after its last listener, for a window that mounts again', async () => {
    const { core, hubs, links } = setup();
    const stop = links.watchMetrics('srv-1', 2_000, () => undefined);
    await settle();
    core.sample();
    stop();
    await settle(1_000);

    const late: number[] = [];
    links.watchMetrics('srv-1', 2_000, (sample) => late.push(sample.atUnixMs), 0);
    await settle(10_000);
    expect(hubs.latest()?.requested.filter((one) => one.kind === 'metrics')).toHaveLength(1);
    expect(late).toEqual([core.samples[0].atUnixMs]);
  });

  it('closes a metrics stream once nobody has come back for it', async () => {
    const { hubs, links } = setup();
    const stop = links.watchMetrics('srv-1', 2_000, () => undefined);
    await settle();

    stop();
    stop();
    await settle(6_000);

    expect(hubs.latest()?.openStreams('metrics')).toBe(0);
  });

  it('lets the second interval take the place of one nobody listens to any more', async () => {
    const { hubs, links } = setup();
    links.watchMetrics('srv-1', 1_000, () => undefined);
    const stop = links.watchMetrics('srv-1', 2_000, () => undefined);
    await settle();
    stop();

    links.watchMetrics('srv-1', 3_000, () => undefined);
    await settle();

    expect(hubs.latest()?.openStreams('metrics')).toBe(2);
  });

  it('gives a window that joins late the open alerts first, then the changes', async () => {
    const { core, links } = setup();
    core.raise('diskPressure', '/', 'warning', '/ is 91% full.');
    links.watchAlerts('srv-1', () => undefined);
    await settle();
    core.raise('rebootRequired', 'system', 'warning', 'A reboot is needed.');
    await settle();

    const late: string[] = [];
    links.watchAlerts('srv-1', (alert) => late.push(alert.kind));
    core.resolve(1);
    await settle();

    expect(late).toEqual(['diskPressure', 'rebootRequired', 'diskPressure']);
  });

  it('keeps the shared alerts stream for a window that comes back, and closes it after', async () => {
    const { hubs, links } = setup();
    const stop = links.watchAlerts('srv-1', () => undefined);
    await settle();
    stop();
    stop();
    await settle(1_000);

    const again = links.watchAlerts('srv-1', () => undefined);
    const other = links.watchAlerts('srv-1', () => undefined);
    other();
    await settle(10_000);
    expect(hubs.latest()?.openStreams('alerts')).toBe(1);

    again();
    await settle(6_000);
    expect(hubs.latest()?.openStreams('alerts')).toBe(0);
  });

  it("runs the watcher's alerts on a stream of its own, from its own revision", async () => {
    const { core, hubs, links } = setup();
    core.raise('diskPressure', '/', 'warning', '/ is 91% full.');
    links.watchAlerts('srv-1', () => undefined);
    const watcher = new AlertsFeed({ afterRevision: 1 });
    const seen: number[] = [];
    watcher.listen((alert) => seen.push(alert.revision));
    links.attachAlerts('srv-1', watcher);
    await settle();

    core.raise('rebootRequired', 'system', 'warning', 'A reboot is needed.');
    await settle();

    expect(seen).toEqual([2]);
    expect(hubs.latest()?.openStreams('alerts')).toBe(2);
  });

  it('opens at most four job logs on a server, and frees a place when one ends', async () => {
    const { core, links } = setup();
    const jobs = ['a', 'b', 'c', 'd'].map((name) =>
      core.startJob('serviceRestart', `Restart ${name}`, { resource: name }),
    );
    const ended: string[] = [];
    const stops = jobs.map((job) =>
      links.watchJob('srv-1', job.id, 0, {
        lines: () => undefined,
        ended: (end) => ended.push(end.job?.id ?? '?'),
      }),
    );
    await settle();

    expect(() =>
      links.watchJob('srv-1', jobs[0].id, 0, { lines: () => undefined, ended: () => undefined }),
    ).toThrow(/Four job logs/);

    core.finishJob(jobs[0].id, 'succeeded', 0);
    await settle();
    expect(ended).toEqual([jobs[0].id]);

    const quiet = { lines: () => undefined, ended: () => undefined };
    const fifth = core.startJob('serviceRestart', 'Restart e', { resource: 'e' });
    links.watchJob('srv-1', fifth.id, 0, quiet);
    expect(() => links.watchJob('srv-1', fifth.id, 0, quiet)).toThrow(/Four job logs/);
    stops[1]();
    stops[1]();
    expect(() => links.watchJob('srv-1', fifth.id, 0, quiet)).not.toThrow();
  });

  it('passes reset, retry, wake and close on to the links', async () => {
    const { hubs, links } = setup();
    links.watchMetrics('srv-1', 1_000, () => undefined);
    await settle();

    links.reset('srv-1');
    await settle();
    expect(hubs.opens()).toBe(2);

    links.retry('srv-1');
    links.wake('locked');
    links.reset('unknown');
    await settle();
    expect(hubs.opens()).toBe(2);

    links.closeAll();
    await settle();
    expect(links.info('srv-1').state).toBe('offline');
    expect(hubs.latest()?.closed).toBe(true);
  });
});
