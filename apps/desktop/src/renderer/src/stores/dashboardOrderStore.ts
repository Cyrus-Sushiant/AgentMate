import { create } from 'zustand';

export const DASHBOARD_CHART_IDS = ['cpu', 'memory', 'disk', 'gpu', 'network', 'pings'] as const;
export type DashboardChartId = (typeof DASHBOARD_CHART_IDS)[number];

interface DashboardOrderState {
  order: DashboardChartId[];
  setOrder: (order: DashboardChartId[]) => void;
}

// Keeps only known chart ids (drops ones removed since the order was saved)
// and appends any new chart ids that didn't exist yet, so upgrades don't
// silently hide newly added charts.
function sanitizeOrder(order: string[] | undefined): DashboardChartId[] {
  const known = new Set<string>(DASHBOARD_CHART_IDS);
  const kept = (order ?? []).filter((id): id is DashboardChartId => known.has(id));
  const missing = DASHBOARD_CHART_IDS.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export const useDashboardOrderStore = create<DashboardOrderState>((set) => ({
  order: [...DASHBOARD_CHART_IDS],
  setOrder: (order) => {
    set({ order });
    void window.agentmat.settings.update({ dashboardChartOrder: order });
  },
}));

export async function initDashboardOrder(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  useDashboardOrderStore.setState({ order: sanitizeOrder(settings.dashboardChartOrder) });
}
