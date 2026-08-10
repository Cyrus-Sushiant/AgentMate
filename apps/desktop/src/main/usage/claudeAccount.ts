import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  FABLE_WEEK_LABEL,
  metersFableWeekly,
  type SubscriptionPlan,
  type SubscriptionWindow,
  type UsageAccountMode,
} from '@agentmat/core';

// Claude Code account detection. Two questions to answer before the Usage card
// can show anything subscription-shaped:
//
//   1. Is this account on a subscription, or billing an API key? Subscription
//      users care about "how much of my 5-hour window is left"; API users care
//      about tokens and dollars, which the existing card already shows.
//   2. Which plan, so the window labels and the local estimate's budgets match.
//
// Both come off disk with no network: `~/.claude/.credentials.json` holds the
// OAuth grant and `~/.claude.json` holds the account profile the CLI caches.
// Only the profile is a live answer to question 2. The credentials file records
// `subscriptionType` once, at login, and leaves it there, so it's the fallback.

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
      continue; // missing, unreadable, or malformed, try the next location
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
    /** Plan family as the account service reports it: 'claude_max', 'claude_pro'. */
    organizationType?: string;
    /** Tier the org's limits come from: 'default_claude_max_5x', 'default_claude_ai'. */
    organizationRateLimitTier?: string;
    /** Set when the member's own tier overrides the org's. Usually null. */
    userRateLimitTier?: string;
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
   * this, so the boundary has to be a date that never moves. Unlike the oldest
   * surviving log entry, that one walks forward as transcripts age out.
   */
  weeklyAnchor: number | null;
}

/**
 * Drop the decoration the account service puts on plan and tier strings so both
 * can be matched against one vocabulary: 'claude_max' and 'default_claude_max_5x'
 * both reduce to something starting with 'max'.
 */
function stripPlanPrefix(raw?: string): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^default_/, '')
    .replace(/^claude_/, '');
}

/**
 * Turn a plan-family string + a rate-limit tier into a display plan. The tier is
 * what distinguishes the Max levels ('…max_5x' / '…max_20x'); an unrecognized
 * family still yields a capitalized label rather than nothing, so a new plan name
 * shows up as itself instead of disappearing.
 */
function resolvePlan(subscriptionType?: string, rateLimitTier?: string): SubscriptionPlan | null {
  const type = stripPlanPrefix(subscriptionType);
  if (!type) return null;

  if (type.startsWith('max')) {
    // The multiplier lives in either field depending on CLI version.
    const source = `${type} ${stripPlanPrefix(rateLimitTier)}`;
    if (source.includes('20x')) return { id: 'max20x', label: 'Max 20×' };
    if (source.includes('5x')) return { id: 'max5x', label: 'Max 5×' };
    return { id: 'max', label: 'Max' };
  }
  if (type === 'pro') return { id: 'pro', label: 'Pro' };
  if (type === 'team') return { id: 'team', label: 'Team' };
  if (type === 'enterprise') return { id: 'enterprise', label: 'Enterprise' };
  return { id: type, label: type.charAt(0).toUpperCase() + type.slice(1) };
}

const KNOWN_PLAN_IDS = new Set(['pro', 'max', 'max5x', 'max20x', 'team', 'enterprise']);

/**
 * Same as {@link resolvePlan} but refuses to guess. The profile's fields carry
 * values that aren't plan names at all ('default_claude_ai'), and capitalizing
 * one of those into a label would read as a plan the user has never heard of, so
 * anything unrecognized falls through to the next source instead.
 */
function resolveKnownPlan(
  subscriptionType?: string,
  rateLimitTier?: string,
): SubscriptionPlan | null {
  const plan = resolvePlan(subscriptionType, rateLimitTier);
  return plan && KNOWN_PLAN_IDS.has(plan.id) ? plan : null;
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
 * because the CLI itself prefers it when both are present, so the card matches
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
  const account = profile?.oauthAccount;

  // Plan, best source first:
  //  1. A seat on a Team/Enterprise workspace reports its own tier, and that's
  //     the plan whose limits actually apply.
  //  2. The org fields, which the CLI re-fetches with the profile and so track
  //     upgrades and downgrades.
  //  3. The credentials file, last. `subscriptionType` is written at login and
  //     never rewritten on a token refresh, so after an upgrade it keeps
  //     reporting the plan the account was on when it first signed in.
  const plan =
    resolveKnownPlan(account?.seatTier, account?.userRateLimitTier) ??
    resolveKnownPlan(
      account?.organizationType,
      account?.userRateLimitTier ?? account?.organizationRateLimitTier,
    ) ??
    resolvePlan(oauth?.subscriptionType, oauth?.rateLimitTier);

  if (!oauth?.subscriptionType && !plan) {
    return {
      mode: hasApiKeyBilling() ? 'api' : 'subscription',
      plan: null,
      accessToken: null,
      tokenExpired: false,
      weeklyAnchor,
    };
  }

  const expired = typeof oauth?.expiresAt === 'number' && oauth.expiresAt <= Date.now();

  return {
    mode: 'subscription',
    plan,
    accessToken: expired ? null : (oauth?.accessToken ?? null),
    tokenExpired: expired,
    weeklyAnchor,
  };
}

// --- live quota fetch -----------------------------------------------------

// The CLI's own `/usage` reads the account's unified rate limits, keyed by
// window: a 5-hour session bucket, a rolling 7-day bucket, and (above Pro) a
// separate 7-day bucket for the top model. The response shape isn't a published
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
  seven_day_fable: { key: 'week-fable', label: FABLE_WEEK_LABEL },
  sevendayfable: { key: 'week-fable', label: FABLE_WEEK_LABEL },
  week_fable: { key: 'week-fable', label: FABLE_WEEK_LABEL },
  // Same bucket, older spelling: it was the Opus-only weekly limit before Fable
  // took the top slot, and payloads in the wild still name it that way.
  seven_day_opus: { key: 'week-fable', label: FABLE_WEEK_LABEL },
  sevendayopus: { key: 'week-fable', label: FABLE_WEEK_LABEL },
  week_opus: { key: 'week-fable', label: FABLE_WEEK_LABEL },
};

/** Newer payloads list the same windows as a flat `limits` array instead. */
const LIMIT_KINDS: Record<string, SubscriptionWindow['key']> = {
  session: 'session',
  weekly_all: 'week',
  weekly_scoped: 'week-fable',
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
 * Label for a `limits` entry. The scoped weekly window names the model it meters,
 * so read it off the payload rather than hardcoding today's top model, and fall
 * back to the constant when the scope is missing.
 */
function limitLabel(key: SubscriptionWindow['key'], node: Record<string, unknown>): string {
  if (key !== 'week-fable') return key === 'session' ? 'Session (5h)' : 'Weekly';
  const scope = node.scope as { model?: { display_name?: unknown } } | null | undefined;
  const model = scope?.model?.display_name;
  return typeof model === 'string' && model.trim() ? `Weekly (${model.trim()})` : FABLE_WEEK_LABEL;
}

/**
 * Walk the payload for objects sitting under a known window key that carry a
 * utilization number. Depth-limited so a surprising response can't send us
 * spelunking through a huge object graph.
 *
 * `fableWeek` gates the Fable bucket: on Pro the endpoint has been seen echoing
 * a zeroed one, and showing a bar for a limit the plan doesn't have reads as
 * headroom that isn't there.
 */
function collectWindows(payload: unknown, fableWeek: boolean): SubscriptionWindow[] {
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

  // Second pass over `limits`, filling only what the keys didn't cover. The
  // scoped weekly window lives here and nowhere else: the top-level bucket that
  // used to carry it (`seven_day_opus`) now comes back null, so without this the
  // Fable bar would never appear for a plan that has one.
  const limits = (payload as { limits?: unknown } | null)?.limits;
  if (Array.isArray(limits)) {
    for (const entry of limits) {
      if (entry === null || typeof entry !== 'object') continue;
      const node = entry as Record<string, unknown>;
      const key = typeof node.kind === 'string' ? LIMIT_KINDS[normalizeKey(node.kind)] : undefined;
      if (!key || found.has(key)) continue;
      const percent = readPercent(node);
      if (percent === null) continue;
      found.set(key, { key, label: limitLabel(key, node), percent, resetAt: readResetAt(node) });
    }
  }

  // Stable display order regardless of the order the payload listed them in.
  const order: SubscriptionWindow['key'][] = ['session', 'week', 'week-fable'];
  return order.flatMap((key) => {
    if (key === 'week-fable' && !fableWeek) return [];
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
async function fetchLiveWindows(
  accessToken: string,
  plan: SubscriptionPlan | null,
): Promise<SubscriptionWindow[] | null> {
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
    const windows = collectWindows(await res.json(), metersFableWeekly(plan));
    return windows.length > 0 ? windows : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Several widgets plus the Usage page all refresh independently, and a failing
// endpoint shouldn't be retried on every one of those ticks, so successes are
// held briefly and failures are backed off much harder.
const LIVE_TTL_OK_MS = 60_000;
const LIVE_TTL_FAIL_MS = 300_000;

let liveCache: { at: number; windows: SubscriptionWindow[] | null } | null = null;

/** Cached wrapper around {@link fetchLiveWindows}. */
export async function getLiveWindows(
  accessToken: string,
  plan: SubscriptionPlan | null,
): Promise<SubscriptionWindow[] | null> {
  const ttl = liveCache?.windows ? LIVE_TTL_OK_MS : LIVE_TTL_FAIL_MS;
  if (liveCache && Date.now() - liveCache.at < ttl) return liveCache.windows;
  const windows = await fetchLiveWindows(accessToken, plan);
  liveCache = { at: Date.now(), windows };
  return windows;
}

/** Drop the cached quota so an explicit Refresh re-hits the account. */
export function clearLiveWindowCache(): void {
  liveCache = null;
}
