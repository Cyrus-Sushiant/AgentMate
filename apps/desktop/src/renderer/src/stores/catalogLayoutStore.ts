import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Sidebar widths on the Skills and MCP pages, remembered between visits. */

export const CATALOG_SIDEBAR_WIDTH = { min: 180, max: 420, default: 240 } as const;

export type CatalogSidebar = 'mcpRepositories' | 'skillRepositories';

interface CatalogLayoutState {
  widths: Partial<Record<CatalogSidebar, number>>;
  setWidth: (sidebar: CatalogSidebar, width: number) => void;
}

export const useCatalogLayoutStore = create<CatalogLayoutState>()(
  persist(
    (set) => ({
      widths: {},
      setWidth: (sidebar, width) =>
        set((state) => ({ widths: { ...state.widths, [sidebar]: width } })),
    }),
    { name: 'agentmate-catalog-layout' },
  ),
);

/** One sidebar's width and its setter. */
export function useCatalogSidebarWidth(sidebar: CatalogSidebar): [number, (width: number) => void] {
  const width = useCatalogLayoutStore(
    (state) => state.widths[sidebar] ?? CATALOG_SIDEBAR_WIDTH.default,
  );
  const setWidth = useCatalogLayoutStore((state) => state.setWidth);
  return [width, (next) => setWidth(sidebar, next)];
}
