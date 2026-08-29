import type {
  BlueprintAttachment,
  BlueprintStepId,
  Project,
  ProjectBlueprint,
} from '@agentmat/core';
import {
  AGENT_TYPE_LABELS,
  blueprintTextHash,
  buildBlueprintGenerationRequest,
  buildBlueprintPrompt,
  targetAIForProject,
} from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { containsPersian } from '@/lib/rtl';

/**
 * Section saves and attachment writes happen constantly while the wizard is
 * open, and each one already has its own inline state. Opting them out of the
 * app-wide overlay keeps the page from flashing on every blur.
 */
const QUIET = { silentLoading: true } as const;

export type GenerateStage = 'idle' | 'translating' | 'writing';

export function useProjectBlueprint(project: Project) {
  const projectId = project.id;
  const queryClient = useQueryClient();
  const [generateStage, setGenerateStage] = useState<GenerateStage>('idle');
  // Files that have just been written and are waiting for the editor to place
  // them at the caret. The editor clears the queue once it has.
  const [pendingInserts, setPendingInserts] = useState<BlueprintAttachment[]>([]);
  const clearPendingInserts = useCallback(() => setPendingInserts([]), []);

  const blueprintQuery = useQuery({
    queryKey: queryKeys.blueprint(projectId),
    queryFn: () => window.agentmat.blueprints.get(projectId),
  });

  const presetsQuery = useQuery({
    queryKey: queryKeys.blueprintPresets,
    queryFn: () => window.agentmat.blueprints.listPresets(),
  });

  const agentFileQuery = useQuery({
    queryKey: queryKeys.blueprintAgentFile(projectId),
    queryFn: () => window.agentmat.blueprints.agentFileTarget(projectId),
  });

  function cache(next: ProjectBlueprint): void {
    queryClient.setQueryData(queryKeys.blueprint(projectId), next);
  }

  function refreshRevisions(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.blueprint(projectId) });
  }

  /**
   * Pushes the ticked sections into the project's CLAUDE.md / AGENTS.md. Runs
   * after a save rather than on every keystroke, and stays quiet when nothing
   * was ticked and there was nothing to remove.
   */
  async function syncAgentFile(announce: boolean): Promise<void> {
    try {
      const result = await window.agentmat.blueprints.syncAgentFile(projectId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.blueprintAgentFile(projectId) });
      if (announce && result.written) toast.success(`Updated ${result.relativePath}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the project's markdown file.",
      );
    }
  }

  const saveSection = useMutation({
    mutationFn: ({ stepId, text }: { stepId: BlueprintStepId; text: string }) =>
      window.agentmat.blueprints.updateSection(projectId, stepId, { text }),
    onSuccess: (next, variables) => {
      cache(next);
      refreshRevisions();
      const section = next.sections.find((entry) => entry.stepId === variables.stepId);
      if (section?.includeInAgentFile) void syncAgentFile(false);
    },
    onError: () => toast.error('Could not save that step.'),
    meta: QUIET,
  });

  const setIncludeInAgentFile = useMutation({
    mutationFn: ({ stepId, value }: { stepId: BlueprintStepId; value: boolean }) =>
      window.agentmat.blueprints.updateSection(projectId, stepId, { includeInAgentFile: value }),
    onSuccess: (next) => {
      cache(next);
      void syncAgentFile(true);
    },
    onError: () => toast.error('Could not change that step.'),
    meta: QUIET,
  });

  const setDocsFolder = useMutation({
    mutationFn: (folder: string) => window.agentmat.blueprints.setDocsFolder(projectId, folder),
    onSuccess: cache,
    meta: QUIET,
  });

  const setConfirmBeforeWriting = useMutation({
    mutationFn: (value: boolean) =>
      window.agentmat.blueprints.setConfirmBeforeWriting(projectId, value),
    onSuccess: cache,
    meta: QUIET,
  });

  const saveFinalPrompt = useMutation({
    mutationFn: (text: string) => window.agentmat.blueprints.setFinalPrompt(projectId, text),
    onSuccess: (next) => {
      cache(next);
      refreshRevisions();
      toast.success('Prompt saved.');
    },
    onError: () => toast.error('Could not save the prompt.'),
  });

  const pickAttachments = useMutation({
    mutationFn: (stepId: BlueprintStepId) =>
      window.agentmat.blueprints.pickAttachments(projectId, stepId),
    onSuccess: (result) => {
      // Null means the picker was cancelled, which isn't a failure or a change.
      if (!result) return;
      cache(result.blueprint);
      setPendingInserts((current) => [...current, ...result.added]);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not attach that file.'),
    meta: QUIET,
  });

  const addAttachment = useMutation({
    mutationFn: ({
      stepId,
      displayName,
      dataUrl,
    }: {
      stepId: BlueprintStepId;
      displayName: string;
      dataUrl: string;
    }) => window.agentmat.blueprints.addAttachment(projectId, stepId, { displayName, dataUrl }),
    onSuccess: (result) => {
      cache(result.blueprint);
      setPendingInserts((current) => [...current, ...result.added]);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not attach that file.'),
    meta: QUIET,
  });

  const renameAttachment = useMutation({
    mutationFn: ({
      stepId,
      attachmentId,
      displayName,
    }: {
      stepId: BlueprintStepId;
      attachmentId: string;
      displayName: string;
    }) => window.agentmat.blueprints.renameAttachment(projectId, stepId, attachmentId, displayName),
    onSuccess: cache,
    meta: QUIET,
  });

  const removeAttachment = useMutation({
    mutationFn: ({ stepId, attachmentId }: { stepId: BlueprintStepId; attachmentId: string }) =>
      window.agentmat.blueprints.removeAttachment(projectId, stepId, attachmentId),
    onSuccess: cache,
    onError: () => toast.error('Could not remove that attachment.'),
    meta: QUIET,
  });

  /**
   * Brings every non-empty section into English, reusing what is already cached.
   * A section the user wrote in English never leaves the machine; one that
   * failed to translate falls back to its original text rather than sinking the
   * whole run.
   */
  async function englishSections(
    blueprint: ProjectBlueprint,
  ): Promise<Map<BlueprintStepId, string>> {
    const english = new Map<BlueprintStepId, string>();
    let failed = 0;

    for (const section of blueprint.sections) {
      const text = section.text.trim();
      if (!text) continue;

      const hash = blueprintTextHash(text);
      if (section.textEn && section.textEnHash === hash) {
        english.set(section.stepId, section.textEn);
        continue;
      }

      if (!containsPersian(text)) {
        english.set(section.stepId, text);
        await window.agentmat.blueprints
          .updateSection(projectId, section.stepId, { textEn: text, textEnHash: hash })
          .then(cache)
          .catch(() => undefined);
        continue;
      }

      try {
        const translated = await window.agentmat.translate.text({ text, targetLang: 'en' });
        const value = translated.trim() || text;
        english.set(section.stepId, value);
        await window.agentmat.blueprints
          .updateSection(projectId, section.stepId, { textEn: value, textEnHash: hash })
          .then(cache)
          .catch(() => undefined);
      } catch {
        failed += 1;
        english.set(section.stepId, text);
      }
    }

    if (failed > 0) {
      toast.warning(
        `${failed} step${failed === 1 ? '' : 's'} could not be translated and went in as written.`,
      );
    }
    return english;
  }

  async function generate(): Promise<void> {
    const blueprint = blueprintQuery.data;
    if (!blueprint) return;
    if (!blueprint.sections.some((section) => section.text.trim())) {
      toast.error('Fill in at least one step before generating the prompt.');
      return;
    }

    setGenerateStage('translating');
    try {
      const english = await englishSections(blueprint);
      const input = {
        projectName: project.name,
        agentLabel: AGENT_TYPE_LABELS[project.agentType],
        targetAI: targetAIForProject(project.agentType, project.cliId),
        docsFolder: blueprint.docsFolder,
        confirmBeforeWriting: blueprint.confirmBeforeWriting,
        sections: blueprint.sections
          .filter((section) => english.has(section.stepId))
          .map((section) => ({
            stepId: section.stepId,
            text: english.get(section.stepId) ?? '',
            attachmentNames: section.attachments.map((attachment) => attachment.displayName),
          })),
      };

      setGenerateStage('writing');
      const prompt = await writePrompt(input);
      // `mutate` rather than `mutateAsync`: it reports its own failure and never
      // rejects, so nothing escapes the click handler that started this.
      saveFinalPrompt.mutate(prompt);
      void logHistory(projectId, input.targetAI, prompt);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate the prompt.');
    } finally {
      setGenerateStage('idle');
    }
  }

  return {
    blueprint: blueprintQuery.data,
    isLoading: blueprintQuery.isLoading,
    presets: presetsQuery.data ?? [],
    agentFile: agentFileQuery.data,
    saveSection,
    setIncludeInAgentFile,
    setDocsFolder,
    setConfirmBeforeWriting,
    saveFinalPrompt,
    pickAttachments,
    addAttachment,
    pendingInserts,
    clearPendingInserts,
    renameAttachment,
    removeAttachment,
    syncAgentFile,
    generate,
    generateStage,
  };
}

/**
 * Asks the configured provider to write the prompt, and falls back to the local
 * template when there is no provider or the request fails. Translation needs no
 * key but generation does, so without the fallback the whole feature would be
 * dead for anyone who never set one up.
 */
async function writePrompt(input: Parameters<typeof buildBlueprintPrompt>[0]): Promise<string> {
  const local = buildBlueprintPrompt(input);
  const settings = await window.agentmat.settings.get();
  const provider = settings.promptBuilderProvider;
  const model =
    provider === 'openai'
      ? settings.openaiModel
      : provider === 'gemini'
        ? settings.geminiModel
        : settings.ollamaModel;

  if (!model.trim()) {
    toast.info(
      `Assembled the prompt here. Set a ${provider} model in Settings to have AI write it.`,
    );
    return local;
  }

  try {
    const result = await window.agentmat.ai.ask({
      provider,
      model,
      prompt: buildBlueprintGenerationRequest(input),
    });
    if (!result.ok || !result.text.trim()) {
      toast.warning(
        `${result.error || 'The AI request failed'}. Assembled the prompt here instead.`,
      );
      return local;
    }
    return result.text.trim();
  } catch (error) {
    toast.warning(
      `${error instanceof Error ? error.message : 'The AI request failed'}. Assembled the prompt here instead.`,
    );
    return local;
  }
}

async function logHistory(projectId: string, targetAI: string, content: string): Promise<void> {
  try {
    await window.agentmat.promptHistory.add({
      rawInput: '',
      promptType: 'Product',
      targetAI,
      content,
      source: 'generate',
      projectId,
    });
  } catch {
    // History is best-effort; a failure here shouldn't interrupt the flow.
  }
}
