import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Side pane widths on the pages laid out like the API Client (a list card beside a detail
 * card), remembered between visits. Each page has its own entry and bounds.
 */

export const PANE_WIDTHS = {
  vaultList: { min: 260, max: 520, default: 340 },
  pipelinesFilters: { min: 196, max: 360, default: 232 },
  remoteFilesPlaces: { min: 180, max: 360, default: 220 },
} as const;

export type PaneKey = keyof typeof PANE_WIDTHS;

interface PaneLayoutState {
  widths: Partial<Record<PaneKey, number>>;
  setWidth: (key: PaneKey, width: number) => void;
}

export const usePaneLayoutStore = create<PaneLayoutState>()(
  persist(
    (set) => ({
      widths: {},
      setWidth: (key, width) => set((state) => ({ widths: { ...state.widths, [key]: width } })),
    }),
    { name: 'agentmate-pane-layout' },
  ),
);

/** A pane's saved width (or its default) and the setter a ResizeHandle reports to. */
export function usePaneWidth(key: PaneKey): [number, (width: number) => void] {
  const width = usePaneLayoutStore((s) => s.widths[key]) ?? PANE_WIDTHS[key].default;
  const setWidth = usePaneLayoutStore((s) => s.setWidth);
  return [width, (next) => setWidth(key, next)];
}
