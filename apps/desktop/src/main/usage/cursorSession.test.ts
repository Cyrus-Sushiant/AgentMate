import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cursor usage read through the signed-in Cursor app. What matters here is where the plan's
 * limits come from: a usage-based plan (Pro, Pro+, Ultra) reports them on the usage summary,
 * an older request-based plan only as a request quota, and neither endpoint failing may take
 * the card down with it. The network is faked per path; the account read is stubbed so no real
 * Cursor install is touched.
 */

const account = vi.hoisted(() => ({
  current: {
    accessToken: 'session-token' as string | null,
    userId: 'auth0|user_test' as string | null,
    email: 'dev@example.com',
    plan: { id: 'pro-plus', label: 'Pro+' } as { id: string; label: string } | null,
    signedOut: false,
    tokenExpired: false,
    missing: false,
  },
}));
vi.mock('./cursorAccount', () => ({ getCursorAccount: () => account.current }));

const { fetchCursorSessionUsage } = await import('./cursorSession');

const CYCLE_END = '2026-10-22T11:34:38.000Z';

const PRO_PLUS_SUMMARY = {
  billingCycleStart: '2026-09-22T11:34:38.000Z',
  billingCycleEnd: CYCLE_END,
  isUnlimited: false,
  individualUsage: {
    plan: {
      enabled: true,
      used: 7000,
      limit: 7000,
      autoPercentUsed: 66.685,
      apiPercentUsed: 100,
      totalPercentUsed: 67.4663951120163,
    },
    onDemand: { enabled: false, used: 0, limit: null },
  },
};

const NO_EVENTS = { usageEventsDisplay: [], totalUsageEventsCount: 0 };

type Answer = unknown | ((init: RequestInit | undefined) => unknown);

/** Answers keyed by path; an `Error` rejects the request, a number is an HTTP status. */
function fakeCursor(answers: Record<string, Answer>) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const answer = answers[url.pathname];
    if (answer === undefined) return new Response('not found', { status: 404 });
    const value = typeof answer === 'function' ? answer(init) : answer;
    if (value instanceof Error) throw value;
    if (typeof value === 'number') return new Response('', { status: value });
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    asked: (path: string) =>
      fetchMock.mock.calls.some(([u]) => new URL(String(u)).pathname === path),
  };
}

beforeEach(() => {
  account.current = {
    accessToken: 'session-token',
    userId: 'auth0|user_test',
    email: 'dev@example.com',
    plan: { id: 'pro-plus', label: 'Pro+' },
    signedOut: false,
    tokenExpired: false,
    missing: false,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCursorSessionUsage', () => {
  it("takes a usage-based plan's limits from the usage summary", async () => {
    const cursor = fakeCursor({
      '/api/dashboard/get-filtered-usage-events': NO_EVENTS,
      '/api/usage-summary': PRO_PLUS_SUMMARY,
    });

    const usage = await fetchCursorSessionUsage();

    expect(usage.status).toBe('ok');
    expect(usage.subscription).toEqual({
      mode: 'subscription',
      plan: { id: 'pro-plus', label: 'Pro+' },
      windows: [
        { key: 'month', label: 'Monthly usage', percent: 67.4663951120163, resetAt: CYCLE_END },
        { key: 'month-auto', label: 'Auto', percent: 66.685, resetAt: CYCLE_END },
        { key: 'month-api', label: 'API', percent: 100, resetAt: CYCLE_END },
      ],
      source: 'account',
    });
    expect(usage.window).toMatchObject({ label: 'Plan usage', percent: 67.4663951120163 });
    // The summary already answered, so the old request counter is not asked at all.
    expect(cursor.asked('/api/usage')).toBe(false);
  });

  it('signs the summary request with the Cursor session, as the dashboard does', async () => {
    const cursor = fakeCursor({
      '/api/dashboard/get-filtered-usage-events': NO_EVENTS,
      '/api/usage-summary': PRO_PLUS_SUMMARY,
    });

    await fetchCursorSessionUsage();

    const call = cursor.fetchMock.mock.calls.find(
      ([u]) => new URL(String(u)).pathname === '/api/usage-summary',
    );
    const headers = call?.[1]?.headers as Record<string, string>;
    expect(call?.[1]?.method).toBe('GET');
    expect(headers.Cookie).toBe(
      `WorkosCursorSessionToken=${encodeURIComponent('auth0|user_test::session-token')}`,
    );
  });

  it('falls back to the request quota of a plan the summary has no limits for', async () => {
    const cursor = fakeCursor({
      '/api/dashboard/get-filtered-usage-events': NO_EVENTS,
      '/api/usage-summary': 500,
      '/api/usage': {
        'gpt-4': { numRequests: 125, maxRequestUsage: 500, numTokens: 0 },
        startOfMonth: '2026-09-22T11:34:38.000Z',
      },
    });

    const usage = await fetchCursorSessionUsage();

    expect(cursor.asked('/api/usage')).toBe(true);
    // The quota rolls over a month after the period start Cursor reported.
    expect(usage.subscription?.windows).toEqual([
      { key: 'month', label: 'Monthly requests', percent: 25, resetAt: CYCLE_END },
    ]);
    expect(usage.window).toMatchObject({ label: 'Requests', used: 125, total: 500 });
  });

  it('keeps the plan badge but shows no limit on an unlimited plan', async () => {
    fakeCursor({
      '/api/dashboard/get-filtered-usage-events': NO_EVENTS,
      '/api/usage-summary': { ...PRO_PLUS_SUMMARY, isUnlimited: true },
      '/api/usage': { 'gpt-4': { numRequests: 0, maxRequestUsage: null }, startOfMonth: null },
    });

    const usage = await fetchCursorSessionUsage();

    expect(usage.subscription?.plan).toEqual({ id: 'pro-plus', label: 'Pro+' });
    expect(usage.subscription?.windows).toEqual([]);
    expect(usage.window).toBeUndefined();
  });

  it('still loads the card when both limit endpoints fail', async () => {
    fakeCursor({
      '/api/dashboard/get-filtered-usage-events': NO_EVENTS,
      '/api/usage-summary': new Error('handshake timed out'),
      '/api/usage': new Error('handshake timed out'),
    });

    const usage = await fetchCursorSessionUsage();

    expect(usage.status).toBe('ok');
    expect(usage.subscription?.windows).toEqual([]);
  });

  it('fails the card when the event feed itself is rejected', async () => {
    fakeCursor({
      '/api/dashboard/get-filtered-usage-events': 401,
      '/api/usage-summary': PRO_PLUS_SUMMARY,
    });

    await expect(fetchCursorSessionUsage()).rejects.toThrow(/Sign in to the Cursor app again/);
  });

  it('asks to sign in, without calling Cursor, when nobody is signed in', async () => {
    account.current = { ...account.current, accessToken: null, signedOut: true };
    const cursor = fakeCursor({});

    const usage = await fetchCursorSessionUsage();

    expect(usage.status).toBe('connect');
    expect(cursor.fetchMock).not.toHaveBeenCalled();
  });
});
