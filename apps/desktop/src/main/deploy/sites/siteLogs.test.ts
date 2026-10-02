import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeCore } from '../../../shared/deploy/testing/fakeCore';
import type { DeploySiteLogEvent } from '../../../shared/deploySitesTypes';
import { IPC } from '../../../shared/ipcChannels';
import { CoreLinks } from '../live/coreLinks';
import { fakeLiveHubs } from '../testing/fakeLiveHub';
import { SiteLogFeed } from './siteLogFeed';
import { SiteLogSubscriptions } from './siteLogs';

/**
 * A site's live log: the last lines, then new ones in batches to the window that asked, a rotated
 * file or a new connection replacing what the window shows, and an end when the site goes away.
 */

let links: CoreLinks | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});

afterEach(() => {
  links?.closeAll();
  links = null;
  vi.useRealTimers();
});

function setup() {
  const core = new FakeCore(() => Date.now());
  const hubs = fakeLiveHubs(core);
  links = new CoreLinks({ open: () => hubs.open() });
  core.nginx.saveSite({
    id: 'blog',
    domains: ['blog.example.com'],
    upstream: { kind: 'servicePort', port: 3000, verifyCertificate: true, sendUpstreamHost: false },
    websocket: false,
    gzip: true,
    http2: true,
    redirectToHttps: false,
  });
  let n = 0;
  const logs = new SiteLogSubscriptions({ links, newId: () => `log-${++n}` });
  const events: DeploySiteLogEvent[] = [];
  const owner = {
    id: 1,
    send: vi.fn((channel: string, payload: unknown) => {
      expect(channel).toBe(IPC.deploySites.onLog);
      events.push(payload as DeploySiteLogEvent);
    }),
  };
  return { core, hubs, logs, events, owner };
}

describe('SiteLogSubscriptions', () => {
  it('sends the tail, then new lines in one batch, and a rotation as a reset', async () => {
    const { core, logs, events, owner } = setup();
    core.nginx.writeLog('blog', 'access', ['GET / 200', 'GET /a 404']);

    const id = logs.watch(owner, {
      serverId: 'srv-1',
      siteId: 'blog',
      kind: 'access',
      tailLines: 1,
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(events).toEqual([
      expect.objectContaining({
        subscriptionId: id,
        siteId: 'blog',
        lines: ['GET /a 404'],
        reset: false,
      }),
    ]);

    core.nginx.writeLog('blog', 'access', ['GET /b 200']);
    core.nginx.writeLog('blog', 'access', ['GET /c 200']);
    await vi.advanceTimersByTimeAsync(150);
    expect(events[1].lines).toEqual(['GET /b 200', 'GET /c 200']);

    core.nginx.writeLog('blog', 'access', ['fresh'], true);
    await vi.advanceTimersByTimeAsync(150);
    expect(events[2]).toMatchObject({ lines: ['fresh'], reset: true });
    expect(logs.unwatch(owner, id)).toBe(true);
    expect(logs.unwatch(owner, id)).toBe(false);
  });

  it('starts over with the tail on a new connection and marks it a reset', async () => {
    const { core, hubs, logs, events, owner } = setup();
    core.nginx.writeLog('blog', 'error', ['oops']);
    logs.watch(owner, { serverId: 'srv-1', siteId: 'blog', kind: 'error' });
    await vi.advanceTimersByTimeAsync(150);
    expect(events).toHaveLength(1);

    core.dropAll();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(hubs.opens()).toBeGreaterThan(1);
    expect(events.at(-1)).toMatchObject({ lines: ['oops'], reset: true });
  });

  it('ends the log when the core refuses it, and ends a window’s logs when it goes', async () => {
    const { core, logs, events, owner } = setup();
    logs.watch(owner, { serverId: 'srv-1', siteId: 'gone', kind: 'access' });
    await vi.advanceTimersByTimeAsync(150);
    expect(events[0].ended).toEqual({ error: 'There is no such site.' });
    expect(logs.count()).toBe(0);

    core.nginx.writeLog('blog', 'access', []);
    logs.watch(owner, { serverId: 'srv-1', siteId: 'blog', kind: 'access' });
    logs.watch({ id: 2, send: vi.fn() }, { serverId: 'srv-1', siteId: 'blog', kind: 'error' });
    expect(() => logs.watch(owner, { serverId: 'srv-1', siteId: 'blog', kind: 'error' })).toThrow(
      /Two site logs are already open/,
    );
    expect(logs.unwatch({ id: 2, send: vi.fn() }, 'log-2')).toBe(false);
    logs.dropOwner(1);
    expect(logs.count()).toBe(1);
  });

  it('waits out a busy connection, reopens a stream the core ended, and skips empty batches', () => {
    const lines = vi.fn();
    const ended = vi.fn();
    const feed = new SiteLogFeed('blog', 'access', 10, { lines, ended });
    expect(feed.failed(new Error('This connection already has 2 siteLog streams open.'))).toBe(
      5_000,
    );
    expect(feed.ended()).toBe(1_000);
    feed.next({ lines: [], reset: false });
    expect(lines).not.toHaveBeenCalled();
    feed.next({ lines: [], reset: true });
    expect(lines).toHaveBeenCalledWith([], true);
    expect(ended).not.toHaveBeenCalled();
  });
});
