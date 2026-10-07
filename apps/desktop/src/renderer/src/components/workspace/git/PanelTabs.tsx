import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { SECTION_HEADING } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type SidePanelSection, useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The hairline under a strip in the panel, drawn as an inset shadow like the API Client's tab
 * strip, so the app's global border colour can't repaint it.
 */
export const HAIRLINE_BELOW = 'shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]';

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
  const reduceMotion = useReducedMotion();
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
          'relative flex h-6 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60',
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
        )}
      >
        {active ? (
          <motion.span
            aria-hidden
            layoutId="panel-tabs-active"
            transition={
              reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }
            }
            className="absolute inset-0 rounded-full bg-primary/12 ring-1 ring-inset ring-primary/20"
          />
        ) : null}
        <Icon className="relative h-3.5 w-3.5" />
        {tab.count ? (
          <span
            className={cn(
              'relative min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 tabular-nums',
              tab.countTone === 'destructive'
                ? 'bg-destructive/15 text-destructive'
                : active
                  ? 'bg-primary/15 text-primary'
                  : 'bg-foreground/[0.07] text-muted-foreground',
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
      <div className={cn('flex h-10 shrink-0 items-center gap-1 pl-2 pr-1.5', HAIRLINE_BELOW)}>
        {/* The tabs sit in the search pill's soft track, with the open one on the sliding tinted
            pill the API Client and the main menu use. */}
        <div className="flex min-w-0 flex-1">
          <LayoutGroup id="panel-tabs">
            <div
              role="tablist"
              aria-label="Panel sections"
              className="search-pill flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
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
          </LayoutGroup>
        </div>
        {active?.actions && active.toolbarTitle === undefined ? (
          <span className="flex shrink-0 items-center gap-0.5">{active.actions}</span>
        ) : null}
        {trailing ? <span className="flex shrink-0 items-center gap-0.5">{trailing}</span> : null}
      </div>
      {active?.actions && active.toolbarTitle !== undefined ? (
        <div className={cn('flex h-8 shrink-0 items-center gap-1 pl-3.5 pr-1.5', HAIRLINE_BELOW)}>
          <span className={cn(SECTION_HEADING, 'min-w-0 flex-1 truncate')}>
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
      <Button
        type="button"
        variant={active ? 'tint' : 'ghost'}
        size="icon-xs"
        aria-label={label}
        {...(active === undefined ? {} : { 'aria-pressed': active })}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        disabled={disabled}
      >
        {children}
      </Button>
    </SimpleTooltip>
  );
}
