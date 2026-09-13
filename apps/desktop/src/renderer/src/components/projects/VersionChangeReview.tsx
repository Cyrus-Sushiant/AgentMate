import type { VersionFileChange } from '@shared/apiTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, Spinner, TriangleAlert, Undo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

/** What the user said about one changed file. A file with no entry is still waiting for review. */
export type VersionFileDecision = 'keep' | 'revert';

/** Diffs this short open on their own; anything longer waits for a click. */
const AUTO_EXPAND_LINES = 40;

const KIND_BADGE = {
  added: { letter: 'A', label: 'Added', className: 'bg-success/15 text-success' },
  modified: { letter: 'M', label: 'Modified', className: 'bg-warning/15 text-warning' },
  deleted: { letter: 'D', label: 'Deleted', className: 'bg-destructive/15 text-destructive' },
} as const;

function splitPath(path: string): { dir: string; name: string } {
  const index = path.lastIndexOf('/');
  return index < 0
    ? { dir: '', name: path }
    : { dir: path.slice(0, index + 1), name: path.slice(index + 1) };
}

function diffLineClass(line: string): string {
  if (line.startsWith('@@')) return 'bg-primary/5 text-primary/80';
  if (line.startsWith('+')) return 'bg-success/10 text-success';
  if (line.startsWith('-')) return 'bg-destructive/10 text-destructive';
  return 'text-muted-foreground';
}

function DiffBlock({ change }: { change: VersionFileChange }): React.JSX.Element {
  if (!change.diff) {
    return (
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {change.binary ? 'Binary file, no preview.' : 'No text changes to show.'}
      </p>
    );
  }
  // Keys come from the line's place in the diff, which never reorders.
  const lines = change.diff.split('\n').map((text, index) => ({ id: `${index}`, text }));
  return (
    <div className="border-t border-border bg-background/40">
      <div className="max-h-72 overflow-auto overscroll-contain">
        <pre className="min-w-max py-1 font-mono text-[11px] leading-5">
          {lines.map((line) => (
            <div key={line.id} className={cn('px-3', diffLineClass(line.text))}>
              {line.text || ' '}
            </div>
          ))}
        </pre>
      </div>
      {change.diffTruncated && (
        <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          Long diff, only the start is shown.
        </p>
      )}
    </div>
  );
}

/**
 * The version bump's edits, one file at a time, each with its diff and a Keep or Revert
 * choice. Detecting the right files is best effort (the CLI can wander, other tools can write
 * during the run), so the user signs off on every file instead of trusting the list.
 *
 * Revert happens on disk right away and can be taken back with Keep, since both versions of
 * the file are held in git's object store.
 */
export function VersionChangeReview({
  projectId,
  changes,
  decisions,
  onDecisionsChange,
  locked,
  scopePath,
}: {
  projectId: string;
  changes: VersionFileChange[];
  decisions: Record<string, VersionFileDecision>;
  onDecisionsChange: (
    update: (prev: Record<string, VersionFileDecision>) => Record<string, VersionFileDecision>,
  ) => void;
  /** Set once the kept files are committed, when changing a decision no longer means anything. */
  locked: boolean;
  scopePath: string;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [busyPaths, setBusyPaths] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        changes
          .filter((change) => change.diff && change.diff.split('\n').length <= AUTO_EXPAND_LINES)
          .map((change) => change.path),
      ),
  );

  const undecided = changes.filter((change) => !decisions[change.path]);
  const keptCount = changes.filter((change) => decisions[change.path] === 'keep').length;
  const revertedCount = changes.filter((change) => decisions[change.path] === 'revert').length;
  const strayUndecided = undecided.filter((change) => change.outOfScope);

  function setBusy(path: string, busy: boolean): void {
    setBusyPaths((prev) => {
      const next = new Set(prev);
      if (busy) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  function toggleExpanded(path: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function decide(change: VersionFileChange, next: VersionFileDecision): Promise<void> {
    const current = decisions[change.path];
    if (current === next || busyPaths.has(change.path)) return;

    // Only moving in or out of "revert" touches the file; keeping an undecided file is a mark.
    const swap =
      next === 'revert'
        ? { fromId: change.afterId, toId: change.beforeId, toRawId: change.beforeRawId }
        : current === 'revert'
          ? { fromId: change.beforeId, toId: change.afterId, toRawId: change.afterRawId }
          : null;

    if (swap) {
      setBusy(change.path, true);
      try {
        const result = await window.agentmat.git.swapVersionFile({
          projectId,
          path: change.path,
          ...swap,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      } catch (error) {
        toast.error((error as Error).message);
        return;
      } finally {
        setBusy(change.path, false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
      }
    }
    onDecisionsChange((prev) => ({ ...prev, [change.path]: next }));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
          Review changes ({changes.length})
          <span className="font-normal">
            {' · '}
            {keptCount} kept · {revertedCount} reverted
            {undecided.length > 0 ? ` · ${undecided.length} to review` : ''}
          </span>
        </p>
        {!locked && undecided.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              onDecisionsChange((prev) => {
                const next = { ...prev };
                for (const change of undecided) next[change.path] = 'keep';
                return next;
              })
            }
          >
            <Check className="h-3 w-3" /> Keep the rest
          </Button>
        )}
      </div>

      {/* The whole point of a scoped bump is that other parts keep their versions, so a stray
          edit outside the folder is named up front with a one-click way out. */}
      {!locked && strayUndecided.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 sm:flex-row sm:items-center">
          <p className="flex min-w-0 flex-1 items-start gap-1.5 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              {strayUndecided.length} file{strayUndecided.length === 1 ? ' is' : 's are'} outside{' '}
              <span className="font-mono">{scopePath}</span>, which this tag does not cover.
            </span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            onClick={() => {
              for (const change of strayUndecided) void decide(change, 'revert');
            }}
          >
            <Undo className="h-3.5 w-3.5" /> Revert {strayUndecided.length === 1 ? 'it' : 'them'}
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {changes.map((change) => {
          const { dir, name } = splitPath(change.path);
          const decision = decisions[change.path];
          const busy = busyPaths.has(change.path);
          const open = expanded.has(change.path);
          const badge = KIND_BADGE[change.kind];
          return (
            <div
              key={change.path}
              className={cn(
                'overflow-hidden rounded-lg border bg-card/60 transition-colors duration-150',
                decision === 'keep'
                  ? 'border-success/40'
                  : decision === 'revert'
                    ? 'border-border opacity-70'
                    : change.outOfScope
                      ? 'border-warning/40'
                      : 'border-border',
              )}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleExpanded(change.path)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
                      !open && '-rotate-90',
                    )}
                  />
                  <SimpleTooltip label={badge.label}>
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[10px] font-semibold',
                        badge.className,
                      )}
                    >
                      {badge.letter}
                    </span>
                  </SimpleTooltip>
                  <span
                    className={cn(
                      'min-w-0 truncate font-mono text-xs',
                      decision === 'revert' && 'line-through',
                    )}
                  >
                    {dir ? <span className="text-muted-foreground">{dir}</span> : null}
                    {name}
                  </span>
                  {!change.binary && (
                    <span className="shrink-0 font-mono text-[10px]">
                      <span className="text-success">+{change.additions}</span>{' '}
                      <span className="text-destructive">-{change.deletions}</span>
                    </span>
                  )}
                </button>

                {change.outOfScope && (
                  <SimpleTooltip label={`Outside ${scopePath}. This tag should not change it.`}>
                    <span className="shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      Outside
                    </span>
                  </SimpleTooltip>
                )}
                {change.hadLocalEdits && (
                  <SimpleTooltip label="This file already had uncommitted edits before the run. The diff shows only the run's edit, and Revert keeps your earlier edits, but committing it includes them.">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Had edits
                    </span>
                  </SimpleTooltip>
                )}

                <div
                  role="group"
                  aria-label={`Decision for ${change.path}`}
                  className="flex shrink-0 overflow-hidden rounded-md border border-border"
                >
                  <button
                    type="button"
                    aria-pressed={decision === 'keep'}
                    disabled={locked || busy}
                    onClick={() => void decide(change, 'keep')}
                    className={cn(
                      'flex cursor-pointer items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                      decision === 'keep'
                        ? 'bg-success/15 text-success'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Check className="h-3 w-3" /> Keep
                  </button>
                  <button
                    type="button"
                    aria-pressed={decision === 'revert'}
                    disabled={locked || busy}
                    onClick={() => void decide(change, 'revert')}
                    className={cn(
                      'flex cursor-pointer items-center gap-1 border-l border-border px-2 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                      decision === 'revert'
                        ? 'bg-destructive/15 text-destructive'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {busy ? (
                      <Spinner className="h-3 w-3 animate-spin" />
                    ) : (
                      <Undo className="h-3 w-3" />
                    )}{' '}
                    {decision === 'revert' ? 'Reverted' : 'Revert'}
                  </button>
                </div>
              </div>
              {open && <DiffBlock change={change} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
