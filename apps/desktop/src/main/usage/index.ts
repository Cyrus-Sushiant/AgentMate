import {
  getUsageProvider,
  USAGE_PROVIDER_REGISTRY,
  type ProviderUsage,
  type UsageProviderConfig,
} from '@agentmat/core';
import { clearLiveWindowCache } from './claudeAccount';
import { scanLocalProvider } from './localScanner';
import type { LocalLogProvider } from './logParsers';
import { fetchApiProviderUsage } from './apiProviders';
import { connectUsage, errorUsage } from './shared';

const CACHE_TTL_MS = 30_000;

const LOCAL_LOG_PROVIDERS = new Set<string>(['claude-code', 'codex']);

interface CacheEntry {
  at: number;
  promise: Promise<ProviderUsage>;
}
const cache = new Map<string, CacheEntry>();

async function computeUsage(
  providerId: string,
  config: UsageProviderConfig | undefined,
): Promise<ProviderUsage> {
  const def = getUsageProvider(providerId);
  if (!def) return connectUsage(providerId);

  switch (def.dataSource) {
    case 'local-log':
      if (!LOCAL_LOG_PROVIDERS.has(providerId)) return connectUsage(providerId);
      return scanLocalProvider(providerId as LocalLogProvider);
    case 'api-key':
      return fetchApiProviderUsage(providerId, config);
    default:
      return connectUsage(providerId);
  }
}

/** Cached per-provider usage. Local-log scans and API calls are memoized ~30s. */
export function getProviderUsage(
  providerId: string,
  config: UsageProviderConfig | undefined,
  force = false,
): Promise<ProviderUsage> {
  const cached = cache.get(providerId);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.promise;
  }
  const promise = computeUsage(providerId, config).then(
    (usage) => {
      // Start the TTL when the scan finishes, not when it started — otherwise a
      // scan slower than the TTL is stale the moment it lands and we rescan
      // on every single poll.
      const entry = cache.get(providerId);
      if (entry?.promise === promise) entry.at = Date.now();
      return usage;
    },
    (err: unknown) => {
      cache.delete(providerId); // don't cache a hard failure
      throw err;
    },
  );
  cache.set(providerId, { at: Date.now(), promise });
  return promise;
}

/**
 * Usage for every provider the user has enabled. Local-log providers
 * (Claude Code, Codex) are always included since they need no config.
 * One provider failing must not blank out the others, so failures are folded
 * into that provider's own card as an error state.
 */
export async function getAllUsage(
  configs: Record<string, UsageProviderConfig>,
  force = false,
): Promise<ProviderUsage[]> {
  const targets = USAGE_PROVIDER_REGISTRY.filter((def) => {
    if (def.dataSource === 'local-log') return true;
    return configs[def.id]?.enabled;
  });

  const settled = await Promise.allSettled(
    targets.map((def) => getProviderUsage(def.id, configs[def.id], force)),
  );

  return settled.map((outcome, i) => {
    const def = targets[i];
    if (outcome.status === 'fulfilled') return outcome.value;
    const reason = outcome.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    // eslint-disable-next-line no-console
    console.warn(`[usage] ${def.id} failed:`, reason);
    return errorUsage(def.id, message);
  });
}

export function clearUsageCache(): void {
  cache.clear();
  clearLiveWindowCache();
}
