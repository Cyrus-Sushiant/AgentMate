import type { GitChangeEntry } from '@agentmat/core';
import type { GitDiffSide } from '@shared/apiTypes';
import { FileCode, Minus, Plus, Trash2, Undo } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { changeStatusMeta, splitGitPath } from '@/lib/git';
import { cn } from '@/lib/utils';

export interface GitFileRowProps {
  entry: GitChangeEntry;
  side: GitDiffSide;
  selected: boolean;
  focusable: boolean;
  onFocusRow: () => void;
  onOpen: (pin: boolean) => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onResolve?: (pick: 'ours' | 'theirs') => void;
  onOpenFile: () => void;
}

function RowAction({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label} delayDuration={400}>
      <button
        type="button"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/10',
          tone === 'danger' ? 'hover:text-destructive' : 'hover:text-foreground',
        )}
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}

/** Moves focus to the next or previous row in the panel, wrapping at neither end. */
function focusSibling(current: HTMLElement, step: 1 | -1): void {
  const rows = Array.from(
    current.closest('[data-git-panel]')?.querySelectorAll<HTMLElement>('[data-git-row]') ?? [],
  );
  const next = rows[rows.indexOf(current) + step];
  next?.focus();
}

export function GitFileRow({
  entry,
  side,
  selected,
  focusable,
  onFocusRow,
  onOpen,
  onStage,
  onUnstage,
  onDiscard,
  onResolve,
  onOpenFile,
}: GitFileRowProps): React.JSX.Element {
  const { dir, name } = splitGitPath(entry.path);
  const meta = changeStatusMeta(entry.status);
  const deleted = entry.status === 'D';
  const hasCounts = !entry.binary && ((entry.additions ?? 0) > 0 || (entry.deletions ?? 0) > 0);
  const description = [
    entry.origPath ? `${entry.origPath} renamed to ${entry.path}` : entry.path,
    entry.conflict ? `${meta.label} (${entry.conflict})` : meta.label,
    entry.binary ? 'binary file' : null,
  ]
    .filter(Boolean)
    .join(', ');

  // No hover tooltip on the row itself: the row is full of action buttons with their own,
  // and two stacked bubbles read as noise. The diff tab shows the full path.
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={description}
      tabIndex={focusable ? 0 : -1}
      data-git-row
      onFocus={onFocusRow}
      onClick={() => onOpen(false)}
      onDoubleClick={() => onOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          focusSibling(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          onOpen(true);
        } else if (event.key === ' ') {
          event.preventDefault();
          (onStage ?? onUnstage)?.();
        } else if (event.key === 'Delete' && onDiscard) {
          event.preventDefault();
          onDiscard();
        }
      }}
      className={cn(
        'group/row relative mx-1 flex h-[26px] cursor-pointer select-none items-center gap-2 rounded-md pl-6 pr-2 text-[13px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-primary/60',
        selected
          ? 'bg-primary/12 text-foreground'
          : 'text-foreground/90 hover:bg-foreground/[0.05]',
      )}
    >
      <span
        className={cn(
          'min-w-0 shrink truncate',
          deleted && 'text-muted-foreground line-through decoration-foreground/30',
        )}
      >
        {name}
      </span>
      {dir ? (
        <span
          className="min-w-0 flex-1 truncate text-left text-[11px] text-muted-foreground/80 [direction:rtl]"
          aria-hidden
        >
          <bdi>{dir.replace(/\/$/, '')}</bdi>
        </span>
      ) : (
        <span className="flex-1" />
      )}

      <span className="flex shrink-0 items-center gap-1.5 group-focus-within/row:hidden group-hover/row:hidden">
        {hasCounts ? (
          <span className="font-mono text-[10px] tabular-nums">
            {entry.additions ? <span className="text-success">+{entry.additions}</span> : null}
            {entry.additions && entry.deletions ? ' ' : null}
            {entry.deletions ? <span className="text-destructive">−{entry.deletions}</span> : null}
          </span>
        ) : null}
      </span>

      <span className="hidden shrink-0 items-center gap-0.5 group-focus-within/row:flex group-hover/row:flex">
        {onResolve ? (
          <>
            <SimpleTooltip label="Keep your version" delayDuration={400}>
              <button
                type="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  onResolve('ours');
                }}
                className="rounded px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                Ours
              </button>
            </SimpleTooltip>
            <SimpleTooltip label="Keep the incoming version" delayDuration={400}>
              <button
                type="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  onResolve('theirs');
                }}
                className="rounded px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                Theirs
              </button>
            </SimpleTooltip>
          </>
        ) : null}
        {!deleted ? (
          <RowAction label="Open file" onClick={onOpenFile}>
            <FileCode className="h-2.5 w-2.5" />
          </RowAction>
        ) : null}
        {onDiscard ? (
          <RowAction
            label={side === 'untracked' ? 'Delete file' : 'Discard changes'}
            onClick={onDiscard}
            tone="danger"
          >
            {side === 'untracked' ? (
              <Trash2 className="h-2.5 w-2.5" />
            ) : (
              <Undo className="h-2.5 w-2.5" />
            )}
          </RowAction>
        ) : null}
        {onStage ? (
          <RowAction label={side === 'conflict' ? 'Mark as resolved' : 'Stage'} onClick={onStage}>
            <Plus className="h-2.5 w-2.5" />
          </RowAction>
        ) : null}
        {onUnstage ? (
          <RowAction label="Unstage" onClick={onUnstage}>
            <Minus className="h-2.5 w-2.5" />
          </RowAction>
        ) : null}
      </span>

      <span
        className={cn(
          'w-3 shrink-0 text-center font-mono text-[11px] font-semibold',
          meta.className,
        )}
        aria-label={meta.label}
      >
        {meta.letter}
      </span>
    </div>
  );
}
