import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays,
  Clock,
  Copy,
  Download,
  Languages,
  Microphone,
  Plus,
  Save,
  Sparkles,
  Spinner,
  StopCircle,
  TerminalSquare,
  Trash2,
} from '@/components/icons';
import {
  CLI_REGISTRY,
  PROMPT_TYPES,
  TARGET_AIS,
  buildPromptGenerationRequest,
  generatePrompt,
} from '@agentmat/core';
import type { PromptType, TargetAI } from '@agentmat/core';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useCliStore } from '@/stores/cliStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { usePromptBuilderStore, type PromptBuilderStatus } from '@/stores/promptBuilderStore';
import { useVoiceInput } from '@/hooks/useVoiceInput';

interface ScheduleQueueItem {
  id: string;
  text: string;
  /** Value of a datetime-local input, e.g. "2026-07-19T10:00". */
  runAt: string;
}

const STATUS_OPTIONS: { value: PromptBuilderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
];

function defaultRunAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

const TRANSLATE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fa', label: 'Persian (فارسی)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'ru', label: 'Russian' },
  { value: 'hi', label: 'Hindi' },
  { value: 'tr', label: 'Turkish' },
];

const TARGET_AI_TO_CLI_ID: Record<TargetAI, string> = {
  Claude: 'claude-code',
  Gemini: 'gemini-cli',
  OpenCode: 'opencode',
  Codex: 'codex-cli',
  Qwen: 'qwen-cli',
  Aider: 'aider',
  Goose: 'goose',
  Continue: 'continue-cli',
};

export default function PromptBuilderPage(): React.JSX.Element {
  const {
    rawInput,
    setRawInput,
    promptType,
    setPromptType,
    targetAI,
    setTargetAI,
    generated,
    setGenerated,
    targetLang,
    setTargetLang,
    projectId,
    setProjectId,
    status,
    setStatus,
  } = usePromptBuilderStore(
    useShallow((s) => ({
      rawInput: s.rawInput,
      setRawInput: s.setRawInput,
      promptType: s.promptType,
      setPromptType: s.setPromptType,
      targetAI: s.targetAI,
      setTargetAI: s.setTargetAI,
      generated: s.generated,
      setGenerated: s.setGenerated,
      targetLang: s.targetLang,
      setTargetLang: s.setTargetLang,
      projectId: s.projectId,
      setProjectId: s.setProjectId,
      status: s.status,
      setStatus: s.setStatus,
    })),
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleQueue, setScheduleQueue] = useState<ScheduleQueueItem[]>([]);

  const queryClient = useQueryClient();
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const openSession = useTerminalStore((s) => s.openSession);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  const projects = projectsQuery.data ?? [];

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });

  // Voice input appends onto whatever's already in the box, so read the latest
  // value through a ref — the transcription callback outlives the render that
  // created it and would otherwise close over a stale rawInput.
  const rawInputRef = useRef(rawInput);
  useEffect(() => {
    rawInputRef.current = rawInput;
  }, [rawInput]);

  const voice = useVoiceInput({
    language: settingsQuery.data?.speechLanguage ?? 'auto',
    onText: (text) => {
      const existing = rawInputRef.current.trim();
      setRawInput(existing ? `${existing} ${text}` : text);
    },
  });

  const voiceBusy = voice.status === 'requesting' || voice.status === 'transcribing';
  const voiceLabel =
    voice.status === 'recording'
      ? 'Stop recording'
      : voice.status === 'transcribing'
        ? voice.downloadPercent !== null
          ? `Downloading model… ${voice.downloadPercent}%`
          : 'Transcribing…'
        : voice.status === 'requesting'
          ? 'Starting microphone…'
          : 'Record voice input';

  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  const saveTemplateMutation = useMutation({
    mutationFn: () =>
      window.agentmat.templates.save({
        name: templateName,
        promptType,
        targetAI,
        content: generated,
      }),
    onSuccess: () => {
      toast.success('Template saved.');
      setSaveDialogOpen(false);
      setTemplateName('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: () => {
      if (!projectId) throw new Error('No project selected');
      return window.agentmat.scheduledTasks.createMany({
        projectId,
        tasks: scheduleQueue.map((item) => ({
          rawInput: item.text,
          promptType,
          targetAI,
          content: generatePrompt({ rawInput: item.text, promptType, targetAI }),
          runAt: new Date(item.runAt).toISOString(),
        })),
      });
    },
    onSuccess: () => {
      toast.success('Scheduled series saved — view it on the project’s Schedule tab.');
      setScheduleQueue([]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks(projectId!) });
    },
    onError: () => toast.error('Could not save the schedule.'),
  });

  function addQueueItem(): void {
    setScheduleQueue((items) => [
      ...items,
      { id: crypto.randomUUID(), text: rawInput, runAt: defaultRunAt() },
    ]);
  }

  function updateQueueItem(id: string, updates: Partial<Omit<ScheduleQueueItem, 'id'>>): void {
    setScheduleQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function removeQueueItem(id: string): void {
    setScheduleQueue((items) => items.filter((item) => item.id !== id));
  }

  const canSaveSchedule =
    !!projectId &&
    scheduleQueue.length > 0 &&
    scheduleQueue.every((item) => item.text.trim() && item.runAt);

  const cliForSendTo = useMemo(() => {
    const cliId = defaultCliId ?? TARGET_AI_TO_CLI_ID[targetAI];
    return CLI_REGISTRY.find((c) => c.id === cliId) ?? null;
  }, [defaultCliId, targetAI]);

  async function logHistory(source: 'generate' | 'translate', content: string): Promise<void> {
    try {
      await window.agentmat.promptHistory.add({ rawInput, promptType, targetAI, content, source });
    } catch {
      // History logging is best-effort — a failure here shouldn't interrupt the user's flow.
    }
  }

  async function handleGenerate(): Promise<void> {
    if (!rawInput.trim()) {
      toast.error('Describe what you want before generating a prompt.');
      return;
    }

    const settings = settingsQuery.data ?? (await window.agentmat.settings.get());
    const provider = settings.promptBuilderProvider;
    const model =
      provider === 'openai'
        ? settings.openaiModel
        : provider === 'gemini'
          ? settings.geminiModel
          : settings.ollamaModel;
    if (!model.trim()) {
      toast.error(`Set a ${provider} model in Settings first.`);
      return;
    }

    setGenerated('');
    setIsGenerating(true);
    try {
      // Normalize the description to English before it's inserted into the AI request,
      // regardless of what language the user typed it in.
      const englishInput = await window.agentmat.translate.text({
        text: rawInput,
        targetLang: 'en',
      });
      const request = buildPromptGenerationRequest({
        rawInput: englishInput || rawInput,
        promptType,
        targetAI,
      });
      const result = await window.agentmat.ai.ask({ provider, model, prompt: request });
      if (!result.ok) {
        toast.error(result.error || 'Prompt generation failed.');
        return;
      }
      const content = result.text.trim();
      setGenerated(content);
      void logHistory('generate', content);
    } catch (error) {
      toast.error((error as Error).message || 'Prompt generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleTranslate(): Promise<void> {
    if (!rawInput.trim()) {
      toast.error('Enter some text before translating.');
      return;
    }
    setGenerated('');
    setIsTranslating(true);
    try {
      const translated = await window.agentmat.translate.text({ text: rawInput, targetLang });
      setGenerated(translated);
      void logHistory('translate', translated);
    } catch {
      toast.error('Translation failed — check your internet connection and try again.');
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(generated);
    toast.success('Copied to clipboard.');
  }

  async function handleExportMarkdown(): Promise<void> {
    const savedPath = await window.agentmat.fs.saveFileAs('prompt.md', generated);
    if (savedPath) toast.success(`Saved to ${savedPath}`);
  }

  async function handleSendToCli(): Promise<void> {
    if (!cliForSendTo) {
      toast.error('No CLI available for this target. Set a default CLI in Settings.');
      return;
    }
    const filePath = await window.agentmat.fs.writeScratchFile(
      `prompt-${Date.now()}.md`,
      generated,
    );
    const executable = cliForSendTo.executableNames[0];
    const command =
      window.agentmat.platform === 'win32'
        ? `& ${executable} (Get-Content -Raw -LiteralPath "${filePath}")`
        : `${executable} "$(cat '${filePath}')"`;
    openSession({ title: cliForSendTo.name, initialInput: command });
  }

  usePageHeader('Prompt Builder', 'Describe what you want; AgentMate structures it into a professional prompt.');

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-6">
      <Card className="flex flex-1 flex-col">
        <CardContent className="grid flex-1 grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <div className="flex flex-1 flex-col space-y-4">
            <div className="flex flex-1 flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="raw-input">Your request</Label>
                {voice.supported && (
                  <Button
                    type="button"
                    variant={voice.status === 'recording' ? 'destructive' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={voice.toggle}
                    disabled={voiceBusy}
                    title={voiceLabel}
                    aria-label={voiceLabel}
                  >
                    {voiceBusy ? (
                      <Spinner className="animate-spin" />
                    ) : voice.status === 'recording' ? (
                      <StopCircle />
                    ) : (
                      <Microphone />
                    )}
                    <span>{voiceLabel}</span>
                  </Button>
                )}
              </div>
              <Textarea
                id="raw-input"
                className="min-h-[280px] flex-1 resize-none"
                placeholder="e.g. Add a login form with email/password validation…"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prompt Type</Label>
                <Combobox
                  value={promptType}
                  onChange={(v) => setPromptType(v as PromptType)}
                  options={PROMPT_TYPES.map((type) => ({ value: type, label: type }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Target AI</Label>
                <Combobox
                  value={targetAI}
                  onChange={(v) => setTargetAI(v as TargetAI)}
                  options={TARGET_AIS.map((ai) => ({ value: ai, label: ai }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Project</Label>
                <Combobox
                  value={projectId ?? ''}
                  onChange={(v) => setProjectId(v || null)}
                  placeholder="No project"
                  emptyText="No projects yet."
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  clearable
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Combobox
                  value={status}
                  onChange={(v) => setStatus(v as PromptBuilderStatus)}
                  options={STATUS_OPTIONS}
                />
              </div>
            </div>

            {status === 'scheduled' && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="h-4 w-4" /> Scheduled series
                  </div>
                  <Button variant="outline" size="sm" onClick={addQueueItem}>
                    <Plus /> Add task
                  </Button>
                </div>

                {!projectId && (
                  <p className="text-xs text-muted-foreground">
                    Choose a project above so this series has somewhere to run later.
                  </p>
                )}

                {scheduleQueue.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tasks queued yet. Add one to build a series of prompts to run on this
                    project later.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {scheduleQueue.map((item, index) => (
                      <div
                        key={item.id}
                        className="space-y-1.5 rounded-md border border-border bg-card p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Task {index + 1}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQueueItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          rows={2}
                          placeholder="What should run at this time?"
                          value={item.text}
                          onChange={(e) => updateQueueItem(item.id, { text: e.target.value })}
                        />
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <Input
                            type="datetime-local"
                            className="h-8 text-xs"
                            value={item.runAt}
                            onChange={(e) => updateQueueItem(item.id, { runAt: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!canSaveSchedule || saveScheduleMutation.isPending}
                  onClick={() => saveScheduleMutation.mutate()}
                >
                  <CalendarDays />{' '}
                  {saveScheduleMutation.isPending
                    ? 'Saving…'
                    : `Save ${scheduleQueue.length || ''} task(s) to schedule`}
                </Button>
              </div>
            )}

            <Button onClick={() => void handleGenerate()} disabled={isGenerating} className="w-full">
              <Sparkles /> {isGenerating ? 'Generating…' : 'Generate Prompt'}
            </Button>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or translate directly</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex gap-2">
              <Combobox
                className="flex-1"
                value={targetLang}
                onChange={setTargetLang}
                options={TRANSLATE_LANGUAGES}
              />
              <Button variant="secondary" onClick={() => void handleTranslate()} disabled={isTranslating}>
                <Languages /> {isTranslating ? 'Translating…' : 'Translate'}
              </Button>
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <Label>Generated prompt</Label>
            <MonacoEditor value={generated} onChange={setGenerated} className="min-h-[420px] flex-1" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!generated} onClick={() => void handleCopy()}>
                <Copy /> Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!generated}
                onClick={() => setSaveDialogOpen(true)}
              >
                <Save /> Save Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!generated}
                onClick={() => void handleSendToCli()}
              >
                <TerminalSquare /> Send to CLI
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!generated}
                onClick={() => void handleExportMarkdown()}
              >
                <Download /> Export Markdown
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save prompt template</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Template name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <DialogFooter>
            <Button
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
              onClick={() => saveTemplateMutation.mutate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
