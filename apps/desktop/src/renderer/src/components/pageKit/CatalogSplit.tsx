import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { cn } from '@/lib/utils';
import {
  CATALOG_SIDEBAR_WIDTH,
  type CatalogSidebar,
  useCatalogSidebarWidth,
} from '@/stores/catalogLayoutStore';
import { GLASS_PANEL } from './styles';

/**
 * A list-and-detail layout in the API Client's shape: a glass sidebar card on the left, the
 * detail on the right, and a quiet resize handle in the gap between them whose line only shows
 * while it is in use.
 */
export function CatalogSplit({
  sidebar,
  sidebarLabel,
  resizeLabel,
  aside,
  children,
}: {
  sidebar: CatalogSidebar;
  sidebarLabel: string;
  resizeLabel: string;
  aside: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const [width, setWidth] = useCatalogSidebarWidth(sidebar);
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        aria-label={sidebarLabel}
        // The cap keeps a wide saved width from squeezing the detail on a narrow window.
        style={{ width, maxWidth: '40%' }}
        className={cn(GLASS_PANEL, 'shrink-0')}
      >
        {aside}
      </aside>
      <ResizeHandle
        orientation="vertical"
        label={resizeLabel}
        size={width}
        min={CATALOG_SIDEBAR_WIDTH.min}
        max={CATALOG_SIDEBAR_WIDTH.max}
        defaultSize={CATALOG_SIDEBAR_WIDTH.default}
        onSizeChange={setWidth}
        quiet
        className="w-2"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}
