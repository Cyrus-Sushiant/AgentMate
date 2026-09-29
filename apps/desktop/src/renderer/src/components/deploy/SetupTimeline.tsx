import { CircleCheck, CircleX, Spinner } from '@/components/icons';
import type { TimelineStatus, TimelineStep } from '@/lib/deploy/setup';
import { cn } from '@/lib/utils';

/** Spoken with each step, since the icon alone does not say it. */
const STATUS_TEXT: Record<TimelineStatus, string> = {
  pending: 'waiting',
  running: 'in progress',
  done: 'done',
  failed: 'failed',
};

function StepIcon({ status }: { status: TimelineStatus }): React.JSX.Element {
  if (status === 'done') return <CircleCheck className="h-5 w-5 text-success" />;
  if (status === 'failed') return <CircleX className="h-5 w-5 text-destructive" />;
  if (status === 'running') {
    return <Spinner className="h-5 w-5 text-primary motion-safe:animate-spin" />;
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/40" />
    </span>
  );
}

/** Every step of an install or removal, with the one running now and why one failed. */
export function SetupTimeline({
  steps,
  label,
}: {
  steps: TimelineStep[];
  label: string;
}): React.JSX.Element {
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.phase} className="relative flex gap-3 pb-4 last:pb-0">
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                'absolute left-[9.5px] top-6 bottom-1 w-px',
                step.status === 'done' ? 'bg-success/40' : 'bg-border',
              )}
            />
          )}
          <span className="relative z-10 shrink-0">
            <StepIcon status={step.status} />
          </span>
          <div className="min-w-0 flex-1 pt-px">
            <p
              className={cn(
                'text-sm',
                step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                step.status === 'running' && 'font-medium',
              )}
            >
              {step.label}
              <span className="sr-only">, {STATUS_TEXT[step.status]}</span>
            </p>
            {step.status === 'running' && step.percent !== undefined && (
              <div
                role="progressbar"
                aria-label={`${step.label}, ${step.percent} percent`}
                aria-valuenow={step.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${step.percent}%` }}
                />
              </div>
            )}
            {step.detail && (
              <p
                className={cn(
                  'mt-1 whitespace-pre-wrap break-words text-xs',
                  step.status === 'failed' ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {step.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
