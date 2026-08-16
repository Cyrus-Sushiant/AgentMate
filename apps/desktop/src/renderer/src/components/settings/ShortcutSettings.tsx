import { useEffect, useRef, useState } from 'react';
import { Keyboard, Plus, RefreshCw, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  bindingProblem,
  formatShortcut,
  sameShortcut,
  SHORTCUT_COMMANDS,
  SHORTCUT_GROUPS,
  type Shortcut,
  type ShortcutCommand,
  shortcutFromEvent,
  shortcutId,
} from '@/lib/shortcuts';
import { cn } from '@/lib/utils';
import { bindingsFor, conflictingCommand, useShortcutStore } from '@/stores/shortcutStore';

/**
 * Captures the next keypress as a binding. It swallows the event so the app's
 * own shortcuts (and the settings page's Ctrl+S) stay quiet while recording.
 */
function ShortcutRecorder({
  onCapture,
  onCancel,
}: {
  onCapture: (shortcut: Shortcut) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="textbox"
      tabIndex={0}
      aria-label="Press the keys for the new shortcut"
      onBlur={onCancel}
      onKeyDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') {
          onCancel();
          return;
        }
        const captured = shortcutFromEvent(event.nativeEvent);
        // Modifier-only presses just mean the user is mid-chord, keep waiting.
        if (captured) onCapture(captured);
      }}
      className="flex h-7 items-center rounded-md border border-primary bg-primary/10 px-2.5 text-[11px] font-medium text-primary outline-none ring-2 ring-primary/30"
    >
      Press keys… (Esc to cancel)
    </div>
  );
}

function CommandRow({ command }: { command: ShortcutCommand }): React.JSX.Element {
  const overrides = useShortcutStore((s) => s.overrides);
  const setBindings = useShortcutStore((s) => s.setBindings);
  const resetCommand = useShortcutStore((s) => s.resetCommand);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bindings = bindingsFor(command.id, overrides);
  const customized = overrides[command.id] !== undefined;

  function capture(shortcut: Shortcut): void {
    const problem = bindingProblem(shortcut);
    if (problem) {
      setError(problem);
      return;
    }
    if (bindings.some((binding) => sameShortcut(binding, shortcut))) {
      setRecording(false);
      setError(null);
      return;
    }
    const clash = conflictingCommand(shortcut, command.id, overrides);
    if (clash) {
      setError(`${formatShortcut(shortcut)} is already used by "${clash.label}".`);
      return;
    }
    setBindings(command.id, [...bindings, shortcut]);
    setRecording(false);
    setError(null);
  }

  function remove(shortcut: Shortcut): void {
    setBindings(
      command.id,
      bindings.filter((binding) => !sameShortcut(binding, shortcut)),
    );
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{command.label}</p>
        <p className="text-xs text-muted-foreground">{command.description}</p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {bindings.map((binding) => (
          <span
            key={shortcutId(binding)}
            className="flex h-7 items-center gap-1 rounded-md border border-border bg-background/60 pl-2.5 pr-1 text-[11px] font-medium"
          >
            {formatShortcut(binding)}
            <SimpleTooltip label="Remove">
              <button
                type="button"
                aria-label={`Remove ${formatShortcut(binding)}`}
                onClick={() => remove(binding)}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </SimpleTooltip>
          </span>
        ))}

        {bindings.length === 0 && !recording ? (
          <span className="text-[11px] text-muted-foreground">Not set</span>
        ) : null}

        {recording ? (
          <ShortcutRecorder
            onCapture={capture}
            onCancel={() => {
              setRecording(false);
              setError(null);
            }}
          />
        ) : (
          <SimpleTooltip label="Add a shortcut">
            <button
              type="button"
              aria-label={`Add a shortcut for ${command.label}`}
              onClick={() => {
                setError(null);
                setRecording(true);
              }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
          </SimpleTooltip>
        )}

        <SimpleTooltip label="Restore the default">
          <button
            type="button"
            aria-label={`Reset ${command.label} to its default`}
            disabled={!customized}
            onClick={() => {
              resetCommand(command.id);
              setError(null);
            }}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
              customized
                ? 'cursor-pointer hover:bg-accent hover:text-foreground'
                : 'pointer-events-none opacity-30',
            )}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </SimpleTooltip>
      </div>
    </div>
  );
}

export function ShortcutSettings(): React.JSX.Element {
  const overrides = useShortcutStore((s) => s.overrides);
  const resetAll = useShortcutStore((s) => s.resetAll);
  const anyCustom = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Shortcuts are matched by the physical key, not the character it types, so they keep
          working on any keyboard layout. A dialog that binds the same combination wins while it is
          open.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!anyCustom}
          onClick={() => resetAll()}
          className="shrink-0"
        >
          <RefreshCw /> Restore defaults
        </Button>
      </div>

      {SHORTCUT_GROUPS.map((group) => {
        const commands = SHORTCUT_COMMANDS.filter((command) => command.group === group.name);
        if (commands.length === 0) return null;
        return (
          <div key={group.name} className="space-y-2">
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Keyboard className="h-3 w-3" />
                {group.name}
              </p>
              {group.hint ? (
                <p className="text-[11px] text-muted-foreground">{group.hint}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              {commands.map((command) => (
                <CommandRow key={command.id} command={command} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
