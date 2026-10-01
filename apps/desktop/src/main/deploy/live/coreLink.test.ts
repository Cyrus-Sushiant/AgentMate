import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeCoreError } from '../../../shared/coreErrors';
import { FakeCore } from '../../../shared/deploy/testing/fakeCore';
import type { DeployConnection } from '../../../shared/deployTypes';
import { VaultLockedError } from '../../ssh/vaultErrors';
import { fakeLiveHubs } from '../testing/fakeLiveHub';
import { CoreLink } from './coreLink';
import { MetricsFeed } from './feeds';

/**
 * A server's lasting connection to its core. It opens when something needs it, carries short
 * calls and every live stream, moves to a fresh connection before its token runs out, keeps
 * trying through a reboot (resuming each stream where it stopped), and waits for the user when
 * only the user can help.
 */

const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Lets promises, zero-delay timers and the link's deferred decisions run. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

function setup(options: { lifetimeMs?: number } = {}) {
  const core = new FakeCore(() => Date.now());
  const hubs = fakeLiveHubs(core, options);
  const states: DeployConnection[] = [];
  const link = new CoreLink({
    serverId: 'srv-1',
    open: hubs.open,
    onState: (connection) => states.push(connection),
  });
  const watch = (intervalMs = 1_000) => {
    const feed = new MetricsFeed(intervalMs);
    const seen: number[] = [];
    feed.listen((sample) => seen.push(sample.atUnixMs));
    const detach = link.attach(feed);
    return { feed, seen, detach };
  };
  return { core, hubs, link, states, watch, seen: () => states.map((state) => state.state) };
}

describe('CoreLink', () => {
  it('connects once something needs it, and carries short calls on that one connection', async () => {
    const { link, hubs, seen } = setup();
    expect(link.info.state).toBe('offline');

    const [first, second] = await Promise.all([
      link.call((hub) => hub.getSystemInfo()),
      link.call((hub) => hub.listServices()),
    ]);

    expect(first.hostname).toBe('prod-1');
    expect(second).toHaveLength(3);
    expect(hubs.opens()).toBe(1);
    expect(seen()).toEqual(['connecting', 'online']);
    expect(link.online).toBe(true);
  });

  it('resumes a stream after a drop from where it stopped, without a gap or a repeat', async () => {
    const { core, hubs, watch } = setup();
    const { seen } = watch();
    await settle();
    core.sample();
    await settle(1_000);
    core.sample();

    core.dropAll();
    await settle(500);
    core.sample();
    await settle(3_000);
    core.sample();

    const at = core.samples.map((sample) => sample.atUnixMs);
    expect(seen).toEqual(at);
    expect(hubs.connections).toHaveLength(2);
    expect(hubs.connections[1].requested[0].args).toEqual([
      { intervalMs: 1_000, sinceUnixMs: at[1] },
    ]);
  });

  it('moves to a fresh connection before the token runs out, without the state or a stream noticing (AC4)', async () => {
    const { core, hubs, watch, seen } = setup({ lifetimeMs: 15 * MINUTE });
    const { seen: samples } = watch();
    await settle();
    const produced: number[] = [];
    for (let minute = 0; minute < 20; minute += 1) {
      produced.push(core.sample().atUnixMs);
      await settle(MINUTE);
    }

    expect(hubs.connections).toHaveLength(2);
    expect(hubs.connections[0].closed).toBe(true);
    expect(core.openConnections).toHaveLength(1);
    expect(samples).toEqual(produced);
    expect(seen()).toEqual(['connecting', 'online']);
  });

  it('reconnects quietly when the core closes the connection first, as a clock running behind would make it', async () => {
    const { core, hubs, watch, seen } = setup();
    const { seen: samples } = watch();
    await settle(5 * MINUTE);
    core.sample();

    core.dropAll();
    await settle(100);
    core.sample();

    expect(hubs.connections).toHaveLength(2);
    expect(samples).toHaveLength(2);
    expect(seen()).toEqual(['connecting', 'online']);
  });

  it('keeps trying through a reboot, says it is reconnecting, then carries on (AC3)', async () => {
    const { core, link, watch, states } = setup();
    const { seen: samples } = watch();
    await settle();
    core.sample();

    core.down = true;
    core.dropAll();
    await settle(30_000);
    const reconnecting = states.at(-1);
    core.down = false;
    core.sample();
    await settle(30_000);

    expect(reconnecting).toMatchObject({ state: 'reconnecting', retryAt: expect.any(Number) });
    expect(link.info.state).toBe('online');
    expect(samples).toEqual(core.samples.map((sample) => sample.atUnixMs));
  });

  it('holds a short call until the connection is back', async () => {
    const { core, link, watch } = setup();
    watch();
    await settle();
    core.down = true;
    core.dropAll();
    await settle(2_000);

    const call = link.call((hub) => hub.getUpdates());
    core.down = false;
    await settle(15_000);

    await expect(call).resolves.toMatchObject({ packageManager: 'apt' });
  });

  it('gives up on a short call that waited too long, saying why', async () => {
    const { core, link } = setup();
    core.down = true;

    const call = link.call((hub) => hub.getUpdates());
    const failure = expect(call).rejects.toThrow(/could not reach|503|failed to connect/i);
    await settle(60_000);

    await failure;
  });

  it('waits for a sign-in when the session is over, and tries again once reset', async () => {
    const { hubs, link, watch } = setup();
    hubs.failNext(new Error(encodeCoreError('sessionExpired', 'Sign in again.')));
    watch();
    await settle(MINUTE);

    expect(link.info).toMatchObject({ state: 'needs-sign-in', message: 'Sign in again.' });
    expect(hubs.opens()).toBe(1);
    await expect(link.call((hub) => hub.ping())).rejects.toThrow(/sessionExpired/);

    link.reset();
    await settle();

    expect(link.info.state).toBe('online');
  });

  it('waits for the vault to open, then carries on when woken', async () => {
    const { hubs, link, watch } = setup();
    hubs.failNext(new VaultLockedError());
    watch();
    await settle(MINUTE);
    expect(link.info.state).toBe('locked');

    link.wake('locked');
    await settle();

    expect(link.info.state).toBe('online');
    expect(hubs.opens()).toBe(2);
  });

  it('closes when nothing has needed it for a minute', async () => {
    const { hubs, link, watch } = setup();
    const { detach } = watch();
    await settle();

    detach();
    await settle(MINUTE + 1_000);

    expect(link.info.state).toBe('offline');
    expect(hubs.latest()?.closed).toBe(true);
  });

  it('backs off from a connection that keeps closing right after it opens', async () => {
    const { core, hubs, watch } = setup();
    watch();
    await settle();

    for (let drop = 0; drop < 6; drop += 1) {
      core.dropAll();
      await settle(1_000);
    }

    expect(hubs.opens()).toBeLessThan(6);
  });

  it('lets a call finish on the old connection while it moves to a new one', async () => {
    const { core, hubs, link } = setup({ lifetimeMs: 15 * MINUTE });
    await link.call((hub) => hub.ping());
    let release: () => void = () => undefined;
    const slow = link.call(async (hub) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return hub.getUpdates();
    });

    await settle(14.5 * MINUTE);
    expect(hubs.connections).toHaveLength(2);
    expect(hubs.connections[0].closed).toBe(false);
    release();

    await expect(slow).resolves.toMatchObject({ packageManager: 'apt' });
    await settle();
    expect(hubs.connections[0].closed).toBe(true);
    expect(core.openConnections).toHaveLength(1);
  });

  it('stops for good when closed', async () => {
    const { hubs, link, watch } = setup();
    watch();
    await settle();

    link.close();
    await settle(MINUTE);

    expect(link.info.state).toBe('offline');
    expect(hubs.opens()).toBe(1);
    await expect(link.call((hub) => hub.ping())).rejects.toThrow(/closed/);
  });
});
