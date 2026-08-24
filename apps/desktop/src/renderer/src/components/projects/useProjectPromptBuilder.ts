import type { PromptType, TargetAI } from '@agentmat/core';
import {
  buildPromptGenerationRequest,
  DEFAULT_TARGET_AI,
  resolvePromptTargetAI,
  targetAIForProject,
} from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { useProjectPromptBuildStore } from '@/stores/projectPromptBuildStore';

/**
 * Shared Build Prompt state/handlers behind the dialog and its pinned desktop
 * widget. Both render the same generate/translate/copy/save-draft flow over
 * the same per-project entry, just in different chrome.
 */
export interface UseProjectPromptBuilderOptions {
  /** Skip fetching settings while the dialog/widget isn't visible yet. */
  enabled?: boolean;
  onDraftSaved?: () => void;
}

export function useProjectPromptBuilder(
  projectId: string,
  { enabled = true, onDraftSaved }: UseProjectPromptBuilderOptions = {},
) {
  const queryClient = useQueryClient();
  const stored = useProjectPromptBuildStore((s) => s.entries[projectId]);
  const rawInput = stored?.rawInput ?? '';
  const promptType = stored?.promptType ?? 'Full Stack';
  const generated = stored?.generated ?? '';
  const updateEntry = useProjectPromptBuildStore((s) => s.update);
  const setRawInput = (v: string) => updateEntry(projectId, { rawInput: v });
  const setPromptType = (v: PromptType) => updateEntry(projectId, { promptType: v });
  const setTargetAI = (v: TargetAI) => updateEntry(projectId, { targetAI: v });
  const setGenerated = (v: string) => updateEntry(projectId, { generated: v });
  const clearEntry = useProjectPromptBuildStore((s) => s.clear);
  const handleClear = () => clearEntry(projectId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
    enabled,
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
    enabled,
  });
  const project = projectsQuery.data?.find((p) => p.id === projectId);
  const fallbackTargetAI = project
    ? targetAIForProject(project.agentType, project.cliId)
    : DEFAULT_TARGET_AI;
  const targetAI = resolvePromptTargetAI(stored?.targetAI, fallbackTargetAI, {
    untouched: !rawInput.trim() && !generated.trim(),
  }) as TargetAI;

  useEffect(() => {
    if (!enabled || !projectId || projectsQuery.isLoading) return;
    if (stored?.targetAI === targetAI) return;
    updateEntry(projectId, { targetAI });
  }, [enabled, projectId, projectsQuery.isLoading, stored?.targetAI, targetAI, updateEntry]);

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
      toast.success('Draft saved. Find it on the project’s Overview tab.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectDrafts(projectId) });
      onDraftSaved?.();
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
      // History logging is best-effort, a failure here shouldn't interrupt the user's flow.
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

    // Drop the previous result immediately so a failed request can't leave
    // stale text in the box for the user to copy by mistake.
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
      toast.error('Translation failed. Check your internet connection and try again.');
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(generated);
    toast.success('Copied to clipboard.');
  }

  return {
    rawInput,
    setRawInput,
    promptType,
    setPromptType,
    targetAI,
    setTargetAI,
    generated,
    setGenerated,
    isGenerating,
    isTranslating,
    handleGenerate,
    handleTranslate,
    handleCopy,
    handleClear,
    saveDraftMutation,
  };
}
