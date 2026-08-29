import { Check } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { BlueprintWizardStep } from './wizardSteps';
import { BLUEPRINT_WIZARD_STEPS } from './wizardSteps';

/**
 * Every cell is clickable, unlike the review wizard's rail. A blueprint gets
 * filled in over days and edited out of order, so gating a step behind the one
 * before it would only get in the way.
 *
 * The column count follows the rail's own width rather than the window's. This
 * sits inside the project page, behind a nav column that can be open or closed,
 * so a viewport breakpoint reads a couple of hundred pixels wider than the box
 * actually is and packs seven cells into a space that fits four.
 */
export function BlueprintStepRail({
  step,
  filled,
  onSelect,
}: {
  step: BlueprintWizardStep;
  /** Steps that already have text, marked with a tick. */
  filled: Set<BlueprintWizardStep>;
  onSelect: (step: BlueprintWizardStep) => void;
}): React.JSX.Element {
  return (
    <div className="@container">
      <ol className="grid grid-cols-2 gap-1.5 @lg:grid-cols-3 @2xl:grid-cols-4 @6xl:grid-cols-7">
        {BLUEPRINT_WIZARD_STEPS.map((entry) => {
          const active = entry.id === step;
          const done = !active && filled.has(entry.id);
          const StepIcon = entry.icon;
          return (
            <li key={entry.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                // h-full so a hint that wraps lifts the whole row instead of
                // leaving one tall cell among six short ones.
                className={cn(
                  'flex h-full w-full cursor-pointer flex-col rounded-lg border px-2 py-2 text-left transition-colors',
                  active
                    ? 'border-primary/50 bg-primary/10'
                    : done
                      ? 'border-border bg-muted/40 hover:bg-muted'
                      : 'border-border bg-background/40 hover:bg-muted/50',
                )}
              >
                <span
                  className={cn(
                    'flex w-full items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <StepIcon className="h-3 w-3 shrink-0" />
                  )}
                  <span className="min-w-0 truncate">{entry.label}</span>
                </span>
                <span className="mt-0.5 hidden pl-[1.125rem] text-xs leading-snug text-muted-foreground @lg:block">
                  {entry.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
