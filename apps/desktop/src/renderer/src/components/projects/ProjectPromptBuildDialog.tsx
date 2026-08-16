import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  Copy,
  Languages,
  Pin,
  Save,
  Sparkles,
  Spinner,
  Trash2,
  WindowMaximize,
  WindowRestore,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { containsPersian } from '@/lib/rtl';
import {
  commandForEvent,
  useShortcutLabel,
  useShortcutLabelList,
  useShortcutStore,
} from '@/stores/shortcutStore';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { cliOptionIcon } from '@/components/cliLogos';
import { PROMPT_TYPES, TARGET_AIS, cliIdForTargetAI } from '@agentmat/core';
import type { PromptType, TargetAI } from '@agentmat/core';
import { useProjectPromptBuilder } from './useProjectPromptBuilder';

export interface ProjectPromptBuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

const chromeBtnClass =
  'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-80 transition-colors hover:bg-accent hover:text-foreground hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

export function ProjectPromptBuildDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectPromptBuildDialogProps): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [copied, setCopied] = useState(false);
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const hasRequest = rawInput.trim().length > 0;
  const isBusy = isGenerating || isTranslating;
  const isPersian = containsPersian(rawInput);
  const overrides = useShortcutStore((s) => s.overrides);
  const generateKeys = useShortcutLabelList('prompt.generate');
  const generateKey = useShortcutLabel('prompt.generate');
  const translateKey = useShortcutLabel('prompt.translate');
  const copyKey = useShortcutLabel('prompt.copy');

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) setIsMaximized(false);
  }, [open]);

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

  async function onCopy(): Promise<void> {
    await handleCopy();
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0 transition-[width,height,max-width,max-height]',
          isMaximized
            ? 'h-[92vh] max-h-[92vh] w-[95vw] max-w-[95vw]'
            : 'h-[min(38rem,82vh)] max-h-[82vh] w-[min(56rem,94vw)] max-w-4xl',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestRef.current?.focus();
        }}
        // These run before the app-wide shortcuts, which stand down for
        // anything handled here. That is what lets Ctrl+T translate in this
        // dialog while it toggles the terminal everywhere else.
        onKeyDown={(event) => {
          const command = commandForEvent(event.nativeEvent, overrides, false, 'prompt');
          if (command === 'prompt.generate') {
            event.preventDefault();
            if (hasRequest && !isBusy) void handleGenerate();
            return;
          }
          if (command === 'prompt.translate') {
            event.preventDefault();
            if (hasRequest && !isBusy) void handleTranslate();
            return;
          }
          if (command === 'prompt.copy') {
            if (hasTextSelection() || !generated || isBusy) return;
            event.preventDefault();
            void onCopy();
          }
        }}
      >
        {!isMaximized && (
          <SimpleTooltip label="Keep this on the desktop">
            <button
              type="button"
              onClick={() => void handlePinToDesktop()}
              disabled={isPinning}
              className={cn(chromeBtnClass, 'absolute right-[5.25rem] top-3 z-10')}
            >
              <Pin className="h-3.5 w-3.5" />
              <span className="sr-only">Add to desktop</span>
            </button>
          </SimpleTooltip>
        )}

        <SimpleTooltip label={isMaximized ? 'Restore size' : 'Maximize'}>
          <button
            type="button"
            onClick={() => setIsMaximized((v) => !v)}
            className={cn(chromeBtnClass, 'absolute right-12 top-3 z-10')}
          >
            {isMaximized ? (
              <WindowRestore className="h-3.5 w-3.5" />
            ) : (
              <WindowMaximize className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">{isMaximized ? 'Restore size' : 'Maximize'}</span>
          </button>
        </SimpleTooltip>

        <DialogHeader className="space-y-1 border-b border-border/70 px-5 py-4 pr-28 text-left">
          <DialogTitle>Build Prompt</DialogTitle>
          <DialogDescription>
            Turn a rough request into a prompt for {projectName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/70 px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Type</Label>
              <Combobox
                className="h-8 w-[11.5rem]"
                value={promptType}
                onChange={(v) => setPromptType(v as PromptType)}
                options={PROMPT_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">Target</Label>
              <Combobox
                className="h-8 w-[11.5rem]"
                value={targetAI}
                onChange={(v) => setTargetAI(v as TargetAI)}
                options={TARGET_AIS.map((ai) => ({
                  value: ai,
                  label: ai,
                  icon: cliOptionIcon(cliIdForTargetAI(ai)),
                }))}
              />
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
            <div className="flex min-h-0 flex-col gap-2 border-b border-border/70 p-5 md:border-b-0 md:border-r">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="prompt-build-request">Your request</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {rawInput.length === 0 ? 'Empty' : `${rawInput.length} chars`}
                </span>
              </div>
              <div className="relative min-h-0 flex-1">
                <Textarea
                  id="prompt-build-request"
                  ref={requestRef}
                  className="absolute inset-0 min-h-0 resize-none bg-background/60"
                  placeholder="e.g. Add a login form with email/password validation…"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              </div>
              {isPersian && (
                <p className="text-[11px] text-muted-foreground">
                  Persian is fine. Generate writes the prompt in English.
                </p>
              )}
              <div className="flex gap-2">
                <SimpleTooltip
                  label={generateKeys ?? 'Generate prompt'}
                  wrapTrigger={!hasRequest || isBusy}
                >
                  <Button
                    className="flex-1"
                    onClick={() => void handleGenerate()}
                    disabled={!hasRequest || isBusy}
                  >
                    {isGenerating ? <Spinner className="animate-spin" /> : <Sparkles />}
                    {isGenerating ? 'Generating…' : 'Generate prompt'}
                    {!isGenerating && generateKey && (
                      <kbd className="ml-auto rounded border border-primary-foreground/25 px-1 py-px text-[10px] font-medium text-primary-foreground/80">
                        {generateKey}
                      </kbd>
                    )}
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip
                  label={
                    translateKey
                      ? `Copy your request into English without generating a prompt (${translateKey})`
                      : 'Copy your request into English without generating a prompt'
                  }
                  wrapTrigger={!hasRequest || isBusy}
                >
                  <Button
                    variant="secondary"
                    onClick={() => void handleTranslate()}
                    disabled={!hasRequest || isBusy}
                  >
                    {isTranslating ? <Spinner className="animate-spin" /> : <Languages />}
                    {isTranslating ? 'Translating…' : 'Translate'}
                    {!isTranslating && translateKey && (
                      <kbd className="rounded border border-border px-1 py-px text-[10px] font-medium text-muted-foreground">
                        {translateKey}
                      </kbd>
                    )}
                  </Button>
                </SimpleTooltip>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-col gap-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="prompt-build-output">Generated prompt</Label>
                <SimpleTooltip
                  label={
                    copied ? 'Copied' : copyKey ? `Copy prompt (${copyKey})` : 'Copy prompt'
                  }
                  wrapTrigger={!generated || isBusy}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    disabled={!generated || isBusy}
                    onClick={() => void onCopy()}
                  >
                    {copied ? <Check className="text-primary" /> : <Copy />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </SimpleTooltip>
              </div>
              <div className="relative min-h-0 flex-1">
                <Textarea
                  id="prompt-build-output"
                  value={generated}
                  onChange={(e) => setGenerated(e.target.value)}
                  placeholder="Generate or translate to fill this."
                  className="absolute inset-0 min-h-0 resize-none bg-background/60 font-mono text-sm leading-relaxed"
                  aria-busy={isBusy}
                />
                {isBusy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/70 backdrop-blur-[2px]">
                    <Spinner className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {isGenerating ? 'Generating prompt…' : 'Translating…'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="items-center border-t border-border/70 bg-muted/20 px-5 py-3 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={!rawInput && !generated}
            onClick={handleClear}
            className="text-muted-foreground"
          >
            <Trash2 /> Clear
          </Button>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {[
              generateKey && `${generateKey} generate`,
              translateKey && `${translateKey} translate`,
              copyKey && `${copyKey} copy`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <SimpleTooltip
            label={generated ? 'Park this on the project’s Overview tab' : 'Generate a prompt first'}
            wrapTrigger={!generated}
          >
            <Button
              disabled={!generated || saveDraftMutation.isPending}
              onClick={() => saveDraftMutation.mutate()}
            >
              {saveDraftMutation.isPending ? <Spinner className="animate-spin" /> : <Save />}
              {saveDraftMutation.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          </SimpleTooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** True when the user is copying a highlighted range, so Ctrl+C should stay native. */
function hasTextSelection(): boolean {
  const el = document.activeElement;
  if (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    el.selectionStart !== el.selectionEnd
  ) {
    return true;
  }
  return (window.getSelection()?.toString().length ?? 0) > 0;
}
