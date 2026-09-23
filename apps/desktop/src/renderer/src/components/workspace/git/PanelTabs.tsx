import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type SidePanelSection, useWorkspaceStore } from '@/stores/workspaceStore';

export interface PanelTabDef {
  id: SidePanelSection;
  /** Shown in the tooltip and read by assistive tech. */
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** A small number on the icon (changed files, unpushed commits). */
  count?: number;
  /** Red when the number is something failing rather than something pending. */
  countTone?: 'default' | 'destructive';
  /** Buttons for this tab, shown at the end of the strip while it is the open one. */
  actions?: React.ReactNode;
  /**
   * Puts the actions on their own line under the strip, with this heading beside them, for a
   * tab with too many buttons to share the strip with the tab icons.
   */
  toolbarTitle?: string;
  render: () => React.ReactNode;
}

function TabButton({
  tab,
  active,
  onSelect,
  onKeyDown,
}: {
  tab: PanelTabDef;
  active: boolean;
  onSelect: () => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}): React.JSX.Element {
  const Icon = tab.icon;
  return (
    <SimpleTooltip label={tab.title} side="bottom">
      <button
        type="button"
        role="tab"
        id={`panel-tab-${tab.id}`}
        aria-selected={active}
        aria-controls={`panel-panel-${tab.id}`}
        aria-label={tab.title}
        tabIndex={active ? 0 : -1}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          'relative flex h-7 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          active
            ? 'bg-primary/12 text-primary'
            : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {tab.count ? (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 min-w-3.5 rounded-full px-1 text-center text-[9px] font-bold leading-[0.875rem] tabular-nums',
              tab.countTone === 'destructive'
                ? 'bg-destructive text-destructive-foreground'
                : active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-foreground/15 text-foreground/80',
            )}
          >
            {tab.count > 99 ? '99+' : tab.count}
          </span>
        ) : null}
      </button>
    </SimpleTooltip>
  );
}

/**
 * The right-hand panel's tab strip and its open tab. Only the open tab renders, so the
 * sections that fetch (commits, pipelines, sessions) stay quiet until they are looked at.
 */
export function PanelTabs({
  tabs,
  trailing,
}: {
  tabs: PanelTabDef[];
  /** Buttons for the panel itself, after the open tab's own. */
  trailing?: React.ReactNode;
}): React.JSX.Element {
  const stored = useWorkspaceStore((s) => s.gitPanel.activeSection);
  const setGitPanel = useWorkspaceStore((s) => s.setGitPanel);
  const active = tabs.find((tab) => tab.id === stored) ?? tabs[0];

  const move = (event: React.KeyboardEvent, from: SidePanelSection): void => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === from);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (!next) return;
    setGitPanel({ activeSection: next.id });
    document.getElementById(`panel-tab-${next.id}`)?.focus();
  };

  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border/60 px-1.5">
        <div role="tablist" aria-label="Panel sections" className="flex min-w-0 flex-1 gap-0.5">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={tab.id === active?.id}
              onSelect={() => setGitPanel({ activeSection: tab.id })}
              onKeyDown={(event) => move(event, tab.id)}
            />
          ))}
        </div>
        {active?.actions && active.toolbarTitle === undefined ? (
          <span className="flex shrink-0 items-center gap-0.5">{active.actions}</span>
        ) : null}
        {trailing ? <span className="flex shrink-0 items-center gap-0.5">{trailing}</span> : null}
      </div>
      {active?.actions && active.toolbarTitle !== undefined ? (
        <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border/60 pl-3 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {active.toolbarTitle}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">{active.actions}</span>
        </div>
      ) : null}
      <div
        role="tabpanel"
        id={`panel-panel-${active?.id}`}
        aria-labelledby={`panel-tab-${active?.id}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {active?.render()}
      </div>
    </>
  );
}

export function PanelIconButton({
  label,
  onClick,
  children,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  /** For a button that turns something on and off, so its state reads at a glance. */
  active?: boolean;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label} wrapTrigger={disabled} side="bottom">
      <button
        type="button"
        aria-label={label}
        {...(active === undefined ? {} : { 'aria-pressed': active })}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        disabled={disabled}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
          active ? 'bg-primary/12 text-primary' : 'text-muted-foreground',
        )}
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}
