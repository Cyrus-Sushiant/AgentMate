import type { VersionFileChange, VersionHunk } from '@shared/apiTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, Spinner, Undo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

/** What the user said about one changed file, or one change inside it. */
export type VersionFileDecision = 'keep' | 'revert';

/**
 * The review of one changed file. `choices` has an entry per hunk for a file split into
 * hunks, or a single entry for a file reviewed whole; a missing entry is still to review, and
 * its edit stays on disk until then. `diskId` is the blob the file holds now, once a revert
 * has moved it off the run's result.
 */
export interface VersionFileReview {
  choices: (VersionFileDecision | undefined)[];
  diskId?: string | null;
}

export type VersionReviews = Record<string, VersionFileReview>;

/** A file reviewed whole counts as one change. */
function choiceCount(change: VersionFileChange): number {
  return change.hunks?.length ?? 1;
}

function choicesOf(
  change: VersionFileChange,
  review: VersionFileReview | undefined,
): (VersionFileDecision | undefined)[] {
  return Array.from({ length: choiceCount(change) }, (_, index) => review?.choices[index]);
}

/**
 * Where a file stands: undefined while any of its changes is undecided, and 'partial' once
 * some are kept and the rest reverted. Keep and partial files both go into the commit.
 */
export function fileDecision(
  change: VersionFileChange,
  review: VersionFileReview | undefined,
): VersionFileDecision | 'partial' | undefined {
  const choices = choicesOf(change, review);
  if (choices.some((choice) => !choice)) return undefined;
  if (choices.every((choice) => choice === 'keep')) return 'keep';
  if (choices.every((choice) => choice === 'revert')) return 'revert';
  return 'partial';
}

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

function DiffLines({ lines }: { lines: string[] }): React.JSX.Element {
  // Keys come from the line's place in the diff, which never reorders.
  const keyed = lines.map((text, index) => ({ id: `${index}`, text }));
  return (
    <pre className="min-w-max py-1 font-mono text-[11px] leading-5">
      {keyed.map((line) => (
        <div key={line.id} className={cn('px-3', diffLineClass(line.text))}>
          {line.text || ' '}
        </div>
      ))}
    </pre>
  );
}

function DiffBlock({ change }: { change: VersionFileChange }): React.JSX.Element {
  if (!change.diff) {
    return (
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {change.binary ? 'Binary file, no preview.' : 'No text changes to show.'}
      </p>
    );
  }
  return (
    <div className="border-t border-border bg-background/40">
      <div className="max-h-72 overflow-auto overscroll-contain">
        <DiffLines lines={change.diff.split('\n')} />
      </div>
      {change.diffTruncated && (
        <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          Long diff, only the start is shown.
        </p>
      )}
    </div>
  );
}

/** The Keep / Revert pair, used for a whole file and for each change inside one. */
function ChoiceButtons({
  choice,
  label,
  disabled,
  busy,
  small,
  onChoose,
}: {
  choice: VersionFileDecision | undefined;
  label: string;
  disabled: boolean;
  busy: boolean;
  small?: boolean;
  onChoose: (next: VersionFileDecision) => void;
}): React.JSX.Element {
  const buttonClass = cn(
    'flex cursor-pointer items-center gap-1 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
    small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
  );
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 overflow-hidden rounded-md border border-border bg-card"
    >
      <button
        type="button"
        aria-pressed={choice === 'keep'}
        disabled={disabled || busy}
        onClick={() => onChoose('keep')}
        className={cn(
          buttonClass,
          choice === 'keep'
            ? 'bg-success/15 text-success'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Check className="h-3 w-3" /> Keep
      </button>
      <button
        type="button"
        aria-pressed={choice === 'revert'}
        disabled={disabled || busy}
        onClick={() => onChoose('revert')}
        className={cn(
          buttonClass,
          'border-l border-border',
          choice === 'revert'
            ? 'bg-destructive/15 text-destructive'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        {busy ? <Spinner className="h-3 w-3 animate-spin" /> : <Undo className="h-3 w-3" />}{' '}
        {choice === 'revert' ? 'Reverted' : 'Revert'}
      </button>
    </div>
  );
}

function HunkList({
  change,
  hunks,
  choices,
  disabled,
  busy,
  onChoose,
}: {
  change: VersionFileChange;
  hunks: VersionHunk[];
  choices: (VersionFileDecision | undefined)[];
  disabled: boolean;
  busy: boolean;
  onChoose: (index: number, next: VersionFileDecision) => void;
}): React.JSX.Element {
  return (
    <div className="max-h-96 divide-y divide-border overflow-y-auto overscroll-contain border-t border-border bg-background/40">
      {hunks.map((hunk, index) => (
        <div key={hunk.header} className={cn(choices[index] === 'revert' && 'opacity-60')}>
          <div className="flex items-center gap-2 bg-primary/5 py-1 pr-2 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-primary/80">
              Change {index + 1} of {hunks.length}
              <span className="text-muted-foreground"> · {hunk.header}</span>
            </span>
            <ChoiceButtons
              small
              choice={choices[index]}
              label={`Change ${index + 1} in ${change.path}`}
              disabled={disabled}
              busy={busy}
              onChoose={(next) => onChoose(index, next)}
            />
          </div>
          <div className="overflow-x-auto">
            <DiffLines lines={hunk.lines} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The version bump's edits, one file at a time, each with its diff and a Keep or Revert
 * choice. The CLI is free to edit anything (and other tools can write during the run), so the
 * user decides which files belong to the release instead of the app guessing up front. A file
 * with several separate changes can be split, keeping some of them and reverting the others.
 *
 * Revert happens on disk right away and can be taken back with Keep, since both versions of
 * the file are held in git's object store.
 */
export function VersionChangeReview({
  projectId,
  changes,
  reviews,
  onReviewsChange,
  locked,
}: {
  projectId: string;
  changes: VersionFileChange[];
  reviews: VersionReviews;
  onReviewsChange: (update: (prev: VersionReviews) => VersionReviews) => void;
  /** Set once the kept files are committed, when changing a decision no longer means anything. */
  locked: boolean;
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

  const decisions = changes.map((change) => fileDecision(change, reviews[change.path]));
  const undecided = changes.filter((_, index) => !decisions[index]);
  const keptCount = decisions.filter((decision) => decision === 'keep').length;
  const partialCount = decisions.filter((decision) => decision === 'partial').length;
  const revertedCount = decisions.filter((decision) => decision === 'revert').length;

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

  /**
   * Writes whatever the new choices mean for the file on disk, then records them. Only a
   * change moving in or out of "revert" touches the file; keeping an undecided one is a mark,
   * since its edit is already there.
   */
  async function writeChoices(
    change: VersionFileChange,
    next: (VersionFileDecision | undefined)[],
  ): Promise<void> {
    if (busyPaths.has(change.path)) return;
    const review = reviews[change.path];
    const current = choicesOf(change, review);
    const revertedNow = next.flatMap((choice, index) => (choice === 'revert' ? [index] : []));
    const revertedBefore = current.flatMap((choice, index) => (choice === 'revert' ? [index] : []));
    const fromId = review?.diskId !== undefined ? review.diskId : change.afterId;
    let diskId = review?.diskId;

    if (revertedNow.join() !== revertedBefore.join()) {
      setBusy(change.path, true);
      try {
        if (change.hunks && change.beforeId && change.afterId && fromId) {
          const result = await window.agentmat.git.writeVersionHunks({
            projectId,
            path: change.path,
            fromId,
            beforeId: change.beforeId,
            afterId: change.afterId,
            beforeRawId: change.beforeRawId,
            afterRawId: change.afterRawId,
            revertHunks: revertedNow,
          });
          if (!result.ok || !result.id) {
            toast.error(result.message);
            return;
          }
          diskId = result.id;
        } else {
          const toRevert = revertedNow.length > 0;
          const result = await window.agentmat.git.swapVersionFile({
            projectId,
            path: change.path,
            fromId,
            toId: toRevert ? change.beforeId : change.afterId,
            toRawId: toRevert ? change.beforeRawId : change.afterRawId,
          });
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          diskId = toRevert ? change.beforeId : change.afterId;
        }
      } catch (error) {
        toast.error((error as Error).message);
        return;
      } finally {
        setBusy(change.path, false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectId) });
      }
    }
    onReviewsChange((prev) => ({ ...prev, [change.path]: { choices: next, diskId } }));
  }

  function chooseFile(change: VersionFileChange, next: VersionFileDecision): void {
    void writeChoices(
      change,
      choicesOf(change, undefined).map(() => next),
    );
  }

  function chooseHunk(change: VersionFileChange, index: number, next: VersionFileDecision): void {
    const choices = choicesOf(change, reviews[change.path]);
    choices[index] = next;
    void writeChoices(change, choices);
  }

  /** Settles every change still waiting for review, leaving the ones already decided alone. */
  function chooseRest(next: VersionFileDecision): void {
    for (const change of undecided) {
      const choices = choicesOf(change, reviews[change.path]).map((choice) => choice ?? next);
      void writeChoices(change, choices);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
          Review changes ({changes.length})
          <span className="font-normal">
            {' · '}
            {keptCount} kept
            {partialCount > 0 ? ` · ${partialCount} partly kept` : ''} · {revertedCount} reverted
            {undecided.length > 0 ? ` · ${undecided.length} to review` : ''}
          </span>
        </p>
        {/* The CLI bumps every version in the repo, so a release for one part usually means
            keeping a couple of files and reverting everything else in one go. */}
        {!locked && undecided.length > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => chooseRest('keep')}
            >
              <Check className="h-3 w-3" /> Keep the rest
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => chooseRest('revert')}
            >
              <Undo className="h-3 w-3" /> Revert the rest
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {changes.map((change, changeIndex) => {
          const { dir, name } = splitPath(change.path);
          const decision = decisions[changeIndex];
          const choices = choicesOf(change, reviews[change.path]);
          const busy = busyPaths.has(change.path);
          const open = expanded.has(change.path);
          const badge = KIND_BADGE[change.kind];
          const hunks = change.hunks;
          const keptHunks = choices.filter((choice) => choice === 'keep').length;
          const decidedHunks = choices.filter(Boolean).length;
          return (
            <div
              key={change.path}
              className={cn(
                'overflow-hidden rounded-lg border bg-card/60 transition-colors duration-150',
                decision === 'keep' || decision === 'partial'
                  ? 'border-success/40'
                  : decision === 'revert'
                    ? 'border-border opacity-70'
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

                {change.hadLocalEdits && (
                  <SimpleTooltip label="This file already had uncommitted edits before the run. The diff shows only the run's edit, and Revert keeps your earlier edits, but committing it includes them.">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Had edits
                    </span>
                  </SimpleTooltip>
                )}

                {hunks && (
                  <SimpleTooltip label="This file has separate changes. Open it to keep some and revert the others.">
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                        decision === 'partial'
                          ? 'bg-success/15 text-success'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {decidedHunks > 0
                        ? `${keptHunks} of ${hunks.length} kept`
                        : `${hunks.length} changes`}
                    </span>
                  </SimpleTooltip>
                )}

                <ChoiceButtons
                  choice={decision === 'partial' ? undefined : decision}
                  label={`Decision for ${change.path}`}
                  disabled={locked}
                  busy={busy}
                  onChoose={(next) => chooseFile(change, next)}
                />
              </div>
              {open &&
                (hunks ? (
                  <HunkList
                    change={change}
                    hunks={hunks}
                    choices={choices}
                    disabled={locked}
                    busy={busy}
                    onChoose={(index, next) => chooseHunk(change, index, next)}
                  />
                ) : (
                  <DiffBlock change={change} />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
