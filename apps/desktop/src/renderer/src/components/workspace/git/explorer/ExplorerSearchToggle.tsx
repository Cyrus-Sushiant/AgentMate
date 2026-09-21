import { Search } from '@/components/icons';
import { toggleExplorerSearch, useExplorerStore } from '@/stores/explorerStore';
import { PanelIconButton } from '../PanelTabs';
import { explorerShortcutLabel } from './keys';

/** The explorer toolbar's search button. Its own component so the panel does not re-render. */
export function ExplorerSearchToggle({ projectId }: { projectId: string }): React.JSX.Element {
  const open = useExplorerStore((s) => typeof s.projects[projectId]?.search === 'string');
  return (
    <PanelIconButton
      label={`Search files (${explorerShortcutLabel('find')})`}
      active={open}
      onClick={() => toggleExplorerSearch(projectId)}
    >
      <Search className="h-2.5 w-2.5" />
    </PanelIconButton>
  );
}
