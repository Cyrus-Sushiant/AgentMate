import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeCore } from '../../../shared/deploy/testing/fakeCore';
import { streamError } from '../../../shared/deploy/testing/fakeStream';
import type { DeployConnection } from '../../../shared/deployTypes';
import type { LiveHubSession } from '../connection/liveHub';
import { fakeLiveHubs } from '../testing/fakeLiveHub';
import { CoreLink } from './coreLink';
import { JobFeed, type LinkFeed, MetricsFeed } from './feeds';

/**
 * The link's less travelled paths: a reset or a close in the middle of things, a rotation that
 * cannot open its next connection, a call that keeps an old connection busy, and streams the
 * core refuses while the connection itself stays up.
 */

const MINUTE = 60_000;

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

function setup(open?: (fallback: () => Promise<LiveHubSession>) => Promise<LiveHubSession>) {
  const core = new FakeCore(() => Date.now());
  const hubs = fakeLiveHubs(core, { lifetimeMs: 15 * MINUTE });
  const states: DeployConnection[] = [];
  const link = new CoreLink({
    serverId: 'srv-1',
    open: open ? () => open(hubs.open) : hubs.open,
    onState: (state) => states.push(state),
  });
  return { core, hubs, link, states };
}

describe('CoreLink edges', () => {
  it('turns a waiting call away when closed', async () => {
    const { link } = setup(() => new Promise(() => undefined));
    const call = link.call((hub) => hub.ping());
    const refused = expect(call).rejects.toThrow(/closed/);

    link.close();

    await refused;
    expect(() => link.attach(new MetricsFeed(1_000))).toThrow(/closed/);
  });

  it('drops a connection that opened after a reset, and opens a fresh one', async () => {
    let release: () => void = () => undefined;
    let first = true;
    const { link, hubs } = setup(async (fallback) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return fallback();
    });
    link.attach(new MetricsFeed(1_000));
    await settle();

    link.reset();
    release();
    await settle();

    expect(hubs.connections).toHaveLength(2);
    expect(hubs.connections[0].closed).toBe(true);
    expect(link.info.state).toBe('online');
  });

  it('tries the rotation again when its next connection cannot open yet', async () => {
    let refuse = false;
    const { link, hubs } = setup(async (fallback) => {
      if (refuse) throw new Error('not now');
      return fallback();
    });
    link.attach(new MetricsFeed(1_000));
    await settle();

    refuse = true;
    await settle(14.5 * MINUTE);
    expect(hubs.connections).toHaveLength(1);
    refuse = false;
    await settle(10_000);

    expect(hubs.connections).toHaveLength(2);
    expect(link.info.state).toBe('online');
  });

  it('closes a replaced connection after a while even when a call never finishes', async () => {
    const { link, hubs } = setup();
    void link.call(() => new Promise(() => undefined));
    await settle(14.5 * MINUTE);
    expect(hubs.connections[0].closed).toBe(false);

    await settle(31_000);

    expect(hubs.connections[0].closed).toBe(true);
  });

  it('says it is reconnecting when the quick reconnect takes more than a moment', async () => {
    let hang = false;
    const { link, core, states } = setup(async (fallback) => {
      if (hang) return new Promise(() => undefined);
      return fallback();
    });
    link.attach(new MetricsFeed(1_000));
    await settle(MINUTE);

    hang = true;
    core.dropAll();
    await settle(4_000);

    expect(states.at(-1)?.state).toBe('reconnecting');
  });

  it('opens a refused or failing stream again later, and lets a finished one go', async () => {
    const { link, core, hubs } = setup();
    let opens = 0;
    const flaky: LinkFeed = {
      open: (hub) => {
        opens += 1;
        if (opens === 1) throw new Error('could not build the request');
        return hub.streamMetrics({ intervalMs: 1_000 });
      },
      next: () => undefined,
      ended: () => 1_000,
      failed: () => 1_000,
    };
    link.attach(flaky);
    await settle(1_500);
    expect(opens).toBe(2);

    const ends: Array<{ error?: string }> = [];
    link.attach(
      new JobFeed('00000000-0000-4000-8000-0000000000aa', 0, {
        lines: () => undefined,
        ended: (end) => ends.push(end),
      }),
    );
    await settle();
    expect(ends).toEqual([{ error: 'There is no such job.' }]);

    hubs.latest()?.endAlertStreams();
    core.sample();
    expect(hubs.latest()?.openStreams('metrics')).toBe(1);
    expect(streamError('x').message).toMatch(/HubException/);
  });
});
