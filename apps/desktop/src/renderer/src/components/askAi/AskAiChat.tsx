import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  History,
  MessageSquare,
  RefreshCw,
  Robot,
  Send,
  SettingsIcon,
  Trash2,
  TriangleAlert,
} from '@/components/icons';
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

const SUGGESTIONS = [
  'Summarize what this project does',
  'Help me write a commit message',
  'Explain an error I ran into',
];

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
  const clearMessages = useAskAiStore((s) => s.clearMessages);

  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const geminiModelsQuery = useQuery({
    queryKey: ['gemini-models'],
    queryFn: () => window.agentmat.ai.listGeminiModels(),
    enabled: provider === 'gemini' && !!settingsQuery.data?.geminiApiKey,
    retry: false,
  });

  useEffect(() => {
    if (geminiModelsQuery.error) {
      toast.error((geminiModelsQuery.error as Error).message || 'Failed to load Gemini models.');
    }
    // Only fire when a fetch attempt actually resolves to an error, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geminiModelsQuery.error]);

  const geminiModelOptions = geminiModelsQuery.data?.length
    ? geminiModelsQuery.data.map((name) => ({ value: name, label: name }))
    : geminiModelsQuery.isError
      ? []
      : GEMINI_MODEL_OPTIONS;

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

  function handleSuggestionClick(suggestion: string): void {
    setPrompt(suggestion);
    textareaRef.current?.focus();
  }

  const configured =
    provider === 'openai'
      ? !!settingsQuery.data?.openaiApiKey
      : provider === 'gemini'
        ? !!settingsQuery.data?.geminiApiKey
        : true;

  return (
    <div className={cn('flex flex-1 flex-col gap-3 overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-2">
        <Tabs value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
          <TabsList className="h-8 w-auto border-none bg-foreground/[0.06] p-1 rounded-lg">
            <TabsTrigger
              value="openai"
              className="h-6 rounded-md border-none px-2.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              OpenAI
            </TabsTrigger>
            <TabsTrigger
              value="gemini"
              className="h-6 rounded-md border-none px-2.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Gemini
            </TabsTrigger>
            <TabsTrigger
              value="ollama"
              className="h-6 rounded-md border-none px-2.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Ollama
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {provider === 'openai' && (
            <Combobox
              className="w-44"
              value={openaiModel}
              onChange={setOpenaiModel}
              options={OPENAI_MODEL_OPTIONS}
              placeholder="Model"
            />
          )}
          {provider === 'gemini' && (
            <>
              <Combobox
                className="w-44"
                value={geminiModel}
                onChange={setGeminiModel}
                options={geminiModelOptions}
                placeholder={geminiModelsQuery.isFetching ? 'Loading models…' : 'Model'}
                emptyText={
                  geminiModelsQuery.isError
                    ? 'Could not load models — check your API key.'
                    : 'No models found.'
                }
              />
              {!!settingsQuery.data?.geminiApiKey && (
                <Button
                  variant="outline"
                  size="icon"
                  disabled={geminiModelsQuery.isFetching}
                  onClick={() => void geminiModelsQuery.refetch()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
          {provider === 'ollama' && (
            <>
              <Combobox
                className="w-44"
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
          'flex-1 rounded-xl border border-border bg-background/40',
          variant === 'modal' && 'h-[420px] flex-none',
        )}
      >
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground">
                <MessageSquare className="h-5 w-5 opacity-70" />
              </div>
              <p className="text-sm text-muted-foreground">
                Ask anything — responses come straight from {PROVIDER_LABEL[provider]}.
              </p>
              <div className="flex flex-wrap justify-center gap-2 px-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="ml-auto max-w-[85%]">
                  <div className="whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="mr-auto flex max-w-[85%] items-start gap-2">
                  <div
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      m.role === 'error'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-foreground/[0.08] text-foreground',
                    )}
                  >
                    {m.role === 'error' ? (
                      <TriangleAlert className="h-3 w-3" />
                    ) : (
                      <Robot className="h-3 w-3" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div
                      className={cn(
                        'whitespace-pre-wrap rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm',
                        m.role === 'error'
                          ? 'border border-destructive/40 bg-destructive/10 text-destructive'
                          : 'bg-foreground/[0.06] text-foreground',
                      )}
                    >
                      {m.content}
                    </div>
                    <span className="pl-1 text-[11px] text-muted-foreground">
                      {PROVIDER_LABEL[m.provider]} · {m.model}
                    </span>
                  </div>
                </div>
              ),
            )
          )}
          {sending && (
            <div className="mr-auto flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-foreground">
                <Robot className="h-3 w-3" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-foreground/[0.06] px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 pl-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/50">
        <Textarea
          ref={textareaRef}
          className="min-h-[40px] flex-1 resize-none border-none bg-transparent p-1.5 shadow-none focus-visible:ring-0"
          placeholder="Type your question… (Enter to send, Shift+Enter for a new line)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          size="icon"
          className="mb-0.5 h-9 w-9 shrink-0 rounded-full"
          disabled={sending || !prompt.trim()}
          onClick={() => void handleSend()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {variant === 'modal' && messages.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearMessages}
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
          {onRequestViewHistory && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={onRequestViewHistory}
            >
              <History className="h-3 w-3" /> View full history
            </button>
          )}
        </div>
      )}
    </div>
  );
}
