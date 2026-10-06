import type { DeployWordPressPhase } from '@shared/deployWordPressTypes';
import { CircleCheck, CircleX, Spinner } from '@/components/icons';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { WordPressOperationRun } from '@/stores/wordpressOperationStore';
import { PHASE_LABEL, PHASE_ORDER, PLANNED_PHASES } from './wordpressCopy';

type StepState = 'done' | 'running' | 'failed' | 'pending' | 'skipped';

interface TimelineStep {
  phase: DeployWordPressPhase;
  state: StepState;
}

/**
 * The steps of a run in order: the ones its kind always goes through, plus any it reported that
 * were not planned (a rollback, say). Steps before the current one that never reported were
 * skipped; the ones after it have not happened yet.
 */
export function timelineSteps(run: WordPressOperationRun): TimelineStep[] {
  const shown = new Set<DeployWordPressPhase>([...PLANNED_PHASES[run.kind], ...run.phases]);
  const ordered = PHASE_ORDER.filter((phase) => shown.has(phase));
  const current = run.phases.length > 0 ? run.phases[run.phases.length - 1] : null;
  const currentIndex = current ? ordered.indexOf(current) : -1;
  const seen = new Set(run.phases);
  return ordered.map((phase, index) => {
    if (phase === current) {
      const state: StepState =
        run.status === 'running' ? 'running' : run.status === 'failed' ? 'failed' : 'done';
      return { phase, state };
    }
    if (index < currentIndex) return { phase, state: seen.has(phase) ? 'done' : 'skipped' };
    if (run.status === 'running') return { phase, state: 'pending' };
    return { phase, state: 'skipped' };
  });
}

function StepIcon({ state }: { state: StepState }): React.JSX.Element {
  if (state === 'done') return <CircleCheck className="h-3.5 w-3.5 text-success" />;
  if (state === 'failed') return <CircleX className="h-3.5 w-3.5 text-destructive" />;
  if (state === 'running') return <Spinner className="h-3.5 w-3.5 animate-spin text-primary" />;
  return (
    <span
      aria-hidden
      className={cn(
        'block h-3 w-3 rounded-full border-[1.5px]',
        state === 'skipped' ? 'border-foreground/15' : 'border-foreground/30',
      )}
    />
  );
}

const STATE_LABEL: Record<StepState, string> = {
  done: 'done',
  running: 'in progress',
  failed: 'stopped here',
  pending: 'waiting',
  skipped: 'skipped',
};

export function OperationTimeline({ run }: { run: WordPressOperationRun }): React.JSX.Element {
  const steps = timelineSteps(run);
  return (
    <ol aria-label="Progress" className="space-y-1.5">
      {steps.map(({ phase, state }) => {
        const progress = run.progress[phase];
        const showCount = progress && progress.total > 1 && state !== 'skipped';
        return (
          <li
            key={phase}
            aria-label={`${PHASE_LABEL[phase]}: ${STATE_LABEL[state]}`}
            className={cn(
              'flex items-center gap-2.5 text-sm',
              state === 'pending' || state === 'skipped'
                ? 'text-muted-foreground'
                : 'text-foreground',
              state === 'skipped' && 'opacity-60',
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <StepIcon state={state} />
            </span>
            <span className="min-w-0 flex-1 truncate">{PHASE_LABEL[phase]}</span>
            {showCount ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {progress.done} of {progress.total}
                {progress.bytes ? `, ${formatBytes(progress.bytes)}` : ''}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
