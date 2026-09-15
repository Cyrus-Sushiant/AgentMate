import { ChevronRight } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type SidePanelSection, useWorkspaceStore } from '@/stores/workspaceStore';

export interface PanelSectionProps {
  id: SidePanelSection;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** A small number beside the title (changes, branches). */
  count?: number;
  /** Buttons on the right of the header; they stay clickable without toggling the section. */
  actions?: React.ReactNode;
  /** Relative share of the height among open sections. */
  weight?: number;
  children: React.ReactNode;
}

/**
 * One fold of the right-hand panel. Open sections split the height between them, closed ones
 * shrink to their header, so several can be open at once without the panel scrolling as a whole.
 */
export function PanelSection({
  id,
  title,
  icon: Icon,
  count,
  actions,
  weight = 1,
  children,
}: PanelSectionProps): React.JSX.Element {
  const open = useWorkspaceStore((s) => s.gitPanel.openSections[id] === true);
  const openSections = useWorkspaceStore((s) => s.gitPanel.openSections);
  const setGitPanel = useWorkspaceStore((s) => s.setGitPanel);

  return (
    <section
      aria-label={title}
      className={cn(
        'flex min-h-0 flex-col border-t border-border/60 first:border-t-0',
        open ? 'min-h-[7rem]' : 'shrink-0',
      )}
      style={open ? { flex: `${weight} 1 0` } : undefined}
    >
      <div className="group/panel flex h-8 shrink-0 items-center gap-1 bg-card/50 pl-2 pr-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setGitPanel({ openSections: { ...openSections, [id]: !open } })}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
        >
          <ChevronRight
            className={cn(
              'h-2.5 w-2.5 shrink-0 transition-transform duration-150',
              open && 'rotate-90',
            )}
          />
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{title}</span>
          {count !== undefined && count > 0 ? (
            <span className="rounded-full bg-foreground/[0.08] px-1.5 text-[10px] font-medium normal-case tabular-nums">
              {count}
            </span>
          ) : null}
        </button>
        {actions ? (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/panel:opacity-100">
            {actions}
          </span>
        ) : null}
      </div>
      {open ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : null}
    </section>
  );
}

export function PanelIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label} wrapTrigger={disabled}>
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        disabled={disabled}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}
