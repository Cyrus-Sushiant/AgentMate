import type { DockerContainer } from '@shared/apiTypes';
import { useRef, useState } from 'react';
import { Docker } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  dismissStopContainers,
  resolveStopContainers,
  type StopContainersAnswer,
  useStopContainersPromptStore,
} from '@/stores/stopContainersPromptStore';

function containerCount(count: number): string {
  return `${count} container${count === 1 ? '' : 's'}`;
}

/** "Web Shop has stopped", "Web Shop and Admin have stopped", "3 projects have stopped". */
function describeStopped(projects: string[], containers: number): string {
  const subject =
    projects.length === 0
      ? 'The run'
      : projects.length === 1
        ? projects[0]
        : projects.length === 2
          ? `${projects[0]} and ${projects[1]}`
          : `${projects.length} projects`;
  const has = projects.length > 1 ? 'have' : 'has';
  const its = projects.length > 1 ? 'their' : 'its';
  const are = containers === 1 ? 'is' : 'are';
  return `${subject} ${has} stopped, but ${containerCount(containers)} from ${its} Docker Compose setup ${are} still running and using memory.`;
}

function ContainerRow({
  container,
  checked,
  onCheckedChange,
}: {
  container: DockerContainer;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-foreground/[0.05]">
        <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} />
        <span className="min-w-0 flex-1">
          <SimpleTooltip label={container.name}>
            <span className="block truncate text-sm font-medium">{container.name}</span>
          </SimpleTooltip>
          <SimpleTooltip label={container.image}>
            <span className="block truncate text-xs text-muted-foreground">{container.image}</span>
          </SimpleTooltip>
        </span>
        <SimpleTooltip label={container.status}>
          <span className="max-w-[9rem] shrink-0 truncate text-xs text-muted-foreground">
            {container.status}
          </span>
        </SimpleTooltip>
      </label>
    </li>
  );
}

/**
 * Inside the dialog content on purpose: Radix unmounts that when the dialog closes, so every
 * dialog starts with everything selected and nothing remembered, whatever the last one was.
 */
function StopContainersForm({
  projects,
  containers,
  onAnswer,
}: {
  projects: string[];
  containers: DockerContainer[];
  onAnswer: (answer: StopContainersAnswer) => void;
}): React.JSX.Element {
  // Which ones the user turned off, rather than which are on: a container that joins the list
  // while it is open (another run stopping) arrives selected without any extra bookkeeping.
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const [remember, setRemember] = useState(false);

  const selected = containers.filter((one) => !kept.has(one.id));
  const all = selected.length === containers.length;
  const none = selected.length === 0;
  // "Always stop" would stop everything next time, so it cannot stand for a hand-picked few.
  const partial = !all && !none;
  const rememberChecked = remember && !partial;

  function setSelected(id: string, on: boolean): void {
    setKept((current) => {
      const next = new Set(current);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          <Docker className="h-4 w-4" />
        </div>
        <DialogHeader className="min-w-0 pr-6 pt-1">
          <DialogTitle className="break-words leading-snug">
            Stop the Docker containers too?
          </DialogTitle>
          <DialogDescription className="break-words">
            {describeStopped(projects, containers.length)}
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex min-h-0 flex-col gap-1.5">
          {containers.length > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span aria-live="polite">
                {selected.length} of {containers.length} selected
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  setKept(all ? new Set(containers.map((one) => one.id)) : new Set<string>())
                }
              >
                {all ? 'Select none' : 'Select all'}
              </Button>
            </div>
          )}
          <ul
            aria-label="Containers"
            className="max-h-56 min-h-0 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 py-1"
          >
            {containers.map((one) => (
              <ContainerRow
                key={one.id}
                container={one}
                checked={!kept.has(one.id)}
                onCheckedChange={(on) => setSelected(one.id, on)}
              />
            ))}
          </ul>
        </div>

        <label
          className={cn(
            'flex items-start gap-2.5 text-sm',
            partial ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          <Checkbox
            className="mt-0.5"
            checked={rememberChecked}
            disabled={partial}
            onCheckedChange={(next) => setRemember(next === true)}
          />
          <span>
            Remember my choice
            <span className="block text-xs text-muted-foreground">
              {partial
                ? 'Only available when you stop every container or keep them all.'
                : 'Change it any time in Settings, General.'}
            </span>
          </span>
        </label>
      </div>

      <DialogFooter>
        <Button variant="soft" onClick={() => onAnswer({ stopIds: [], remember: rememberChecked })}>
          Keep running
        </Button>
        <Button
          variant="danger"
          disabled={none}
          onClick={() =>
            onAnswer({ stopIds: selected.map((one) => one.id), remember: rememberChecked })
          }
        >
          {none ? 'Stop containers' : `Stop ${containerCount(selected.length)}`}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Asks whether the Docker containers a stopped run left behind should go too. It appears by
 * itself shortly after the user stopped something, so it never takes focus onto a button: a stray
 * Enter or Space while typing elsewhere must not stop anything. Escape, the close button and a
 * click outside all mean "leave them running".
 */
export function StopContainersDialog({
  open,
  projects,
  containers,
  onAnswer,
  onDismiss,
}: {
  open: boolean;
  projects: string[];
  containers: DockerContainer[];
  onAnswer: (answer: StopContainersAnswer) => void;
  onDismiss: () => void;
}): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent
        ref={contentRef}
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <StopContainersForm projects={projects} containers={containers} onAnswer={onAnswer} />
      </DialogContent>
    </Dialog>
  );
}

/** Renders the prompt driven by `promptStopContainers()`; mount once near the app root. */
export function StopContainersDialogHost(): React.JSX.Element {
  const { open, projects, containers } = useStopContainersPromptStore();
  return (
    <StopContainersDialog
      open={open}
      projects={projects}
      containers={containers}
      onAnswer={resolveStopContainers}
      onDismiss={dismissStopContainers}
    />
  );
}
