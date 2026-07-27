import { create } from 'zustand';

export const DASHBOARD_CHART_IDS = ['cpu', 'memory', 'disk', 'gpu', 'network', 'pings'] as const;
export type DashboardChartId = (typeof DASHBOARD_CHART_IDS)[number];

/**
 * Token Usage provider cards can be added to the dashboard, where they share
 * the grid (and the drag-to-reorder order) with the built-in stat charts. They
 * are namespaced so a provider id can never collide with a chart id.
 */
const USAGE_PREFIX = 'usage:';
export type DashboardUsageId = `${typeof USAGE_PREFIX}${string}`;
export type DashboardItemId = DashboardChartId | DashboardUsageId;

export function usageItemId(providerId: string): DashboardUsageId {
  return `${USAGE_PREFIX}${providerId}`;
}

/** Provider id behind a usage item, or null for the built-in charts. */
export function usageProviderIdOf(id: DashboardItemId): string | null {
  return id.startsWith(USAGE_PREFIX) ? id.slice(USAGE_PREFIX.length) : null;
}

interface DashboardOrderState {
  order: DashboardItemId[];
  /** Provider ids the user added to the dashboard, in the order they were added. */
  usageCards: string[];
  setOrder: (order: DashboardItemId[]) => void;
  /** Adds or removes a Token Usage card; returns true when it's now shown. */
  toggleUsageCard: (providerId: string) => boolean;
}

// Keeps only ids that still exist (charts that were removed, or usage cards the
// user has since taken off the dashboard) and appends anything new, so upgrades
// and additions never silently hide a card.
function sanitizeOrder(order: string[] | undefined, usageCards: string[]): DashboardItemId[] {
  const all: DashboardItemId[] = [...DASHBOARD_CHART_IDS, ...usageCards.map(usageItemId)];
  const known = new Set<string>(all);
  const kept = (order ?? []).filter((id): id is DashboardItemId => known.has(id));
  const missing = all.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export const useDashboardOrderStore = create<DashboardOrderState>((set, get) => ({
  order: [...DASHBOARD_CHART_IDS],
  usageCards: [],
  setOrder: (order) => {
    set({ order });
    void window.agentmat.settings.update({ dashboardChartOrder: order });
  },
  toggleUsageCard: (providerId) => {
    const { order, usageCards } = get();
    const itemId = usageItemId(providerId);
    const added = !usageCards.includes(providerId);
    const nextCards = added
      ? [...usageCards, providerId]
      : usageCards.filter((id) => id !== providerId);
    // New cards land at the end of the grid; removing one leaves the rest put.
    const nextOrder = added ? [...order, itemId] : order.filter((id) => id !== itemId);
    set({ usageCards: nextCards, order: nextOrder });
    void window.agentmat.settings.update({
      dashboardChartOrder: nextOrder,
      dashboardUsageCards: nextCards,
    });
    return added;
  },
}));

export async function initDashboardOrder(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  const usageCards = settings.dashboardUsageCards ?? [];
  useDashboardOrderStore.setState({
    usageCards,
    order: sanitizeOrder(settings.dashboardChartOrder, usageCards),
  });
}
