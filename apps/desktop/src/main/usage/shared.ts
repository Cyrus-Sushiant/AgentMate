import {
  emptyUsageTokens,
  estimateCost,
  type ProviderUsage,
  type UsagePeriod,
  type UsageTokens,
  type UsageWindow,
} from '@agentmat/core';

/** One priced token event, produced by a local-log scanner. */
export interface UsageEntry {
  at: Date;
  model: string;
  tokens: UsageTokens;
}

const DAY_MS = 86_400_000;

function addInto(target: UsageTokens, src: UsageTokens): void {
  target.input += src.input;
  target.output += src.output;
  target.cacheRead += src.cacheRead;
  target.cacheWrite += src.cacheWrite;
  target.total += src.total;
}

export function makeTokens(
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite: number,
): UsageTokens {
  return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite };
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function accumulatePeriod(entries: UsageEntry[], sinceMs: number): UsagePeriod {
  const tokens = emptyUsageTokens();
  let cost = 0;
  let priced = false;
  for (const entry of entries) {
    if (entry.at.getTime() < sinceMs) continue;
    addInto(tokens, entry.tokens);
    const c = estimateCost(entry.model, entry.tokens);
    if (c != null) {
      cost += c;
      priced = true;
    }
  }
  return { tokens, costUsd: priced ? cost : null };
}

const SERIES_DAYS = 14;

/** Daily token totals for the last 14 days (oldest first) for the sparkline. */
function buildSeries(entries: UsageEntry[]): number[] {
  const startToday = startOfLocalDay(Date.now());
  const buckets = new Array<number>(SERIES_DAYS).fill(0);
  for (const entry of entries) {
    const dayIdx = Math.floor((startToday - startOfLocalDay(entry.at.getTime())) / DAY_MS);
    const idx = SERIES_DAYS - 1 - dayIdx;
    if (idx >= 0 && idx < SERIES_DAYS) buckets[idx] += entry.tokens.total;
  }
  return buckets;
}

/** Fold a list of priced token events into the normalized ProviderUsage shape. */
export function buildUsageFromEntries(
  providerId: string,
  entries: UsageEntry[],
  window?: UsageWindow,
): ProviderUsage {
  const now = Date.now();
  const startToday = startOfLocalDay(now);
  return {
    providerId,
    status: 'ok',
    today: accumulatePeriod(entries, startToday),
    last7d: accumulatePeriod(entries, now - 7 * DAY_MS),
    last30d: accumulatePeriod(entries, now - 30 * DAY_MS),
    window,
    series: buildSeries(entries),
    currency: 'USD',
    updatedAt: new Date(now).toISOString(),
  };
}

/** Empty "connect me" snapshot for providers with no wired source / no key. */
export function connectUsage(providerId: string): ProviderUsage {
  const empty: UsagePeriod = { tokens: emptyUsageTokens(), costUsd: null };
  return {
    providerId,
    status: 'connect',
    today: empty,
    last7d: empty,
    last30d: empty,
    currency: 'USD',
    updatedAt: new Date().toISOString(),
  };
}

export function errorUsage(providerId: string, message: string): ProviderUsage {
  const empty: UsagePeriod = { tokens: emptyUsageTokens(), costUsd: null };
  return {
    providerId,
    status: 'error',
    error: message,
    today: empty,
    last7d: empty,
    last30d: empty,
    currency: 'USD',
    updatedAt: new Date().toISOString(),
  };
}
