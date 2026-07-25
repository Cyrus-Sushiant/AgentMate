import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SubscriptionPlan, SubscriptionWindow, UsageAccountMode } from '@agentmat/core';

// Claude Code account detection. Two questions to answer before the Usage card
// can show anything subscription-shaped:
//
//   1. Is this account on a subscription, or billing an API key? Subscription
//      users care about "how much of my 5-hour window is left"; API users care
//      about tokens and dollars, which the existing card already shows.
//   2. Which plan, so the window labels and the local estimate's budgets match.
//
// Both come off disk with no network: `~/.claude/.credentials.json` holds the
// OAuth grant (including `subscriptionType`) and `~/.claude.json` holds the
// profile the CLI cached at login.

const CLAUDE_DIR_ENV = 'CLAUDE_CONFIG_DIR';

/** Every credential file location the CLI might have written, best first. */
function credentialPaths(): string[] {
  const paths: string[] = [];
  const override = process.env[CLAUDE_DIR_ENV];
  if (override) paths.push(join(override, '.credentials.json'));
  paths.push(join(homedir(), '.claude', '.credentials.json'));
  paths.push(join(homedir(), '.config', 'claude', '.credentials.json'));
  return paths;
}

function profilePaths(): string[] {
  const paths: string[] = [];
  const override = process.env[CLAUDE_DIR_ENV];
  if (override) paths.push(join(override, '.claude.json'));
  paths.push(join(homedir(), '.claude.json'));
  paths.push(join(homedir(), '.config', 'claude', '.claude.json'));
  return paths;
}

async function readJson<T>(paths: string[]): Promise<T | null> {
  for (const path of paths) {
    try {
      return JSON.parse(await readFile(path, 'utf-8')) as T;
    } catch {
      continue; // missing, unreadable, or malformed — try the next location
    }
  }
  return null;
}

interface CredentialsFile {
  claudeAiOauth?: {
    accessToken?: string;
    expiresAt?: number;
    subscriptionType?: string;
    rateLimitTier?: string;
  };
}

interface ProfileFile {
  oauthAccount?: {
    billingType?: string;
    organizationName?: string;
    seatTier?: string;
  };
  /** ISO date of the account's very first Claude Code token. */
  claudeCodeFirstTokenDate?: string;
  hasAvailableSubscription?: boolean;
}

export interface ClaudeAccount {
  mode: UsageAccountMode;
  plan: SubscriptionPlan | null;
  /** OAuth bearer for the live quota fetch. Never leaves the main process. */
  accessToken: string | null;
  /** True when the stored grant has expired and needs a CLI re-login. */
  tokenExpired: boolean;
  /**
   * Epoch ms of first-ever usage. The weekly estimate phases its window off
   * this, so the boundary has to be a date that never moves — unlike the oldest
   * surviving log entry, which walks forward as transcripts age out.
   */
  weeklyAnchor: number | null;
}

/**
 * Turn the raw `subscriptionType` + `rateLimitTier` pair into a display plan.
 * The tier string is what distinguishes the Max levels ('…max_5x' / '…max_20x');
 * an unrecognized type still yields a capitalized label rather than nothing, so
 * a new plan name shows up as itself instead of disappearing.
 */
function resolvePlan(subscriptionType?: string, rateLimitTier?: string): SubscriptionPlan | null {
  const type = subscriptionType?.trim().toLowerCase();
  if (!type) return null;
  const tier = rateLimitTier?.toLowerCase() ?? '';

  if (type === 'max' || type.startsWith('max')) {
    // The multiplier lives in either field depending on CLI version.
    const source = `${type} ${tier}`;
    if (source.includes('20x')) return { id: 'max20x', label: 'Max 20×' };
    if (source.includes('5x')) return { id: 'max5x', label: 'Max 5×' };
    return { id: 'max', label: 'Max' };
  }
  if (type === 'pro') return { id: 'pro', label: 'Pro' };
  if (type === 'team') return { id: 'team', label: 'Team' };
  if (type === 'enterprise') return { id: 'enterprise', label: 'Enterprise' };
  return { id: type, label: type.charAt(0).toUpperCase() + type.slice(1) };
}

/** True when the CLI is configured to bill an API key / cloud vendor instead. */
function hasApiKeyBilling(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.CLAUDE_CODE_USE_BEDROCK ||
      process.env.CLAUDE_CODE_USE_VERTEX,
  );
}

/**
 * Read the local Claude Code account state. An OAuth grant wins over an API key
 * because the CLI itself prefers it when both are present — so the card matches
 * what the user is actually being billed under.
 */
export async function readClaudeAccount(): Promise<ClaudeAccount> {
  const creds = await readJson<CredentialsFile>(credentialPaths());
  const profile = await readJson<ProfileFile>(profilePaths());
  const firstToken = profile?.claudeCodeFirstTokenDate
    ? Date.parse(profile.claudeCodeFirstTokenDate)
    : NaN;
  const weeklyAnchor = Number.isNaN(firstToken) ? null : firstToken;
  const oauth = creds?.claudeAiOauth;

  if (!oauth?.subscriptionType) {
    return {
      mode: hasApiKeyBilling() ? 'api' : 'subscription',
      plan: null,
      accessToken: null,
      tokenExpired: false,
      weeklyAnchor,
    };
  }

  const plan = resolvePlan(oauth.subscriptionType, oauth.rateLimitTier);
  // A seat on a Team/Enterprise workspace reports its own tier; prefer it since
  // it's the plan whose limits actually apply.
  const seatTier = profile?.oauthAccount?.seatTier;
  const expired = typeof oauth.expiresAt === 'number' && oauth.expiresAt <= Date.now();

  return {
    mode: 'subscription',
    plan: seatTier ? (resolvePlan(seatTier) ?? plan) : plan,
    accessToken: expired ? null : (oauth.accessToken ?? null),
    tokenExpired: expired,
    weeklyAnchor,
  };
}

// --- live quota fetch -----------------------------------------------------

// The CLI's own `/usage` reads the account's unified rate limits, keyed by
// window: a 5-hour session bucket, a rolling 7-day bucket, and a separate 7-day
// bucket for Opus on plans that meter it. The response shape isn't a published
// contract, so parsing is deliberately loose: we look for the known window keys
// anywhere in the payload and accept any of the spellings seen in the wild
// rather than binding to one exact schema.

const USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const FETCH_TIMEOUT_MS = 8_000;

const WINDOW_LABELS: Record<string, { key: SubscriptionWindow['key']; label: string }> = {
  five_hour: { key: 'session', label: 'Session (5h)' },
  fivehour: { key: 'session', label: 'Session (5h)' },
  session: { key: 'session', label: 'Session (5h)' },
  seven_day: { key: 'week', label: 'Weekly' },
  sevenday: { key: 'week', label: 'Weekly' },
  week: { key: 'week', label: 'Weekly' },
  seven_day_opus: { key: 'week-opus', label: 'Weekly (Opus)' },
  sevendayopus: { key: 'week-opus', label: 'Weekly (Opus)' },
  week_opus: { key: 'week-opus', label: 'Weekly (Opus)' },
};

function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s-]/g, '_');
}

/** Pull a 0–100 utilization out of whichever field name the payload uses. */
function readPercent(node: Record<string, unknown>): number | null {
  for (const field of ['utilization', 'used_percent', 'usedPercent', 'percent', 'percent_used']) {
    const value = node[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      // Some payloads express utilization as a 0–1 fraction.
      const percent = value > 0 && value <= 1 ? value * 100 : value;
      return Math.max(0, Math.min(100, percent));
    }
  }
  return null;
}

/** Pull a reset timestamp, accepting both ISO strings and unix seconds. */
function readResetAt(node: Record<string, unknown>): string | null {
  for (const field of ['resets_at', 'resetsAt', 'reset_at', 'resetAt', 'expires_at']) {
    const value = node[field];
    if (typeof value === 'string') {
      const ms = Date.parse(value);
      if (!Number.isNaN(ms)) return new Date(ms).toISOString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      // Seconds vs milliseconds: anything below ~year 2300 in ms is seconds.
      const ms = value < 1e12 ? value * 1000 : value;
      return new Date(ms).toISOString();
    }
  }
  return null;
}

/**
 * Walk the payload for objects sitting under a known window key that carry a
 * utilization number. Depth-limited so a surprising response can't send us
 * spelunking through a huge object graph.
 */
function collectWindows(payload: unknown): SubscriptionWindow[] {
  const found = new Map<string, SubscriptionWindow>();

  function visit(node: unknown, depth: number): void {
    if (depth > 5 || node === null || typeof node !== 'object') return;
    for (const [rawKey, value] of Object.entries(node as Record<string, unknown>)) {
      if (value === null || typeof value !== 'object') continue;
      const match = WINDOW_LABELS[normalizeKey(rawKey)];
      const percent = match ? readPercent(value as Record<string, unknown>) : null;
      if (match && percent !== null && !found.has(match.key)) {
        found.set(match.key, {
          key: match.key,
          label: match.label,
          percent,
          resetAt: readResetAt(value as Record<string, unknown>),
        });
      }
      visit(value, depth + 1);
    }
  }

  visit(payload, 0);

  // Stable display order regardless of the order the payload listed them in.
  const order: SubscriptionWindow['key'][] = ['session', 'week', 'week-opus'];
  return order.flatMap((key) => {
    const window = found.get(key);
    return window ? [window] : [];
  });
}

/**
 * Authoritative window state for the signed-in account, or null when it can't
 * be had (offline, expired grant, endpoint moved). Never throws: the caller
 * falls back to the local estimate, and a quota widget that silently degrades
 * beats one that shows an error.
 */
async function fetchLiveWindows(accessToken: string): Promise<SubscriptionWindow[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(USAGE_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const windows = collectWindows(await res.json());
    return windows.length > 0 ? windows : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Several widgets plus the Usage page all refresh independently, and a failing
// endpoint shouldn't be retried on every one of those ticks — so successes are
// held briefly and failures are backed off much harder.
const LIVE_TTL_OK_MS = 60_000;
const LIVE_TTL_FAIL_MS = 300_000;

let liveCache: { at: number; windows: SubscriptionWindow[] | null } | null = null;

/** Cached wrapper around {@link fetchLiveWindows}. */
export async function getLiveWindows(accessToken: string): Promise<SubscriptionWindow[] | null> {
  const ttl = liveCache?.windows ? LIVE_TTL_OK_MS : LIVE_TTL_FAIL_MS;
  if (liveCache && Date.now() - liveCache.at < ttl) return liveCache.windows;
  const windows = await fetchLiveWindows(accessToken);
  liveCache = { at: Date.now(), windows };
  return windows;
}

/** Drop the cached quota so an explicit Refresh re-hits the account. */
export function clearLiveWindowCache(): void {
  liveCache = null;
}
