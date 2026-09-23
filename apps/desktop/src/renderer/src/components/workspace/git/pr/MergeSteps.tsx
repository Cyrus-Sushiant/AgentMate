import type { MergeStep, MergeStepResult } from '@shared/apiTypes';
import { Check, CircleX, Spinner } from '@/components/icons';
import { cn } from '@/lib/utils';

const PENDING_LABEL: Record<MergeStep, string> = {
  merge: 'Merging on GitHub…',
  checkout: 'Switching branch…',
  pull: 'Pulling…',
  delete: 'Deleting the branch…',
};

/**
 * What a merge did, one line per step. While it runs, the steps still to come are listed with a
 * spinner on the first, so the user can see how far along it is.
 */
export function MergeSteps({
  steps,
  pending,
}: {
  steps: MergeStepResult[];
  /** Steps expected but not reported yet; only the first spins. */
  pending?: MergeStep[];
}): React.JSX.Element {
  return (
    <ol className="space-y-1" aria-live="polite">
      {steps.map((step) => (
        <li key={step.step} className="flex items-start gap-1.5 text-[11.5px] leading-snug">
          {step.ok ? (
            <Check className="mt-0.5 h-2.5 w-2.5 shrink-0 text-success" />
          ) : (
            <CircleX className="mt-0.5 h-2.5 w-2.5 shrink-0 text-destructive" />
          )}
          <span className={cn('min-w-0 break-words', !step.ok && 'text-destructive')}>
            {step.message}
          </span>
        </li>
      ))}
      {pending?.map((step, index) => (
        <li
          key={step}
          className="flex items-center gap-1.5 text-[11.5px] leading-snug text-muted-foreground"
        >
          {index === 0 ? (
            <Spinner className="h-2.5 w-2.5 shrink-0 animate-spin motion-reduce:animate-none" />
          ) : (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border" />
          )}
          {PENDING_LABEL[step]}
        </li>
      ))}
    </ol>
  );
}
