import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download, Languages, Save, Sparkles, TerminalSquare } from '@/components/icons';
import { CLI_REGISTRY, PROMPT_TYPES, TARGET_AIS, generatePrompt } from '@agentmat/core';
import type { PromptType, TargetAI } from '@agentmat/core';
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
  const [rawInput, setRawInput] = useState('');
  const [promptType, setPromptType] = useState<PromptType>('Full Stack');
  const [targetAI, setTargetAI] = useState<TargetAI>('Claude');
  const [generated, setGenerated] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);

  const queryClient = useQueryClient();
  const defaultCliId = useCliStore((s) => s.defaultCliId);
  const openSession = useTerminalStore((s) => s.openSession);

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

  function handleGenerate(): void {
    if (!rawInput.trim()) {
      toast.error('Describe what you want before generating a prompt.');
      return;
    }
    const content = generatePrompt({ rawInput, promptType, targetAI });
    setGenerated(content);
    void logHistory('generate', content);
  }

  async function handleTranslate(): Promise<void> {
    if (!rawInput.trim()) {
      toast.error('Enter some text before translating.');
      return;
    }
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
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="raw-input">Your request</Label>
          <Textarea
            id="raw-input"
            rows={8}
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

        <Button onClick={handleGenerate} className="w-full">
          <Sparkles /> Generate Prompt
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
