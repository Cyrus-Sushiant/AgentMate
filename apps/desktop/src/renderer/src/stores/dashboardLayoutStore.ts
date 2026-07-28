import { create } from 'zustand';
import {
  DASHBOARD_COLUMN_OPTIONS,
  DASHBOARD_STAT_IDS,
  DASHBOARD_USAGE_SUMMARY_IDS,
  type DashboardColumns,
  type DashboardRow,
  type DashboardStatId,
  type DashboardUsageSummaryId,
} from '@agentmat/core';

export const DASHBOARD_CHART_IDS = ['cpu', 'memory', 'disk', 'gpu', 'network', 'pings'] as const;
export type DashboardChartId = (typeof DASHBOARD_CHART_IDS)[number];

/**
 * Token Usage provider cards, built-in stat tiles, and Token Usage summary
 * tiles can all be added to the dashboard, where they share the rows (and the
 * drag-to-rearrange layout) with the built-in charts. Each optional category
 * is namespaced so its ids can never collide with another category's.
 */
const USAGE_PREFIX = 'usage:';
const STAT_PREFIX = 'stat:';
const SUMMARY_PREFIX = 'summary:';
export type DashboardUsageId = `${typeof USAGE_PREFIX}${string}`;
export type DashboardStatItemId = `${typeof STAT_PREFIX}${DashboardStatId}`;
export type DashboardSummaryItemId = `${typeof SUMMARY_PREFIX}${DashboardUsageSummaryId}`;
export type DashboardItemId =
  | DashboardChartId
  | DashboardUsageId
  | DashboardStatItemId
  | DashboardSummaryItemId;

export function usageItemId(providerId: string): DashboardUsageId {
  return `${USAGE_PREFIX}${providerId}`;
}

/** Provider id behind a usage item, or null for anything else. */
export function usageProviderIdOf(id: DashboardItemId): string | null {
  return id.startsWith(USAGE_PREFIX) ? id.slice(USAGE_PREFIX.length) : null;
}

export function statItemId(id: DashboardStatId): DashboardStatItemId {
  return `${STAT_PREFIX}${id}`;
}

/** Stat id behind a stat item, or null for anything else. */
export function statIdOf(id: DashboardItemId): DashboardStatId | null {
  if (!id.startsWith(STAT_PREFIX)) return null;
  const rest = id.slice(STAT_PREFIX.length);
  return (DASHBOARD_STAT_IDS as readonly string[]).includes(rest)
    ? (rest as DashboardStatId)
    : null;
}

export function summaryItemId(id: DashboardUsageSummaryId): DashboardSummaryItemId {
  return `${SUMMARY_PREFIX}${id}`;
}

/** Usage-summary id behind a summary item, or null for anything else. */
export function summaryIdOf(id: DashboardItemId): DashboardUsageSummaryId | null {
  if (!id.startsWith(SUMMARY_PREFIX)) return null;
  const rest = id.slice(SUMMARY_PREFIX.length);
  return (DASHBOARD_USAGE_SUMMARY_IDS as readonly string[]).includes(rest)
    ? (rest as DashboardUsageSummaryId)
    : null;
}

const DEFAULT_COLUMNS: DashboardColumns = 2;

interface DashboardLayoutState {
  rows: DashboardRow[];
  /** Provider ids the user added to the dashboard, in the order they were added. */
  usageCards: string[];
  /** Built-in stat tiles currently shown on the dashboard (see `DASHBOARD_STAT_IDS`). */
  statCards: DashboardStatId[];
  /** Token Usage summary tiles pinned to the dashboard (see `DASHBOARD_USAGE_SUMMARY_IDS`). */
  summaryCards: DashboardUsageSummaryId[];
  /**
   * Edit mode. Drag handles, per-row controls and the usage cards' remove
   * buttons only exist while this is on, so the normal dashboard stays clean.
   * Deliberately not persisted — it's a mode, not a preference.
   */
  editing: boolean;
  setEditing: (editing: boolean) => void;
  setRowColumns: (rowId: string, columns: DashboardColumns) => void;
  addRow: () => void;
  /** Drops a row, handing its cards to the neighbouring row so none are lost. */
  removeRow: (rowId: string) => void;
  /** Moves a card before `beforeItemId`, or to the end of the row when null. */
  moveItem: (
    itemId: DashboardItemId,
    targetRowId: string,
    beforeItemId: DashboardItemId | null,
  ) => void;
  /** Adds or removes a Token Usage card; returns true when it's now shown. */
  toggleUsageCard: (providerId: string) => boolean;
  /** Shows or hides a built-in stat tile; returns true when it's now shown. */
  toggleStatCard: (id: DashboardStatId) => boolean;
  /** Adds or removes a Token Usage summary tile; returns true when it's now shown. */
  toggleSummaryCard: (id: DashboardUsageSummaryId) => boolean;
}

function newRowId(): string {
  return crypto.randomUUID();
}

function emptyRow(columns: DashboardColumns = DEFAULT_COLUMNS): DashboardRow {
  return { id: newRowId(), columns, items: [] };
}

/** Guards against a layout written by a future/older build. */
function sanitizeColumns(value: number | undefined): DashboardColumns {
  return DASHBOARD_COLUMN_OPTIONS.find((n) => n === value) ?? DEFAULT_COLUMNS;
}

// New cards land in the last row that still has a free cell, so the dashboard
// fills out row by row instead of growing a column of one-card rows.
function appendItem(rows: DashboardRow[], id: DashboardItemId): DashboardRow[] {
  let target = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].items.length < rows[i].columns) {
      target = i;
      break;
    }
  }
  if (target === -1) return [...rows, { ...emptyRow(), items: [id] }];
  return rows.map((row, i) => (i === target ? { ...row, items: [...row.items, id] } : row));
}

/**
 * Keeps only cards that still exist (charts that were removed, or usage/stat/
 * summary cards taken off the dashboard), drops duplicates left by an
 * interrupted write, and appends anything new — so an upgrade never silently
 * hides a card.
 */
function sanitizeLayout(
  rows: DashboardRow[] | undefined,
  usageCards: string[],
  statCards: DashboardStatId[],
  summaryCards: DashboardUsageSummaryId[],
): DashboardRow[] {
  const all: DashboardItemId[] = [
    ...DASHBOARD_CHART_IDS,
    ...statCards.map(statItemId),
    ...usageCards.map(usageItemId),
    ...summaryCards.map(summaryItemId),
  ];
  const known = new Set<string>(all);
  const seen = new Set<string>();
  let kept: DashboardRow[] = (rows ?? []).map((row) => ({
    id: row.id || newRowId(),
    columns: sanitizeColumns(row.columns),
    items: (row.items ?? []).filter((id): id is DashboardItemId => {
      if (!known.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  }));
  if (kept.length === 0) kept = [emptyRow()];
  for (const id of all) if (!seen.has(id)) kept = appendItem(kept, id);
  return kept;
}

/** First-run layout for users coming from the old single flat card order. */
function rowsFromLegacyOrder(order: string[] | undefined, usageCards: string[]): DashboardRow[] {
  const known = new Set<string>([...DASHBOARD_CHART_IDS, ...usageCards.map(usageItemId)]);
  const ordered = (order ?? []).filter((id) => known.has(id));
  const rows: DashboardRow[] = [];
  for (let i = 0; i < ordered.length; i += DEFAULT_COLUMNS) {
    rows.push({ ...emptyRow(), items: ordered.slice(i, i + DEFAULT_COLUMNS) });
  }
  return rows;
}

function persist(
  rows: DashboardRow[],
  extra?: {
    usageCards?: string[];
    statCards?: DashboardStatId[];
    summaryCards?: DashboardUsageSummaryId[];
  },
): void {
  void window.agentmat.settings.update({
    dashboardLayout: rows,
    ...(extra?.usageCards ? { dashboardUsageCards: extra.usageCards } : {}),
    ...(extra?.statCards ? { dashboardStatCards: extra.statCards } : {}),
    ...(extra?.summaryCards ? { dashboardUsageSummaryCards: extra.summaryCards } : {}),
  });
}

export const useDashboardLayoutStore = create<DashboardLayoutState>((set, get) => ({
  rows: [emptyRow()],
  usageCards: [],
  statCards: [],
  summaryCards: [],
  editing: false,

  setEditing: (editing) => set({ editing }),

  setRowColumns: (rowId, columns) => {
    const rows = get().rows.map((row) => (row.id === rowId ? { ...row, columns } : row));
    set({ rows });
    persist(rows);
  },

  addRow: () => {
    const rows = [...get().rows, emptyRow()];
    set({ rows });
    persist(rows);
  },

  removeRow: (rowId) => {
    const current = get().rows;
    // The last row is the only place left to drop a card, so it stays.
    if (current.length <= 1) return;
    const index = current.findIndex((row) => row.id === rowId);
    if (index === -1) return;
    const orphans = current[index].items;
    const rows = current.filter((_, i) => i !== index);
    // Cards fall back into the row above, or into the one below for the first row.
    const mergeInto = Math.max(0, index - 1);
    if (orphans.length > 0) {
      rows[mergeInto] = { ...rows[mergeInto], items: [...rows[mergeInto].items, ...orphans] };
    }
    set({ rows });
    persist(rows);
  },

  moveItem: (itemId, targetRowId, beforeItemId) => {
    if (itemId === beforeItemId) return;
    // Lift the card out of wherever it was first, so the insert point below is
    // measured against the row as it will actually look.
    const rows = get().rows.map((row) => ({
      ...row,
      items: row.items.filter((id) => id !== itemId),
    }));
    const target = rows.find((row) => row.id === targetRowId);
    if (!target) return;
    const at = beforeItemId ? target.items.indexOf(beforeItemId) : -1;
    target.items =
      at === -1
        ? [...target.items, itemId]
        : [...target.items.slice(0, at), itemId, ...target.items.slice(at)];
    set({ rows });
    persist(rows);
  },

  toggleUsageCard: (providerId) => {
    const { rows, usageCards } = get();
    const itemId = usageItemId(providerId);
    const added = !usageCards.includes(providerId);
    const nextCards = added
      ? [...usageCards, providerId]
      : usageCards.filter((id) => id !== providerId);
    const nextRows = added
      ? appendItem(rows, itemId)
      : rows.map((row) => ({ ...row, items: row.items.filter((id) => id !== itemId) }));
    set({ usageCards: nextCards, rows: nextRows });
    persist(nextRows, { usageCards: nextCards });
    return added;
  },

  toggleStatCard: (id) => {
    const { rows, statCards } = get();
    const itemId = statItemId(id);
    const added = !statCards.includes(id);
    const nextCards = added ? [...statCards, id] : statCards.filter((x) => x !== id);
    const nextRows = added
      ? appendItem(rows, itemId)
      : rows.map((row) => ({ ...row, items: row.items.filter((x) => x !== itemId) }));
    set({ statCards: nextCards, rows: nextRows });
    persist(nextRows, { statCards: nextCards });
    return added;
  },

  toggleSummaryCard: (id) => {
    const { rows, summaryCards } = get();
    const itemId = summaryItemId(id);
    const added = !summaryCards.includes(id);
    const nextCards = added ? [...summaryCards, id] : summaryCards.filter((x) => x !== id);
    const nextRows = added
      ? appendItem(rows, itemId)
      : rows.map((row) => ({ ...row, items: row.items.filter((x) => x !== itemId) }));
    set({ summaryCards: nextCards, rows: nextRows });
    persist(nextRows, { summaryCards: nextCards });
    return added;
  },
}));

export async function initDashboardLayout(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  const usageCards = settings.dashboardUsageCards ?? [];
  const statCards = (settings.dashboardStatCards ?? [...DASHBOARD_STAT_IDS]).filter(
    (id): id is DashboardStatId => (DASHBOARD_STAT_IDS as readonly string[]).includes(id),
  );
  const summaryCards = (settings.dashboardUsageSummaryCards ?? []).filter(
    (id): id is DashboardUsageSummaryId =>
      (DASHBOARD_USAGE_SUMMARY_IDS as readonly string[]).includes(id),
  );
  const stored = settings.dashboardLayout?.length
    ? settings.dashboardLayout
    : rowsFromLegacyOrder(settings.dashboardChartOrder, usageCards);
  useDashboardLayoutStore.setState({
    usageCards,
    statCards,
    summaryCards,
    rows: sanitizeLayout(stored, usageCards, statCards, summaryCards),
  });
}
