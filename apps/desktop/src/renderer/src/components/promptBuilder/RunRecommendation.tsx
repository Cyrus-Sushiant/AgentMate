import type { EffortLevel, PromptType, RunChoice, RunRecommendation } from '@agentmat/core';
import {
  defaultEffortFor,
  EFFORT_LABELS,
  getModelPrice,
  recommendRun,
  relativeCostLevel,
  runChoiceArgs,
} from '@agentmat/core';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CliLogo } from '@/components/cliLogos';
import {
  ArrowDown,
  ArrowUp,
  Bolt,
  Check,
  ChevronDown,
  CircleInfo,
  Copy,
  Undo,
} from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RunOverride {
  targetAI: string;
  modelId: string;
  effort: EffortLevel | undefined;
}

export interface RunRecommendationState {
  recommendation: RunRecommendation;
  choice: RunChoice;
  /** True when the user picked something other than the recommendation. */
  isCustom: boolean;
  selectModel: (modelId: string) => void;
  selectEffort: (effort: EffortLevel) => void;
  reset: () => void;
  /** CLI args for the current choice, e.g. `--model sonnet --effort medium`. */
  args: string[];
}

/**
 * Live model/effort suggestion for a Prompt Builder form. A manual pick sticks while the
 * user keeps typing, but only for the target it was made on, since model names don't
 * carry over between CLIs.
 */
export function useRunRecommendation(input: {
  rawInput: string;
  promptType: PromptType;
  targetAI: string;
}): RunRecommendationState {
  const { rawInput, promptType, targetAI } = input;
  const recommendation = useMemo(
    () => recommendRun({ rawInput, promptType, targetAI }),
    [rawInput, promptType, targetAI],
  );
  const [override, setOverride] = useState<RunOverride | null>(null);

  const overrideModel =
    override?.targetAI === targetAI
      ? recommendation.profile.models.find((m) => m.id === override.modelId)
      : undefined;
  const choice: RunChoice =
    override && overrideModel
      ? {
          model: overrideModel,
          effort:
            override.effort && overrideModel.efforts?.includes(override.effort)
              ? override.effort
              : defaultEffortFor(overrideModel),
        }
      : recommendation.recommended;

  const isCustom =
    choice.model.id !== recommendation.recommended.model.id ||
    choice.effort !== recommendation.recommended.effort;

  return {
    recommendation,
    choice,
    isCustom,
    selectModel: (modelId) => {
      const model = recommendation.profile.models.find((m) => m.id === modelId);
      if (!model) return;
      const effort =
        modelId === recommendation.recommended.model.id
          ? recommendation.recommended.effort
          : defaultEffortFor(model);
      setOverride({ targetAI, modelId, effort });
    },
    selectEffort: (effort) => setOverride({ targetAI, modelId: choice.model.id, effort }),
    reset: () => setOverride(null),
    args: runChoiceArgs(recommendation.profile, choice),
  };
}

const COMPLEXITY_COPY = {
  light: { label: 'Light task', className: 'text-success' },
  moderate: { label: 'Moderate task', className: 'text-warning' },
  complex: { label: 'Complex task', className: 'text-destructive' },
} as const;

const COST_COPY = ['Lowest cost', 'Low cost', 'Moderate cost', 'High cost', 'Highest cost'];

function costTone(level: number): string {
  if (level <= 2) return 'bg-success';
  if (level === 3) return 'bg-warning';
  return 'bg-destructive';
}

function CostMeter({ level, className }: { level: number; className?: string }): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-sm transition-colors',
            i <= level ? costTone(level) : 'bg-foreground/15',
          )}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </span>
  );
}

function formatPrice(value: number): string {
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export function RunRecommendationPanel({
  state,
  className,
}: {
  state: RunRecommendationState;
  className?: string;
}): React.JSX.Element {
  const { recommendation, choice, isCustom, selectModel, selectEffort, reset, args } = state;
  const { profile, assessment, recommended } = recommendation;
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const complexity = COMPLEXITY_COPY[assessment.complexity];
  const costLevel = relativeCostLevel(profile, choice);
  const price = choice.model.pricingId ? getModelPrice(choice.model.pricingId) : null;
  const command = profile.executable ? [profile.executable, ...args].join(' ') : args.join(' ');
  const showCommand = args.length > 0;

  async function copyCommand(): Promise<void> {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background/60">
            {profile.cliId ? (
              <CliLogo cliId={profile.cliId} className="h-3.5 w-3.5" />
            ) : (
              <Bolt className="h-3.5 w-3.5 text-primary" />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight">Recommended run</div>
            <p className="truncate text-[11px] text-muted-foreground">
              {assessment.hasRequest
                ? `Model and effort for ${recommendation.targetAI}, sized to this request`
                : 'Based on the prompt type until you describe the request'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn('text-[11px] font-medium', complexity.className)}>
            {complexity.label}
          </span>
          <span
            className="h-1 w-20 overflow-hidden rounded-full bg-foreground/10"
            role="meter"
            aria-label="Task complexity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={assessment.score}
          >
            <span
              className="block h-full rounded-full bg-gradient-to-r from-success via-warning to-destructive transition-[width] duration-300"
              style={{ width: `${Math.max(6, assessment.score)}%` }}
            />
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Model
          </span>
          {isCustom && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Undo className="h-2.5 w-2.5" /> Use recommended
            </button>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Model"
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${profile.models.length}, minmax(0, 1fr))` }}
        >
          {profile.models.map((model) => {
            const selected = model.id === choice.model.id;
            const isRecommended = model.id === recommended.model.id;
            const level = relativeCostLevel(profile, {
              model,
              effort: isRecommended ? recommended.effort : defaultEffortFor(model),
            });
            return (
              <button
                key={model.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectModel(model.id)}
                className={cn(
                  'relative flex min-w-0 flex-col items-start gap-1 rounded-lg border px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary/60 bg-primary/10 shadow-[0_0_14px_-6px_hsl(var(--primary)/0.6)]'
                    : 'border-border bg-background/40 hover:border-foreground/20 hover:bg-accent/50',
                )}
              >
                <span className="flex w-full items-center justify-between gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {model.tier}
                  </span>
                  {isRecommended && (
                    <SimpleTooltip label="Recommended for this request">
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2 w-2" />
                      </span>
                    </SimpleTooltip>
                  )}
                </span>
                <span className="w-full truncate text-xs font-semibold">{model.label}</span>
                <CostMeter level={level} />
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">{choice.model.bestFor}.</p>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Effort
        </span>
        {choice.model.efforts?.length ? (
          <div
            role="radiogroup"
            aria-label="Effort"
            className="flex rounded-lg border border-border bg-background/40 p-0.5"
          >
            {choice.model.efforts.map((level) => {
              const selected = level === choice.effort;
              const isRecommended =
                choice.model.id === recommended.model.id && level === recommended.effort;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectEffort(level)}
                  className={cn(
                    'relative flex-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {EFFORT_LABELS[level]}
                  {isRecommended && !selected && (
                    <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="flex items-start gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground">
            <CircleInfo className="mt-px h-3 w-3 shrink-0" />
            {profile.effortHint}
          </p>
        )}
      </div>

      {assessment.signals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-[11px] text-muted-foreground">Why</span>
          {assessment.signals.map((signal) => (
            <span
              key={signal.label}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px]',
                signal.direction === 'up'
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-success/30 bg-success/10 text-success',
              )}
            >
              {signal.direction === 'up' ? (
                <ArrowUp className="h-2 w-2" />
              ) : (
                <ArrowDown className="h-2 w-2" />
              )}
              {signal.label}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <CostMeter level={costLevel} />
            <span className="font-medium">{COST_COPY[costLevel - 1]}</span>
            <span className="text-muted-foreground">for {recommendation.targetAI}</span>
          </span>
          {price && (
            <span className="tabular-nums text-muted-foreground">
              {formatPrice(price.input)} in · {formatPrice(price.output)} out / 1M
            </span>
          )}
        </div>
        {showCommand && (
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate rounded-md bg-background/70 px-2 py-1 font-mono text-[11px]">
              {command}
            </code>
            <SimpleTooltip label={copied ? 'Copied' : 'Copy command'}>
              <button
                type="button"
                onClick={() => void copyCommand()}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                <span className="sr-only">Copy command</span>
              </button>
            </SimpleTooltip>
          </div>
        )}
        {profile.note && <p className="text-[11px] text-muted-foreground">{profile.note}</p>}
      </div>
    </div>
  );
}

/** One-line summary for tight layouts; the full panel opens in a popover. */
export function RunRecommendationChip({
  state,
  className,
}: {
  state: RunRecommendationState;
  className?: string;
}): React.JSX.Element {
  const { recommendation, choice, isCustom } = state;
  const costLevel = relativeCostLevel(recommendation.profile, choice);

  return (
    <PopoverPrimitive.Root>
      <SimpleTooltip label="Which model and effort to run this with">
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-8 min-w-0 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-xs transition-colors hover:border-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:border-primary/50',
              className,
            )}
          >
            <Bolt
              className={cn(
                'h-3 w-3 shrink-0',
                isCustom ? 'text-muted-foreground' : 'text-primary',
              )}
            />
            <span className="truncate font-medium">{choice.model.label}</span>
            {choice.effort && (
              <span className="truncate text-muted-foreground">
                {EFFORT_LABELS[choice.effort]} effort
              </span>
            )}
            <CostMeter level={costLevel} className="shrink-0" />
            <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
          </button>
        </PopoverPrimitive.Trigger>
      </SimpleTooltip>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[min(27rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover/90 p-3 text-popover-foreground shadow-2xl backdrop-blur-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <RunRecommendationPanel state={state} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
