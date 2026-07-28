import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  USAGE_PROVIDER_REGISTRY,
  getUsageProvider,
  isAutoConnected,
  type ProviderUsage,
  type UsageProviderConfig,
} from '@agentmat/core';
import { queryKeys } from '@/lib/queryKeys';

function isDisplayed(id: string, configs: Record<string, UsageProviderConfig>): boolean {
  const def = getUsageProvider(id);
  if (!def) return false;
  if (isAutoConnected(def)) return true;
  return !!configs[id]?.enabled;
}

export interface UsageSummary {
  todayTokens: number;
  weekTokens: number;
  cost: number;
  trackedCount: number;
  totalCount: number;
  isPending: boolean;
}

/**
 * Aggregate Token Usage totals across every tracked provider — the same
 * numbers the Usage page's summary tiles show, computed independently so the
 * dashboard's pinned copies of those tiles don't depend on that page being
 * mounted.
 */
export function useUsageSummary(enabled = true): UsageSummary {
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
    enabled,
  });
  const usageQuery = useQuery({
    queryKey: queryKeys.usageList,
    queryFn: () => window.agentmat.usage.list(),
    refetchInterval: 45_000,
    enabled,
  });

  const configs = settingsQuery.data?.usageProviderConfigs ?? {};
  const displayedIds = useMemo(
    () => USAGE_PROVIDER_REGISTRY.filter((d) => isDisplayed(d.id, configs)).map((d) => d.id),
    [configs],
  );
  const usageById = useMemo(() => {
    const map = new Map<string, ProviderUsage>();
    for (const u of usageQuery.data ?? []) map.set(u.providerId, u);
    return map;
  }, [usageQuery.data]);

  const totals = useMemo(() => {
    let todayTokens = 0;
    let weekTokens = 0;
    let cost = 0;
    for (const id of displayedIds) {
      const u = usageById.get(id);
      if (!u || u.status !== 'ok') continue;
      todayTokens += u.today.tokens.total;
      weekTokens += u.last7d.tokens.total;
      cost += u.today.costUsd ?? 0;
    }
    return { todayTokens, weekTokens, cost };
  }, [displayedIds, usageById]);

  return {
    ...totals,
    trackedCount: displayedIds.length,
    totalCount: USAGE_PROVIDER_REGISTRY.length,
    isPending: usageQuery.isPending || settingsQuery.isPending,
  };
}
