import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, RefreshCw, Robot, Send, SettingsIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { queryKeys } from '@/lib/queryKeys';
import { useAskAiStore } from '@/stores/askAiStore';
import { cn } from '@/lib/utils';
import type { AiProvider } from '../../../../shared/apiTypes';

const OPENAI_MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  { value: 'o4-mini', label: 'o4-mini' },
  { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
];

const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
  { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
];

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  ollama: 'Ollama',
};

export interface AskAiChatProps {
  className?: string;
  /** 'modal' trims the message list to a fixed height for use inside a popover/dialog. */
  variant?: 'page' | 'modal';
  onRequestViewHistory?: () => void;
}

export function AskAiChat({
  className,
  variant = 'page',
  onRequestViewHistory,
}: AskAiChatProps): React.JSX.Element {
  const navigate = useNavigate();
  const provider = useAskAiStore((s) => s.provider);
  const setProvider = useAskAiStore((s) => s.setProvider);
  const openaiModel = useAskAiStore((s) => s.openaiModel);
  const setOpenaiModel = useAskAiStore((s) => s.setOpenaiModel);
  const ollamaModel = useAskAiStore((s) => s.ollamaModel);
  const setOllamaModel = useAskAiStore((s) => s.setOllamaModel);
  const geminiModel = useAskAiStore((s) => s.geminiModel);
  const setGeminiModel = useAskAiStore((s) => s.setGeminiModel);
  const messages = useAskAiStore((s) => s.messages);
  const addMessage = useAskAiStore((s) => s.addMessage);

  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    if (!openaiModel) setOpenaiModel(settingsQuery.data.openaiModel);
    if (!ollamaModel) setOllamaModel(settingsQuery.data.ollamaModel);
    if (!geminiModel) setGeminiModel(settingsQuery.data.geminiModel);
    // Only seed each field once, the first time settings arrive with nothing chosen yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data]);

  const ollamaModelsQuery = useQuery({
    queryKey: ['ollama-models'],
    queryFn: () => window.agentmat.ai.listOllamaModels(),
    enabled: provider === 'ollama',
    retry: false,
  });

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: variant === 'modal' ? 'auto' : 'smooth' });
  }, [messages, variant]);

  const model = provider === 'openai' ? openaiModel : provider === 'gemini' ? geminiModel : ollamaModel;

  async function handleSend(): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (!model.trim()) {
      toast.error(`Choose a ${PROVIDER_LABEL[provider]} model first.`);
      return;
    }

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      provider,
      model,
      createdAt: new Date().toISOString(),
    });
    setPrompt('');
    setSending(true);
    try {
      const result = await window.agentmat.ai.ask({ provider, model, prompt: trimmed });
      addMessage({
        id: crypto.randomUUID(),
        role: result.ok ? 'assistant' : 'error',
        content: result.ok ? result.text : (result.error ?? 'Something went wrong.'),
        provider,
        model,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const configured =
    provider === 'openai'
      ? !!settingsQuery.data?.openaiApiKey
      : provider === 'gemini'
        ? !!settingsQuery.data?.geminiApiKey
        : true;

  return (
    <div className={cn('flex flex-1 flex-col gap-3 overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
          <TabsList className="w-auto">
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="gemini">Gemini</TabsTrigger>
            <TabsTrigger value="ollama">Ollama</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {provider === 'openai' && (
            <Combobox
              className="w-48"
              value={openaiModel}
              onChange={setOpenaiModel}
              options={OPENAI_MODEL_OPTIONS}
              placeholder="Model"
            />
          )}
          {provider === 'gemini' && (
            <Combobox
              className="w-48"
              value={geminiModel}
              onChange={setGeminiModel}
              options={GEMINI_MODEL_OPTIONS}
              placeholder="Model"
            />
          )}
          {provider === 'ollama' && (
            <>
              <Combobox
                className="w-48"
                value={ollamaModel}
                onChange={setOllamaModel}
                options={(ollamaModelsQuery.data ?? []).map((name) => ({ value: name, label: name }))}
                placeholder={ollamaModelsQuery.isFetching ? 'Loading models…' : 'Choose a model'}
                emptyText="No models found. Is Ollama running?"
              />
              <Button
                variant="outline"
                size="icon"
                disabled={ollamaModelsQuery.isFetching}
                onClick={() => void ollamaModelsQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {!configured && (
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
              <SettingsIcon className="h-3.5 w-3.5" /> Add API key
            </Button>
          )}
        </div>
      </div>

      <ScrollArea
        className={cn(
          'flex-1 rounded-lg border border-border bg-background/40',
          variant === 'modal' && 'h-[360px] flex-none',
        )}
      >
        <div className="flex flex-col gap-3 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-6 w-6 opacity-50" />
              Ask anything — responses come straight from {PROVIDER_LABEL[provider]}.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[80%]'}>
                <div
                  className={cn(
                    'whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : m.role === 'error'
                        ? 'border border-destructive/40 bg-destructive/10 text-destructive'
                        : 'bg-foreground/[0.06] text-foreground',
                  )}
                >
                  {m.content}
                </div>
                {m.role !== 'user' && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Robot className="h-3 w-3" /> {PROVIDER_LABEL[m.provider]} · {m.model}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      <div className="flex items-end gap-2">
        <Textarea
          className="min-h-[52px] flex-1 resize-none"
          placeholder="Type your question… (Enter to send, Shift+Enter for a new line)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button disabled={sending || !prompt.trim()} onClick={() => void handleSend()}>
          <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      {variant === 'modal' && onRequestViewHistory && messages.length > 0 && (
        <button
          type="button"
          className="self-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={onRequestViewHistory}
        >
          View full history
        </button>
      )}
    </div>
  );
}
