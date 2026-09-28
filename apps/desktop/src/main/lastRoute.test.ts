import { existsSync, readFileSync } from 'node:fs';
import type { BrowserWindow } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeBrowserWindow } from '../test/main/electronMock';
import { useTempUserData } from '../test/main/ipcHarness';

/**
 * The page the main window was on when the app closed, and the page it opens on next time. The
 * saved route goes through the real filesystem in a throwaway userData folder, and a restart is a
 * fresh copy of the module reading what the last one wrote.
 */

const userData = useTempUserData();

afterEach(() => {
  vi.useRealTimers();
});

function load(): Promise<typeof import('./lastRoute')> {
  return import('./lastRoute');
}

function savedFile(): unknown {
  return JSON.parse(readFileSync(userData.dataFile('last-route.json'), 'utf-8'));
}

describe('normalizeRoute', () => {
  it.each([
    '/',
    '/usage',
    '/workspace',
    '/workspace/p1',
    '/workspace/p1~wt-1',
    '/projects/p1?tab=git',
    '/settings?tab=general',
    '/prompt-history',
    '/remote-files',
  ])('keeps the app page %s', async (route) => {
    const { normalizeRoute } = await load();
    expect(normalizeRoute(route)).toBe(route);
  });

  it('drops the one-shot params a notification click adds', async () => {
    const { normalizeRoute } = await load();

    expect(normalizeRoute('/workspace/p1?session=t1')).toBe('/workspace/p1');
    expect(normalizeRoute('/workspace/p1?tag=1&x=2')).toBe('/workspace/p1?x=2');
  });

  it.each([
    '/widget/1',
    '/widget/prompt-build/1',
    '/desktop-pet',
    '/remote-session',
    '/rdp-session',
    '/nowhere',
    '//evil.example',
    'http://evil.example',
    'usage',
    '',
    `/usage?q=${'x'.repeat(4000)}`,
  ])('refuses %s', async (route) => {
    const { normalizeRoute } = await load();
    expect(normalizeRoute(route)).toBeNull();
  });

  it('refuses anything that is not a string', async () => {
    const { normalizeRoute } = await load();

    for (const value of [null, undefined, 42, {}, ['/usage']]) {
      expect(normalizeRoute(value)).toBeNull();
    }
  });
});

describe('resolveStartupRoute', () => {
  const projectIds = ['p1', 'p2'];

  it('reopens the last page when the user asked for that', async () => {
    const { resolveStartupRoute } = await load();

    expect(
      resolveStartupRoute({ startupPage: 'last', lastRoute: '/workspace/p1', projectIds }),
    ).toBe('/workspace/p1');
  });

  it('opens the dashboard when nothing was saved yet', async () => {
    const { resolveStartupRoute } = await load();

    expect(resolveStartupRoute({ startupPage: 'last', lastRoute: null, projectIds })).toBe('/');
  });

  it('opens the picked page whatever the last one was', async () => {
    const { resolveStartupRoute } = await load();

    expect(
      resolveStartupRoute({ startupPage: '/usage', lastRoute: '/workspace/p1', projectIds }),
    ).toBe('/usage');
    expect(resolveStartupRoute({ startupPage: '/', lastRoute: '/settings', projectIds })).toBe('/');
  });

  it('keeps a worktree of a project that still exists', async () => {
    const { resolveStartupRoute } = await load();

    expect(
      resolveStartupRoute({ startupPage: 'last', lastRoute: '/workspace/p2~wt-1', projectIds }),
    ).toBe('/workspace/p2~wt-1');
  });

  it('falls back to the list page when the last project was deleted', async () => {
    const { resolveStartupRoute } = await load();

    expect(
      resolveStartupRoute({ startupPage: 'last', lastRoute: '/workspace/gone', projectIds }),
    ).toBe('/workspace');
    expect(
      resolveStartupRoute({ startupPage: 'last', lastRoute: '/projects/gone?tab=git', projectIds }),
    ).toBe('/projects');
  });

  it('does not trust a saved route it would refuse to save', async () => {
    const { resolveStartupRoute } = await load();

    expect(resolveStartupRoute({ startupPage: 'last', lastRoute: '/widget/1', projectIds })).toBe(
      '/',
    );
  });
});

describe('saving the last route', () => {
  it('writes the route shortly after it changes, and a restart reads it back', async () => {
    vi.useFakeTimers();
    const first = await load();

    first.rememberRoute('/settings');
    first.rememberRoute('/usage');
    expect(existsSync(userData.dataFile('last-route.json'))).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(savedFile()).toEqual({ route: '/usage' });

    vi.resetModules();
    const next = await load();
    expect(next.loadLastRoute()).toBe('/usage');
  });

  it('writes a pending route at once when asked to flush', async () => {
    const first = await load();

    first.rememberRoute('/workspace/p1');
    first.flushLastRoute();

    expect(savedFile()).toEqual({ route: '/workspace/p1' });
  });

  it('ignores a route it would refuse and keeps the last good one', async () => {
    const lastRoute = await load();

    lastRoute.rememberRoute('/usage');
    lastRoute.rememberRoute('/widget/1');
    lastRoute.rememberRoute(42);
    lastRoute.flushLastRoute();

    expect(lastRoute.loadLastRoute()).toBe('/usage');
    expect(savedFile()).toEqual({ route: '/usage' });
  });

  it('reads nothing from a missing or damaged file', async () => {
    const missing = await load();
    expect(missing.loadLastRoute()).toBeNull();

    vi.resetModules();
    userData.writeData('last-route.json', { route: '/widget/1' });
    expect((await load()).loadLastRoute()).toBeNull();

    vi.resetModules();
    userData.writeData('last-route.json', 'not an object');
    expect((await load()).loadLastRoute()).toBeNull();
  });

  it.each(['close', 'session-end'])(
    'writes the pending route when the window emits %s',
    async (event) => {
      const lastRoute = await load();
      const win = new FakeBrowserWindow();
      lastRoute.trackLastRoute(win as unknown as BrowserWindow);

      lastRoute.rememberRoute('/docker');
      win.emit(event);

      expect(savedFile()).toEqual({ route: '/docker' });
    },
  );
});

describe('startupRoute', () => {
  it('reopens the saved page of a project that still exists', async () => {
    userData.writeData('projects.json', [{ id: 'p1', name: 'Demo', folderPath: 'C:/demo' }]);
    userData.writeData('last-route.json', { route: '/workspace/p1' });

    expect(await (await load()).startupRoute()).toBe('/workspace/p1');
  });

  it('follows the startup page setting', async () => {
    userData.writeData('settings.json', { startupPage: '/usage' });
    userData.writeData('last-route.json', { route: '/settings' });

    expect(await (await load()).startupRoute()).toBe('/usage');
  });

  it('opens the dashboard on a fresh profile', async () => {
    expect(await (await load()).startupRoute()).toBe('/');
  });
});

describe('takeStartupRoute', () => {
  it('hands over the route prepared before the window was made', async () => {
    userData.writeData('settings.json', { startupPage: '/usage' });
    const lastRoute = await load();

    await lastRoute.prepareStartupRoute();

    expect(lastRoute.takeStartupRoute()).toBe('/usage');
  });

  it('reopens a later window where this session left off', async () => {
    // macOS keeps the app running with no window, and a Dock click makes a new one.
    userData.writeData('settings.json', { startupPage: '/' });
    const lastRoute = await load();
    await lastRoute.prepareStartupRoute();
    expect(lastRoute.takeStartupRoute()).toBe('/');

    lastRoute.rememberRoute('/docker');

    expect(lastRoute.takeStartupRoute()).toBe('/docker');
  });

  it('opens the dashboard when nothing was prepared or visited', async () => {
    expect((await load()).takeStartupRoute()).toBe('/');
  });
});
