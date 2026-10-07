import { Plus, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ApiTab } from '@/stores/apiClientTabsStore';
import { methodLabel } from './format';
import { MethodBadge } from './MethodBadge';

interface RequestTabStripProps {
  tabs: ApiTab[];
  activeTabId: string | null;
  isDirty: (tab: ApiTab) => boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

/**
 * The open requests, one pill each, with a dot on any that has unsaved changes. Drawn like the
 * tab strip at the top of a Workspace pane, so the two read as the same kind of control.
 */
export function RequestTabStrip({
  tabs,
  activeTabId,
  isDirty,
  onSelect,
  onClose,
  onNew,
}: RequestTabStripProps): React.JSX.Element {
  return (
    <div className="flex h-10 shrink-0 items-stretch gap-1 px-1.5 shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]">
      <div
        role="tablist"
        aria-label="Open requests"
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                'group relative flex h-7 w-44 min-w-[7rem] shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md pl-1.5 pr-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-foreground/[0.08] text-foreground'
                  : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-[6px] h-[2px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]"
                />
              )}
              <MethodBadge method={tab.draft.method} className="w-9" />
              <span className="min-w-0 flex-1 truncate">{tab.name}</span>
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                {dirty && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-primary transition-opacity group-hover:opacity-0"
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
                    'absolute inset-0 flex items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-foreground/15 hover:text-foreground focus-visible:opacity-100',
                    active ? 'opacity-70' : 'opacity-0 group-hover:opacity-70',
                    dirty && 'opacity-0 group-hover:opacity-70',
                  )}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <SimpleTooltip label="New request (Ctrl+N)">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="New request tab"
          onClick={onNew}
          className="shrink-0 self-center"
        >
          <Plus />
        </Button>
      </SimpleTooltip>
    </div>
  );
}
