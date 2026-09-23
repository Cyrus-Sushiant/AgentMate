import {
  type CliDefinition,
  type CliLaunchDefault,
  type CliLaunchMode,
  type CliLaunchOptions,
  cliLaunchOptions,
  configuredArgsWithout,
  EFFORT_LABELS,
  type EffortLevel,
  type LaunchDefaultPart,
  launchDefaultParts,
  parseCliArgs,
  type SavedArgSetting,
  savedArgSettings,
} from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { EffortPicker } from '@/components/cli/RunSettingsFields';
import { CliLogo } from '@/components/cliLogos';
import { Check, ChevronDown, ChevronRight, TriangleAlert, Undo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { orderedClis } from '@/components/workspace/useAgentChoices';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useCliStore } from '@/stores/cliStore';

interface LaunchableCli {
  cli: CliDefinition;
  options: CliLaunchOptions;
}

/**
 * Model, effort, and permission mode each agent opens with in a terminal. One row per CLI that
 * has launch flags AgentMate knows about. Anything left on "Not set" adds no flag.
 */
export function CliLaunchDefaultsSettings(): React.JSX.Element {
  const cliOrder = useCliStore((s) => s.cliOrder);
  const defaults = useCliStore((s) => s.cliLaunchDefaults);
  const status = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
    staleTime: 5 * 60_000,
  });
  const installed = new Set((status.data ?? []).filter((c) => c.installed).map((c) => c.id));
  const launchable: LaunchableCli[] = orderedClis(cliOrder).flatMap((cli) => {
    const options = cliLaunchOptions(cli.id);
    return options ? [{ cli, options }] : [];
  });
  // Until detection answers, nothing counts as missing, so the list doesn't jump around.
  const known = status.data !== undefined;
  const primary = launchable.filter(
    ({ cli }) => !known || installed.has(cli.id) || defaults[cli.id],
  );
  const others = launchable.filter((item) => !primary.includes(item));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  const toggle = (cliId: string): void => setExpanded((open) => (open === cliId ? null : cliId));
  const renderRows = (items: LaunchableCli[], dimmed: boolean): React.JSX.Element[] =>
    items.map(({ cli, options }) => (
      <LaunchDefaultsRow
        key={cli.id}
        cli={cli}
        options={options}
        open={expanded === cli.id}
        onToggle={() => toggle(cli.id)}
        notInstalled={dimmed}
      />
    ));

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Used for Workspace tabs and terminals. The model and effort also apply when AgentMate asks
        the CLI something in the background, like a commit message or a version bump. Alt+click a
        launcher to start without them.
      </p>
      <div className="overflow-hidden rounded-lg border border-border/70">
        {primary.length ? (
          renderRows(primary, false)
        ) : (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            None of the agents with launch options are installed.
          </p>
        )}
        {others.length > 0 && showOthers ? renderRows(others, true) : null}
      </div>
      {others.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowOthers((value) => !value)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {showOthers ? (
            <ChevronDown className="h-2.5 w-2.5" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5" />
          )}
          {showOthers ? 'Hide' : 'Show'} {others.length} not installed
        </button>
      ) : null}
    </div>
  );
}

/** Effort names short enough to sit side by side in the segmented control. */
function modelLabel(options: CliLaunchOptions, model: string): string {
  return options.models.find((m) => m.value === model)?.label ?? model;
}

function LaunchDefaultsRow({
  cli,
  options,
  open,
  onToggle,
  notInstalled,
}: {
  cli: CliDefinition;
  options: CliLaunchOptions;
  open: boolean;
  onToggle: () => void;
  notInstalled: boolean;
}): React.JSX.Element {
  const value = useCliStore((s) => s.cliLaunchDefaults[cli.id]);
  const savedArgLine = useCliStore((s) => s.cliArgs[cli.id]);
  const setDefault = useCliStore((s) => s.setCliLaunchDefault);
  const setCliArgs = useCliStore((s) => s.setCliArgs);
  const clearDefault = useCliStore((s) => s.clearCliLaunchDefault);
  const panelId = useId();

  const current: CliLaunchDefault = value ?? {};
  const parts = launchDefaultParts(cli.id, current, parseCliArgs(savedArgLine));
  // What the Arguments box sets on its own. Shown here too, or a `--model haiku` saved there
  // would start every tab on Haiku while this section says the model is "Not set".
  const fromArgs = savedArgSettings(cli.id, parseCliArgs(savedArgLine));
  const mode = options.modes.find((m) => m.id === current.mode);
  const isSet = Boolean(current.model || current.effort || mode);
  const sent = (kind: LaunchDefaultPart['kind']): boolean =>
    parts.some((part) => part.kind === kind && part.applied);
  const argFor = (kind: SavedArgSetting['kind']): SavedArgSetting | undefined =>
    fromArgs.find((arg) => arg.kind === kind);
  const unsetFromArgs = fromArgs.filter((arg) => !parts.some((part) => part.kind === arg.kind));

  const update = (patch: Partial<CliLaunchDefault>): void => setDefault(cli.id, patch);
  const removeFromArgs = (arg: SavedArgSetting): void => {
    if (arg.value === undefined) return;
    setCliArgs(cli.id, configuredArgsWithout(savedArgLine ?? '', [arg.flag, arg.value]));
  };

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          'flex min-h-10 w-full items-center gap-3 bg-background/40 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04]',
          open && 'bg-foreground/[0.04]',
        )}
      >
        <CliLogo cliId={cli.id} className="h-4 w-4 shrink-0" />
        <span
          className={cn('min-w-0 shrink truncate text-sm', notInstalled && 'text-muted-foreground')}
        >
          {cli.name}
        </span>
        <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
          {isSet || unsetFromArgs.length ? (
            <>
              {current.model ? (
                <SummaryChip skipped={!sent('model')}>
                  {modelLabel(options, current.model)}
                </SummaryChip>
              ) : null}
              {current.effort ? (
                <SummaryChip skipped={!sent('effort')}>{EFFORT_LABELS[current.effort]}</SummaryChip>
              ) : null}
              {mode ? (
                <SummaryChip risky={mode.risky} skipped={!sent('mode')}>
                  {mode.label}
                </SummaryChip>
              ) : null}
              {unsetFromArgs.map((arg) => (
                <SummaryChip key={arg.kind} fromArgs>
                  {arg.kind === 'model' && arg.value
                    ? modelLabel(options, arg.value)
                    : savedArgText(arg)}
                </SummaryChip>
              ))}
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">
              {notInstalled ? 'Not installed' : 'Not set'}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="space-y-4 border-t border-border/50 bg-background/20 px-3 py-4"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {options.modelFlag ? (
              <ModelField
                cli={cli}
                options={options}
                value={current.model}
                part={parts.find((p) => p.kind === 'model')}
                fromArgs={argFor('model')}
                onRemoveFromArgs={removeFromArgs}
                onChange={(model) => update({ model })}
              />
            ) : null}
            {options.efforts.length && options.effortArgs ? (
              <EffortField
                options={options}
                model={current.model}
                value={current.effort}
                part={parts.find((p) => p.kind === 'effort')}
                fromArgs={argFor('effort')}
                onRemoveFromArgs={removeFromArgs}
                onChange={(effort) => update({ effort })}
              />
            ) : null}
          </div>

          {options.modes.length ? (
            <ModeField
              modes={options.modes}
              value={current.mode}
              part={parts.find((p) => p.kind === 'mode')}
              fromArgs={argFor('mode')}
              onRemoveFromArgs={removeFromArgs}
              onChange={(next) => update({ mode: next })}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <CommandPreview
              executable={cli.executableNames[0] ?? cli.id}
              parts={parts}
              savedArgs={savedArgLine}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={!isSet}
              onClick={() => clearDefault(cli.id)}
            >
              <Undo /> Reset
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A chip for one set field. `skipped` fades it when the field won't reach the command line. */
function SummaryChip({
  children,
  risky,
  skipped,
  fromArgs,
}: {
  children: React.ReactNode;
  risky?: boolean;
  skipped?: boolean;
  /** Set by the Arguments box rather than here, drawn dashed so it reads differently. */
  fromArgs?: boolean;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-40 items-center gap-1 truncate rounded-full border px-2 text-[11px]',
        fromArgs && 'border-dashed',
        skipped
          ? 'border-border/50 text-muted-foreground/60 line-through'
          : risky
            ? 'border-warning/35 bg-warning/10 text-warning'
            : 'border-border/70 bg-foreground/[0.04] text-foreground/80',
      )}
    >
      {risky ? <TriangleAlert className="h-2.5 w-2.5 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}): React.JSX.Element {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

/** Explains that the user's own saved arguments already cover this field. */
function OverriddenNote({
  part,
}: {
  part: LaunchDefaultPart | undefined;
}): React.JSX.Element | null {
  if (!part || part.applied) return null;
  return (
    <p className="text-[11px] leading-relaxed text-warning">
      Skipped: this CLI's saved arguments already set it.
    </p>
  );
}

function savedArgText(arg: SavedArgSetting): string {
  return arg.value === undefined ? arg.flag : `${arg.flag} ${arg.value}`;
}

/**
 * For a field left on Not set here that the CLI's saved arguments set anyway, so "Not set" never
 * hides a flag that still goes out with every launch.
 */
function FromArgsNote({
  arg,
  onRemove,
}: {
  arg: SavedArgSetting;
  onRemove: (arg: SavedArgSetting) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-relaxed text-warning">
      <span>
        Still sent: the saved arguments include{' '}
        <code className="rounded bg-warning/10 px-1 font-mono">{savedArgText(arg)}</code>.
      </span>
      {arg.value !== undefined ? (
        <button
          type="button"
          onClick={() => onRemove(arg)}
          className="font-medium underline underline-offset-2 hover:text-foreground"
        >
          Remove it
        </button>
      ) : null}
    </div>
  );
}

function ModelField({
  cli,
  options,
  value,
  part,
  fromArgs,
  onRemoveFromArgs,
  onChange,
}: {
  cli: CliDefinition;
  options: CliLaunchOptions;
  value: string | undefined;
  part: LaunchDefaultPart | undefined;
  fromArgs: SavedArgSetting | undefined;
  onRemoveFromArgs: (arg: SavedArgSetting) => void;
  onChange: (model: string | undefined) => void;
}): React.JSX.Element {
  const hasList = options.models.length > 0;
  return (
    <div className="space-y-1.5">
      <FieldLabel>Model</FieldLabel>
      <Combobox
        value={value ?? ''}
        onChange={(next) => onChange(next.trim() || undefined)}
        options={options.models.map((m) => ({
          value: m.value,
          label: m.label,
          keywords: [m.value],
        }))}
        placeholder="Not set"
        searchPlaceholder={
          hasList
            ? 'Search or type a model name…'
            : `Type a model name${options.modelPlaceholder ? `, e.g. ${options.modelPlaceholder}` : ''}…`
        }
        emptyText="Type a model name to use it."
        customLabel={(text) => `Use "${text}"`}
        allowCustom
        clearable
      />
      {part && !part.applied ? (
        <OverriddenNote part={part} />
      ) : !value && fromArgs ? (
        <FromArgsNote arg={fromArgs} onRemove={onRemoveFromArgs} />
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {value
            ? `Starts ${cli.name} on this model.`
            : hasList
              ? 'Not set: the CLI picks its own model.'
              : 'Not set: the CLI uses the model from its own config.'}
        </p>
      )}
    </div>
  );
}

function EffortField({
  options,
  model,
  value,
  part,
  fromArgs,
  onRemoveFromArgs,
  onChange,
}: {
  options: CliLaunchOptions;
  model: string | undefined;
  value: EffortLevel | undefined;
  part: LaunchDefaultPart | undefined;
  fromArgs: SavedArgSetting | undefined;
  onRemoveFromArgs: (arg: SavedArgSetting) => void;
  onChange: (effort: EffortLevel | undefined) => void;
}): React.JSX.Element {
  const knownModel = options.models.find((m) => m.value === model);
  const noEffort = Boolean(knownModel && !knownModel.efforts?.length);
  const fits = (level: EffortLevel): boolean =>
    !knownModel || !!knownModel.efforts?.includes(level);

  return (
    <div className="space-y-1.5">
      <FieldLabel>Effort</FieldLabel>
      <EffortPicker options={options} model={model} value={value} onChange={onChange} />
      {part && !part.applied ? (
        <OverriddenNote part={part} />
      ) : !value && fromArgs ? (
        <FromArgsNote arg={fromArgs} onRemove={onRemoveFromArgs} />
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {noEffort && knownModel
            ? `${knownModel.label} has no effort setting.`
            : value && !fits(value)
              ? `${knownModel?.label ?? 'This model'} can't use ${EFFORT_LABELS[value]}, so it is left off.`
              : value
                ? 'How hard the model thinks before answering.'
                : 'Not set: the CLI uses its own effort level.'}
        </p>
      )}
    </div>
  );
}

function ModeField({
  modes,
  value,
  part,
  fromArgs,
  onRemoveFromArgs,
  onChange,
}: {
  modes: readonly CliLaunchMode[];
  value: string | undefined;
  part: LaunchDefaultPart | undefined;
  fromArgs: SavedArgSetting | undefined;
  onRemoveFromArgs: (arg: SavedArgSetting) => void;
  onChange: (mode: string | undefined) => void;
}): React.JSX.Element {
  const selected = modes.find((m) => m.id === value);
  const cards: {
    id: string | undefined;
    label: string;
    description: string;
    risky?: boolean;
  }[] = [{ id: undefined, label: 'Not set', description: "Uses the CLI's own setting." }, ...modes];

  return (
    <div className="space-y-1.5">
      <FieldLabel>Mode</FieldLabel>
      <div
        role="radiogroup"
        aria-label="Mode"
        className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {cards.map((card) => {
          const checked = value === card.id || (card.id === undefined && !selected);
          return (
            <button
              key={card.id ?? 'unset'}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(card.id)}
              className={cn(
                'group relative flex min-h-[3.25rem] flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                checked
                  ? card.risky
                    ? 'border-warning/50 bg-warning/[0.08]'
                    : 'border-primary/50 bg-primary/[0.08]'
                  : 'border-border/70 bg-background/40 hover:border-foreground/20 hover:bg-foreground/[0.03]',
              )}
            >
              <span className="flex w-full items-center gap-1.5 text-sm">
                {card.risky ? <TriangleAlert className="h-3 w-3 shrink-0 text-warning" /> : null}
                <span
                  className={cn(
                    'truncate',
                    !checked && card.id === undefined && 'text-muted-foreground',
                  )}
                >
                  {card.label}
                </span>
                {checked ? (
                  <Check
                    className={cn(
                      'ml-auto h-3 w-3 shrink-0',
                      card.risky ? 'text-warning' : 'text-primary',
                    )}
                  />
                ) : null}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">
                {card.description}
              </span>
            </button>
          );
        })}
      </div>
      {part && !part.applied ? <OverriddenNote part={part} /> : null}
      {!selected && fromArgs ? <FromArgsNote arg={fromArgs} onRemove={onRemoveFromArgs} /> : null}
      {selected?.risky && part?.applied ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.07] px-2.5 py-2 text-[11px] leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Every tab you open with this agent can change files and run commands without asking. Use
            it for projects you can restore from git.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function CommandPreview({
  executable,
  parts,
  savedArgs,
}: {
  executable: string;
  parts: LaunchDefaultPart[];
  savedArgs: string | undefined;
}): React.JSX.Element {
  return (
    <SimpleTooltip label="What the terminal types to start this agent: these defaults, then the saved arguments.">
      <code className="min-w-0 max-w-full truncate rounded-md bg-foreground/[0.05] px-2 py-1 font-mono text-[11px] text-muted-foreground">
        <span className="text-foreground/90">{executable}</span>
        {parts.length === 0 && !savedArgs ? (
          <span className="font-sans text-muted-foreground/70"> (no flags added)</span>
        ) : null}
        {parts.map((part) => (
          <span
            key={part.kind}
            className={cn(!part.applied && 'text-muted-foreground/50 line-through')}
          >
            {' '}
            {part.args.join(' ')}
          </span>
        ))}
        {savedArgs ? <span className="text-foreground/90"> {savedArgs}</span> : null}
      </code>
    </SimpleTooltip>
  );
}
