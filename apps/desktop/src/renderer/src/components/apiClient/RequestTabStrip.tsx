import { Plus, X } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ApiTab } from '@/stores/apiClientTabsStore';
import { methodLabel, methodTone } from './format';

interface RequestTabStripProps {
  tabs: ApiTab[];
  activeTabId: string | null;
  isDirty: (tab: ApiTab) => boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

/** The open requests, one tab each, with a dot on any that has unsaved changes. */
export function RequestTabStrip({
  tabs,
  activeTabId,
  isDirty,
  onSelect,
  onClose,
  onNew,
}: RequestTabStripProps): React.JSX.Element {
  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-border bg-muted/20">
      <div
        role="tablist"
        aria-label="Open requests"
        className="flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const dirty = isDirty(tab);
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              aria-label={`${methodLabel(tab.draft.method)} ${tab.name}${dirty ? ', unsaved changes' : ''}`}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(tab.id);
                }
              }}
              onMouseDown={(event) => {
                // Keeps the middle button from starting an autoscroll.
                if (event.button === 1) event.preventDefault();
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(tab.id);
                }
              }}
              className={cn(
                'group relative flex w-44 min-w-[7rem] shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                active
                  ? 'bg-background text-foreground after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:bg-primary'
                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'shrink-0 font-mono text-[10px] font-bold',
                  methodTone(tab.draft.method),
                )}
              >
                {methodLabel(tab.draft.method)}
              </span>
              <span className="min-w-0 flex-1 truncate">{tab.name}</span>
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                {dirty && (
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full bg-primary transition-opacity group-hover:opacity-0"
                  />
                )}
                <button
                  type="button"
                  aria-label={`Close ${tab.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(tab.id);
                  }}
                  className={cn(
                    'absolute inset-0 flex items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100',
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                    dirty && 'opacity-0',
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <SimpleTooltip label="New request (Ctrl+N)">
        <button
          type="button"
          aria-label="New request tab"
          onClick={onNew}
          className="flex w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </SimpleTooltip>
    </div>
  );
}
