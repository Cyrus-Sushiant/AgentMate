import { useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Languages,
  Pin,
  Save,
  Sparkles,
  Trash2,
  WindowMaximize,
  WindowRestore,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { SimpleTooltip } from '@/components/ui/tooltip';
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
import { PROMPT_TYPES, TARGET_AIS } from '@agentmat/core';
import type { PromptType, TargetAI } from '@agentmat/core';
import { useProjectPromptBuilder } from './useProjectPromptBuilder';

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
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
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
    handleClear,
    saveDraftMutation,
  } = useProjectPromptBuilder(projectId, {
    enabled: open,
    onDraftSaved: () => onOpenChange(false),
  });

  async function handlePinToDesktop(): Promise<void> {
    setIsPinning(true);
    try {
      await window.agentmat.promptBuildWidget.openWidget(projectId, projectName);
      onOpenChange(false);
      toast.success('Build Prompt added to your desktop.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the widget to your desktop.');
    } finally {
      setIsPinning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col overflow-hidden transition-[width,height,max-width,max-height]',
          isMaximized
            ? 'h-[92vh] max-h-[92vh] w-[95vw] max-w-[95vw]'
            : 'max-h-[85vh] max-w-lg',
        )}
      >
        {!isMaximized && (
          <SimpleTooltip label="Add to desktop">
            <button
              type="button"
              onClick={() => void handlePinToDesktop()}
              disabled={isPinning}
              className="absolute right-[4.5rem] top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <Pin className="h-4 w-4" />
              <span className="sr-only">Add to desktop</span>
            </button>
          </SimpleTooltip>
        )}

        <SimpleTooltip label={isMaximized ? 'Restore size' : 'Maximize'}>
          <button
            type="button"
            onClick={() => setIsMaximized((v) => !v)}
            className="absolute right-11 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isMaximized ? (
              <WindowRestore className="h-4 w-4" />
            ) : (
              <WindowMaximize className="h-4 w-4" />
            )}
            <span className="sr-only">{isMaximized ? 'Restore size' : 'Maximize'}</span>
          </button>
        </SimpleTooltip>

        <DialogHeader>
          <DialogTitle>Build Prompt — {projectName}</DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            'min-h-0 flex-1 gap-6',
            isMaximized ? 'grid grid-cols-1 overflow-hidden lg:grid-cols-2' : 'space-y-3 overflow-y-auto',
          )}
        >
          <div className="flex min-h-0 flex-col space-y-3 overflow-y-auto pr-1">
            <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
              <Label>Your request</Label>
              <Textarea
                className="min-h-[160px] flex-1 resize-none"
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
          </div>

          <div className="flex min-h-0 flex-col space-y-1.5">
            <Label>Generated prompt</Label>
            <Textarea
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
              placeholder="Generated or translated text appears here."
              className="min-h-[120px] flex-1 resize-none font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={!rawInput && !generated}
            onClick={handleClear}
            className="mr-auto"
          >
            <Trash2 /> Clear
          </Button>
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
