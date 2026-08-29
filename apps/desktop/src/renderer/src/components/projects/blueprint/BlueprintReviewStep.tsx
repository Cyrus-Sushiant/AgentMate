import type { Project, ProjectBlueprint } from '@agentmat/core';
import { blueprintStep, targetAIForProject } from '@agentmat/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { Check, Copy, History, Save, Sparkles, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { containsPersian, persianTextProps } from '@/lib/rtl';
import type { GenerateStage } from './useBlueprint';

export function BlueprintReviewStep({
  project,
  blueprint,
  generateStage,
  onGenerate,
  onSavePrompt,
  onDocsFolderChange,
  onConfirmBeforeWritingChange,
  onOpenHistory,
  savingPrompt,
}: {
  project: Project;
  blueprint: ProjectBlueprint;
  generateStage: GenerateStage;
  onGenerate: () => void;
  onSavePrompt: (text: string) => void;
  onDocsFolderChange: (folder: string) => void;
  onConfirmBeforeWritingChange: (value: boolean) => void;
  onOpenHistory: () => void;
  savingPrompt: boolean;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState(blueprint.finalPrompt);
  const [docsFolder, setDocsFolder] = useState(blueprint.docsFolder);
  const [copied, setCopied] = useState(false);

  useEffect(() => setPrompt(blueprint.finalPrompt), [blueprint.finalPrompt]);
  useEffect(() => setDocsFolder(blueprint.docsFolder), [blueprint.docsFolder]);

  const busy = generateStage !== 'idle';
  const filled = blueprint.sections.filter((section) => section.text.trim().length > 0);
  const persianSections = filled.filter((section) => containsPersian(section.text));
  const dirty = prompt !== blueprint.finalPrompt;

  async function copyPrompt(): Promise<void> {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function saveAsDraft(): Promise<void> {
    try {
      await window.agentmat.projectDrafts.create({
        projectId: project.id,
        rawInput: filled.map((section) => section.text).join('\n\n'),
        promptType: 'Product',
        targetAI: targetAIForProject(project.agentType, project.cliId),
        content: prompt,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectDrafts(project.id) });
      toast.success("Draft saved. It's on the project's Overview tab.");
    } catch {
      toast.error('Could not save the draft.');
    }
  }

  async function setAsStandingPrompt(): Promise<void> {
    try {
      await window.agentmat.projects.update(project.id, { prompt });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      toast.success('Set as this project’s standing prompt.');
    } catch {
      toast.error('Could not set the standing prompt.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="blueprint-docs-folder">Docs folder</Label>
          <Input
            id="blueprint-docs-folder"
            value={docsFolder}
            onChange={(event) => setDocsFolder(event.target.value)}
            onBlur={() => {
              if (docsFolder !== blueprint.docsFolder) onDocsFolderChange(docsFolder);
            }}
            placeholder="docs"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Where the prompt tells the agent to write the plan, relative to the project root.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
          <Switch
            id="blueprint-confirm"
            checked={blueprint.confirmBeforeWriting}
            onCheckedChange={onConfirmBeforeWritingChange}
          />
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="blueprint-confirm" className="cursor-pointer">
              Confirm before writing files
            </Label>
            <p className="text-xs text-muted-foreground">
              The agent lists the phases and epics it plans to create and waits for a yes.
            </p>
          </div>
        </div>
      </div>

      {persianSections.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            {persianSections.length} step{persianSections.length === 1 ? '' : 's'} were written in
            Persian. Generating translates them first, and the prompt comes out in English.
          </p>
          <div className="space-y-2">
            {persianSections.map((section) => (
              <div key={section.stepId} className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {blueprintStep(section.stepId).heading}
                  </p>
                  <p className="line-clamp-4 text-sm" {...persianTextProps(section.text)}>
                    {section.text}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    English
                  </p>
                  <p className="line-clamp-4 text-sm text-muted-foreground">
                    {section.textEn ?? 'Translated when you generate.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SimpleTooltip
          label={filled.length === 0 ? 'Fill in at least one step first' : undefined}
          wrapTrigger={filled.length === 0}
        >
          <Button onClick={onGenerate} disabled={busy || filled.length === 0}>
            {busy ? <Spinner className="animate-spin" /> : <Sparkles />}
            {generateStage === 'translating'
              ? 'Translating…'
              : generateStage === 'writing'
                ? 'Writing the prompt…'
                : blueprint.finalPrompt
                  ? 'Regenerate prompt'
                  : 'Generate prompt'}
          </Button>
        </SimpleTooltip>
        <Button variant="ghost" size="sm" onClick={onOpenHistory}>
          <History /> History
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!prompt} onClick={() => void copyPrompt()}>
            {copied ? <Check className="text-primary" /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" disabled={!prompt} onClick={() => void saveAsDraft()}>
            Save as draft
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!prompt}
            onClick={() => void setAsStandingPrompt()}
          >
            Use as standing prompt
          </Button>
          <Button disabled={!dirty || savingPrompt} onClick={() => onSavePrompt(prompt)}>
            {savingPrompt ? <Spinner className="animate-spin" /> : <Save />}
            Save prompt
          </Button>
        </div>
      </div>

      <MarkdownEditor
        value={prompt}
        onChange={setPrompt}
        onSave={() => onSavePrompt(prompt)}
        defaultHeight={460}
      />
    </div>
  );
}
