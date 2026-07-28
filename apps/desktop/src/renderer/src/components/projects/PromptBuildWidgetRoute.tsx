import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Languages, Sparkles, X } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { PROMPT_TYPES, TARGET_AIS } from '@agentmat/core';
import type { PromptType, TargetAI } from '@agentmat/core';
import { useProjectPromptBuilder } from './useProjectPromptBuilder';

/**
 * Standalone render target for a pinned Build Prompt desktop widget (loaded
 * at #/widget/prompt-build/:id). No AppShell/sidebar; a transparent page with
 * a frosted-glass card, an OS-drag strip, and a close button — the widget's
 * small (non-maximized) layout only, it can't be enlarged back into a dialog.
 */
export default function PromptBuildWidgetRoute(): React.JSX.Element {
  const { id = '' } = useParams();

  useEffect(() => {
    document.documentElement.setAttribute('data-widget', '');
    return () => document.documentElement.removeAttribute('data-widget');
  }, []);

  const instanceQuery = useQuery({
    queryKey: ['prompt-build-widget-instance', id],
    queryFn: () => window.agentmat.promptBuildWidget.getWidget(id),
  });

  const instance = instanceQuery.data ?? null;
  const projectId = instance?.projectId ?? '';

  const {
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
    saveDraftMutation,
  } = useProjectPromptBuilder(projectId, { enabled: !!projectId });

  return (
    <div className="glass flex h-screen w-screen flex-col overflow-hidden rounded-2xl">
      <div className="widget-drag flex h-6 shrink-0 items-center justify-between px-2">
        <span className="truncate pl-1 text-xs font-medium text-muted-foreground/80">
          {instance ? `Build Prompt — ${instance.projectName}` : 'Build Prompt'}
        </span>
        <SimpleTooltip label="Close widget" side="bottom">
          <button
            className="widget-no-drag flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground"
            onClick={() => void window.agentmat.promptBuildWidget.closeWidget(id)}
          >
            <X className="h-3 w-3" />
          </button>
        </SimpleTooltip>
      </div>

      {instance ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
          <div className="space-y-1.5">
            <Label>Your request</Label>
            <Textarea
              className="min-h-[110px] resize-none text-sm"
              placeholder="e.g. Add a login form with email/password validation…"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
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
            <span className="text-[11px] text-muted-foreground">or translate to English</span>
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

          <div className="space-y-1.5">
            <Label>Generated prompt</Label>
            <Textarea
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
              placeholder="Generated or translated text appears here."
              className="min-h-[100px] resize-none font-mono text-xs"
            />
          </div>

          <div className="flex gap-2 pb-1">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!generated}
              onClick={() => void handleCopy()}
            >
              <Copy /> Copy
            </Button>
            <Button
              className="flex-1"
              disabled={!generated || saveDraftMutation.isPending}
              onClick={() => saveDraftMutation.mutate()}
            >
              {saveDraftMutation.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-xs text-muted-foreground">
          {instanceQuery.isLoading ? 'Loading…' : 'This widget’s project could not be found.'}
        </div>
      )}
    </div>
  );
}
