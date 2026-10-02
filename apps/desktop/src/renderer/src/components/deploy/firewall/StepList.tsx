import type { DeployFirewallStep, DeployFirewallStepState } from '@shared/deployFirewallTypes';
import { CircleCheck, CircleX, Spinner } from '@/components/icons';
import { STEP_LABEL } from '@/lib/deploy/firewall/format';
import { cn } from '@/lib/utils';

/** The steps of an apply, a confirmation or a revert, in the order they happened. */

export type StepStates = Array<{
  step: DeployFirewallStep;
  state: DeployFirewallStepState;
  message?: string;
}>;

const STATE_WORD: Record<DeployFirewallStepState, string> = {
  running: 'in progress',
  done: 'done',
  failed: 'failed',
};

export function StepList({ steps }: { steps: StepStates }): React.JSX.Element | null {
  if (steps.length === 0) return null;
  return (
    <ol aria-label="Steps" className="space-y-1">
      {steps.map(({ step, state, message }) => (
        <li
          key={step}
          aria-label={`${STEP_LABEL[step]}: ${STATE_WORD[state]}`}
          className={cn(
            'flex items-start gap-2 text-xs',
            state === 'failed' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {state === 'running' ? (
            <Spinner className="mt-0.5 h-3 w-3 shrink-0 motion-safe:animate-spin" />
          ) : state === 'done' ? (
            <CircleCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
          ) : (
            <CircleX className="mt-0.5 h-3 w-3 shrink-0" />
          )}
          <span>
            {STEP_LABEL[step]}
            {message ? `: ${message}` : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Folds a step event into the list: a step seen before is updated where it stands. */
export function withStep(
  steps: StepStates,
  event: { step: DeployFirewallStep; state: DeployFirewallStepState; message?: string },
): StepStates {
  const entry = { step: event.step, state: event.state, message: event.message };
  const at = steps.findIndex((known) => known.step === event.step);
  if (at < 0) return [...steps, entry];
  return steps.map((known, index) => (index === at ? entry : known));
}
