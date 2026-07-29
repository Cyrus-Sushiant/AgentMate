import {
  type ProviderUsage,
  type SubscriptionUsage,
  type SubscriptionWindow,
  type UsageWindow,
} from '@agentmat/core';
import { getCursorAccount } from './cursorAccount';
import {
  accumulate,
  buildSeries,
  startOfLocalDay,
  toEntry,
  type CursorEntry,
  type CursorUsageEvent,
} from './cursor';
import { connectUsage } from './shared';

// Cursor usage read through the session the Cursor app already holds, so the
// card connects itself the way Claude Code's does instead of asking for a key.
//
// This replaces the Admin-API path as the default for a practical reason: that
// endpoint (`/teams/filtered-usage-events`) needs a *team* Admin key, which an
// individual Pro subscriber cannot issue at all. The dashboard endpoints below
// are what Cursor's own web UI calls, so they work for exactly the accounts the
// Admin API locks out. They are not a published contract, so every field is
// parsed defensively, same posture as the Claude quota fetch.
//
// Two endpoints, deliberately weighted differently:
//   /api/dashboard/get-filtered-usage-events  the per-call feed. Carries the
//     same event shape as the Admin API, so the Auto+Composer / API split, the
//     periods and the sparkline all reuse the parsing in `cursor.ts`.
//   /api/usage                                the plan's request quota, used
//     only for the limit bar, so it fails quietly.
//
// Cost comes from the events themselves (Cursor prices each call in `totalCents`),
// so no separate invoice call is needed.

const BASE_URL = 'https://cursor.com';
const TIMEOUT_MS = 10_000;

/** Cursor's dashboard authenticates with a "<userId>::<jwt>" cookie. */
function sessionCookie(userId: string, token: string): string {
  return `WorkosCursorSessionToken=${encodeURIComponent(`${userId}::${token}`)}`;
}

async function request(path: string, cookie: string, body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      signal: controller.signal,
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        // Cursor CSRF-checks state-changing requests and answers a bare POST
        // with 403 "Invalid origin for state-changing request". Presenting the
        // dashboard's own origin is what makes the event feed readable at all.
        Origin: BASE_URL,
        Referer: `${BASE_URL}/dashboard`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Cursor session rejected. Sign in to the Cursor app again.');
    }
    if (!res.ok) throw new Error(`Cursor returned HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const PAGE_SIZE = 1000;
/** Cap the paging loop. 30 days of heavy use, not an unbounded crawl. */
const MAX_PAGES = 20;

/**
 * Per-call usage events for the signed-in user. This is the dashboard's own
 * feed and carries the same event shape as the team Admin API, which is what
 * lets the Auto+Composer / API split be reused verbatim from {@link toEntry}.
 */
async function fetchEvents(cookie: string): Promise<CursorEntry[]> {
  const endDate = Date.now();
  const startDate = endDate - WINDOW_DAYS * DAY_MS;
  const entries: CursorEntry[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = (await request('/api/dashboard/get-filtered-usage-events', cookie, {
      startDate,
      endDate,
      page,
      pageSize: PAGE_SIZE,
    })) as {
      /** The dashboard feed's name for the rows; the Admin API says `usageEvents`. */
      usageEventsDisplay?: CursorUsageEvent[];
      usageEvents?: CursorUsageEvent[];
      totalUsageEventsCount?: number;
    };

    const events = Array.isArray(data?.usageEventsDisplay)
      ? data.usageEventsDisplay
      : Array.isArray(data?.usageEvents)
        ? data.usageEvents
        : [];
    for (const event of events) {
      const entry = toEntry(event);
      if (entry) entries.push(entry);
    }

    // This feed reports a grand total instead of a pagination block, so paging
    // is driven by how many rows we've actually taken.
    const total = data?.totalUsageEventsCount;
    const more = typeof total === 'number' ? page * PAGE_SIZE < total : false;
    if (!more || events.length === 0) break;
  }
  return entries;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** First present numeric field among `names`, accepting snake and camel case. */
function pick(node: Record<string, unknown>, names: string[]): number | null {
  for (const name of names) {
    const direct = num(node[name]);
    if (direct != null) return direct;
    const snake = name.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    const snakeVal = num(node[snake]);
    if (snakeVal != null) return snakeVal;
  }
  return null;
}

interface ModelBucket {
  requests: number;
  maxRequests: number | null;
  tokens: number;
}

/**
 * `/api/usage` answers with one object per model bucket plus a `startOfMonth`
 * marker, e.g. `{ "gpt-4": { numRequests, maxRequestUsage, numTokens }, … }`.
 * Rather than binding to today's bucket names, take any child object that
 * carries a request count, so new model buckets then count automatically.
 */
function collectBuckets(payload: unknown): { buckets: ModelBucket[]; startOfMonth: string | null } {
  const buckets: ModelBucket[] = [];
  let startOfMonth: string | null = null;

  if (payload === null || typeof payload !== 'object') return { buckets, startOfMonth };
  const root = payload as Record<string, unknown>;

  const rawStart = root.startOfMonth ?? root.start_of_month;
  if (typeof rawStart === 'string' && !Number.isNaN(Date.parse(rawStart))) {
    startOfMonth = new Date(rawStart).toISOString();
  }

  for (const value of Object.values(root)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
    const node = value as Record<string, unknown>;
    const requests = pick(node, ['numRequests', 'numRequestsTotal']);
    const tokens = pick(node, ['numTokens']);
    if (requests == null && tokens == null) continue;
    buckets.push({
      requests: requests ?? 0,
      maxRequests: pick(node, ['maxRequestUsage']),
      tokens: tokens ?? 0,
    });
  }
  return { buckets, startOfMonth };
}

function monthResetAt(startOfMonth: string | null): string | null {
  const start = startOfMonth ? Date.parse(startOfMonth) : Date.now();
  if (Number.isNaN(start)) return null;
  const d = new Date(start);
  // Cursor's quota rolls on the subscription anniversary, one month from the
  // period start it reported.
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/**
 * Live Cursor usage for the signed-in desktop app. Returns a `connect` snapshot,
 * not an error, when Cursor isn't installed or nobody is signed in, because
 * those are setup states the card already renders an action for.
 */
export async function fetchCursorSessionUsage(): Promise<ProviderUsage> {
  const account = getCursorAccount();
  if (!account.accessToken || !account.userId) return connectUsage('cursor');

  const cookie = sessionCookie(account.userId, account.accessToken);

  // The event feed is the substance of the card: tokens, cost, the
  // Auto+Composer/API split and the sparkline all come from it, so a failure
  // here is a real error rather than something to paper over.
  const entries = await fetchEvents(cookie);
  const now = Date.now();

  // The plan quota lives on a different endpoint and only decorates the card
  // with a limit bar, so it degrades quietly to "no window" if it moves.
  let quota: { requests: number; maxRequests: number | null; startOfMonth: string | null } = {
    requests: 0,
    maxRequests: null,
    startOfMonth: null,
  };
  try {
    const payload = await request(`/api/usage?user=${encodeURIComponent(account.userId)}`, cookie);
    const { buckets, startOfMonth } = collectBuckets(payload);
    quota = {
      requests: buckets.reduce((sum, b) => sum + b.requests, 0),
      // Only the plan bucket is capped; usage-based ones report no maximum.
      maxRequests: buckets.reduce<number | null>(
        (max, b) => (b.maxRequests != null && b.maxRequests > (max ?? 0) ? b.maxRequests : max),
        null,
      ),
      startOfMonth,
    };
  } catch {
    /* limit bar is optional */
  }

  const resetAt = monthResetAt(quota.startOfMonth);

  let window: UsageWindow | undefined;
  const subscriptionWindows: SubscriptionWindow[] = [];
  if (quota.maxRequests != null && quota.maxRequests > 0) {
    const percent = Math.max(0, Math.min(100, (quota.requests / quota.maxRequests) * 100));
    window = {
      label: 'Requests',
      used: quota.requests,
      total: quota.maxRequests,
      percent,
      resetAt,
    };
    subscriptionWindows.push({ key: 'month', label: 'Monthly requests', percent, resetAt });
  }

  // The plan badge should show even on an account with no metered request cap,
  // so the subscription block hangs off the plan, not off the windows.
  const subscription: SubscriptionUsage | undefined = account.plan
    ? { mode: 'subscription', plan: account.plan, windows: subscriptionWindows, source: 'account' }
    : undefined;

  return {
    providerId: 'cursor',
    status: 'ok',
    today: accumulate(entries, startOfLocalDay(now)),
    last7d: accumulate(entries, now - 7 * DAY_MS),
    last30d: accumulate(entries, now - WINDOW_DAYS * DAY_MS),
    window,
    subscription,
    series: buildSeries(entries),
    currency: 'USD',
    updatedAt: new Date(now).toISOString(),
  };
}
