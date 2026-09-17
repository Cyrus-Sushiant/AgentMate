import {
  CLI_REGISTRY,
  defaultEffortFor,
  EFFORT_LABELS,
  type EffortLevel,
  runProfileForTargetAI,
} from '@agentmat/core';
import type { SshAgentMode } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CliLogo } from '@/components/cliLogos';
import { Robot } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useCliStore } from '@/stores/cliStore';
import { startSshAgentTask, useSshAgentStore } from '@/stores/sshAgentStore';

const MODES: { value: SshAgentMode; label: string; description: string }[] = [
  {
    value: 'approve-all',
    label: 'Approve each command',
    description: 'Nothing runs until you click Run on it.',
  },
  {
    value: 'approve-risky',
    label: 'Auto, guard risky ones',
    description: 'Ordinary commands run right away; destructive-looking ones pause for you.',
  },
  {
    value: 'autonomous',
    label: 'Fully autonomous',
    description: 'Runs the whole task unattended. Just watch the terminal.',
  },
];

/** Picker value for the OpenAI/Gemini/Ollama provider set in Settings instead of a CLI. */
const SETTINGS_PROVIDER = '__settings__';
/** Picker value for "let the CLI use whatever model it's configured with". */
const CLI_DEFAULT_MODEL = '__cli-default__';

export function SshAskAiDialog({
  sessionId,
  target,
  open,
  onOpenChange,
}: {
  sessionId: string;
  /** An SSH session, or a shell running on this machine. */
  target: 'ssh' | 'local';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const lastMode = useSshAgentStore((s) => s.lastMode);
  const lastAi = useSshAgentStore((s) => s.lastAi);
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<SshAgentMode>(lastMode);
  const [cliValue, setCliValue] = useState<string | null>(null);
  const [modelValue, setModelValue] = useState(CLI_DEFAULT_MODEL);
  const [effort, setEffort] = useState<EffortLevel | null>(null);
  const [starting, setStarting] = useState(false);

  const cliQuery = useQuery({
    queryKey: queryKeys.cliStatus,
    queryFn: () => window.agentmat.cli.detectAll(),
    meta: { silentLoading: true },
  });

  // CLIs that can answer a one-shot prompt and are actually installed here.
  const promptClis = CLI_REGISTRY.filter(
    (cli) => cli.promptCommand && cliQuery.data?.find((c) => c.id === cli.id)?.installed,
  );

  // Seed the pickers once the installed CLIs are known: last run's choice, then the default CLI,
  // then the first installed one, then Settings' AI provider when no CLI is around at all.
  useEffect(() => {
    if (cliValue !== null || !cliQuery.isFetched) return;
    const installed = (id: string | null | undefined) =>
      !!id && promptClis.some((cli) => cli.id === id);
    if (lastAi && (lastAi.cliId === null || installed(lastAi.cliId))) {
      setCliValue(lastAi.cliId ?? SETTINGS_PROVIDER);
      setModelValue(lastAi.modelId ?? CLI_DEFAULT_MODEL);
      setEffort(lastAi.effort);
      return;
    }
    setCliValue(
      installed(defaultCliId) ? (defaultCliId as string) : (promptClis[0]?.id ?? SETTINGS_PROVIDER),
    );
  }, [cliValue, cliQuery.isFetched, promptClis, lastAi, defaultCliId]);

  const cliId = cliValue && cliValue !== SETTINGS_PROVIDER ? cliValue : null;
  const profile = cliId ? runProfileForTargetAI(cliId) : null;
  // A generic profile only describes models by class, which isn't something a flag can pick.
  const models = profile && !profile.generic ? profile.models : [];
  const model = models.find((m) => m.id === modelValue);
  const efforts = model?.efforts ?? [];

  function selectCli(value: string): void {
    setCliValue(value);
    setModelValue(CLI_DEFAULT_MODEL);
    setEffort(null);
  }

  function selectModel(value: string): void {
    setModelValue(value);
    const next = models.find((m) => m.id === value);
    setEffort(next ? (defaultEffortFor(next) ?? null) : null);
  }

  async function handleStart(): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed || starting || cliValue === null) return;
    setStarting(true);
    try {
      await startSshAgentTask({
        sessionId,
        target,
        prompt: trimmed,
        mode,
        cliId,
        modelId: model?.id ?? null,
        effort: model && effort && efforts.includes(effort) ? effort : null,
      });
      setPrompt('');
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Could not start the AI task.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Robot className="h-4 w-4" />
            Ask AI to run a task here
          </DialogTitle>
          <DialogDescription>
            {target === 'ssh'
              ? 'Describe what you want done on this server. '
              : 'Describe what you want done on this computer. '}
            The AI runs real commands in this session, so you&apos;ll see everything it does live in
            the terminal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              target === 'ssh'
                ? 'e.g. Check disk usage, then list the 5 largest files in /var/log'
                : 'e.g. Install the dependencies, then run the tests'
            }
            className="min-h-24 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleStart();
              }
            }}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="text-xs">CLI</Label>
              <Combobox
                className="h-8 text-xs"
                value={cliValue ?? ''}
                onChange={selectCli}
                disabled={!cliQuery.isFetched}
                placeholder={cliQuery.isFetched ? 'Choose' : 'Detecting…'}
                searchPlaceholder="Search CLIs…"
                options={[
                  ...promptClis.map((cli) => ({
                    value: cli.id,
                    label: cli.name,
                    icon: <CliLogo cliId={cli.id} className="h-3.5 w-3.5 shrink-0" />,
                  })),
                  { value: SETTINGS_PROVIDER, label: 'AI provider (Settings)' },
                ]}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="text-xs">Model</Label>
              <Combobox
                className="h-8 text-xs"
                value={cliId ? modelValue : ''}
                onChange={selectModel}
                disabled={models.length === 0}
                placeholder={cliId ? 'CLI default' : 'From Settings'}
                searchPlaceholder="Search models…"
                options={[
                  { value: CLI_DEFAULT_MODEL, label: 'CLI default' },
                  ...models.map((m) => ({ value: m.id, label: m.label })),
                ]}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="text-xs">Effort</Label>
              <Combobox
                className="h-8 text-xs"
                value={effort && efforts.includes(effort) ? effort : ''}
                onChange={(value) => setEffort(value as EffortLevel)}
                disabled={efforts.length === 0}
                placeholder={model ? 'Not adjustable' : 'Default'}
                searchPlaceholder="Search…"
                options={efforts.map((level) => ({ value: level, label: EFFORT_LABELS[level] }))}
              />
            </div>
          </div>
          {cliQuery.isFetched && promptClis.length === 0 && (
            <p className="-mt-1 text-xs text-muted-foreground">
              No agent CLI with a non-interactive mode is installed, so the AI provider from
              Settings is used. Install Claude Code, Codex, or Gemini from CLI Manager to pick one.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                  mode === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-foreground/5',
                )}
              >
                <span className="font-medium text-foreground">{option.label}</span>
                <span className="text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleStart()}
            disabled={!prompt.trim() || starting || cliValue === null}
          >
            {starting ? 'Starting…' : 'Start'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
