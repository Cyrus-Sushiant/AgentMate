import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Languages, Save, Sparkles } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import {
  PROMPT_TYPES,
  TARGET_AIS,
  buildPromptGenerationRequest,
} from '@agentmat/core';
import type { PromptType, TargetAI } from '@agentmat/core';
import { queryKeys } from '@/lib/queryKeys';
import { useProjectPromptBuildStore } from '@/stores/projectPromptBuildStore';

export interface ProjectPromptBuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ProjectPromptBuildDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectPromptBuildDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const rawInput = useProjectPromptBuildStore((s) => s.entries[projectId]?.rawInput ?? '');
  const promptType = useProjectPromptBuildStore(
    (s) => s.entries[projectId]?.promptType ?? 'Full Stack',
  );
  const targetAI = useProjectPromptBuildStore((s) => s.entries[projectId]?.targetAI ?? 'Claude');
  const generated = useProjectPromptBuildStore((s) => s.entries[projectId]?.generated ?? '');
  const updateEntry = useProjectPromptBuildStore((s) => s.update);
  const setRawInput = (v: string) => updateEntry(projectId, { rawInput: v });
  const setPromptType = (v: PromptType) => updateEntry(projectId, { promptType: v });
  const setTargetAI = (v: TargetAI) => updateEntry(projectId, { targetAI: v });
  const setGenerated = (v: string) => updateEntry(projectId, { generated: v });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
    enabled: open,
  });

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      window.agentmat.projectDrafts.create({
        projectId,
        rawInput,
        promptType,
        targetAI,
        content: generated,
      }),
    onSuccess: () => {
      toast.success('Draft saved — find it on the project’s Overview tab.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectDrafts(projectId) });
      onOpenChange(false);
    },
    onError: () => toast.error('Could not save the draft.'),
  });

  async function logHistory(source: 'generate' | 'translate', content: string): Promise<void> {
    try {
      const isTranslation = source === 'translate';
      await window.agentmat.promptHistory.add({
        rawInput,
        promptType: isTranslation ? '' : promptType,
        targetAI: isTranslation ? '' : targetAI,
        content,
        source,
        projectId,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.promptHistory });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectPromptHistory(projectId) });
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
      const request = buildPromptGenerationRequest({ rawInput, promptType, targetAI });
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
      const translated = await window.agentmat.translate.text({ text: rawInput, targetLang: 'en' });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Build Prompt — {projectName}</DialogTitle>
        </DialogHeader>

        <div className="-mx-1 -my-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
          <div className="space-y-1.5">
            <Label>Your request</Label>
            <Textarea
              rows={4}
              placeholder="e.g. Add a login form with email/password validation…"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prompt Type</Label>
              <Combobox
                value={promptType}
                onChange={(v) => setPromptType(v as PromptType)}
                options={PROMPT_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target AI</Label>
              <Combobox
                value={targetAI}
                onChange={(v) => setTargetAI(v as TargetAI)}
                options={TARGET_AIS.map((ai) => ({ value: ai, label: ai }))}
              />
            </div>
          </div>

          <Button onClick={() => void handleGenerate()} disabled={isGenerating} className="w-full">
            <Sparkles /> {isGenerating ? 'Generating…' : 'Generate Prompt'}
          </Button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or translate directly to English</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void handleTranslate()}
            disabled={isTranslating}
          >
            <Languages /> {isTranslating ? 'Translating…' : 'Translate to English'}
          </Button>

          {generated && (
            <div className="space-y-1.5">
              <Label>Generated prompt</Label>
              <Textarea
                rows={8}
                value={generated}
                onChange={(e) => setGenerated(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={!generated} onClick={() => void handleCopy()}>
            <Copy /> Copy
          </Button>
          <Button
            disabled={!generated || saveDraftMutation.isPending}
            onClick={() => saveDraftMutation.mutate()}
          >
            <Save /> {saveDraftMutation.isPending ? 'Saving…' : 'Save draft to project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
