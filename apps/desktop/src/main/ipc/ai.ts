import { ipcMain } from 'electron';
import type {
  AiProvider,
  AskAiHistoryMessage,
  AskAiInput,
  AskAiResult,
  OllamaConnectionTest,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { store } from '../store';

/** True for the DOMException fetch throws when its AbortSignal fires. */
function isAbortError(error: unknown): boolean {
  return (error as Error | undefined)?.name === 'AbortError';
}

async function askOpenAi(
  model: string,
  prompt: string,
  history: AskAiHistoryMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const settings = await store.getSettings();
  const apiKey = settings.openaiApiKey?.trim();
  if (!apiKey) throw new Error('Set an OpenAI API key in Settings first.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: prompt },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `OpenAI request failed with status ${response.status}.`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Response body wasn't JSON, fall back to the generic status message.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Falls back to the saved server, then to the local default, and drops any trailing slashes. */
function normalizeOllamaUrl(saved: string, override?: string): string {
  return (override?.trim() || saved || 'http://localhost:11434').replace(/\/+$/, '');
}

async function ollamaBaseUrl(override?: string): Promise<string> {
  const settings = await store.getSettings();
  return normalizeOllamaUrl(settings.ollamaBaseUrl, override);
}

async function askOllama(
  model: string,
  prompt: string,
  history: AskAiHistoryMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const settings = await store.getSettings();
  const baseUrl = normalizeOllamaUrl(settings.ollamaBaseUrl);
  if (!model) throw new Error('Choose an Ollama model first.');

  const numCtx = settings.ollamaContextLength;
  const keepAlive = settings.ollamaKeepAlive?.trim();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: prompt },
        ],
        stream: false,
        // Omitted keys let Ollama keep its own defaults, so only send what the user set.
        ...(keepAlive ? { keep_alive: keepAlive } : {}),
        ...(numCtx && numCtx > 0 ? { options: { num_ctx: numCtx } } : {}),
      }),
      signal,
    });
  } catch (error) {
    // A cancelled request must not be reported as an unreachable server.
    if (isAbortError(error)) throw error;
    throw new Error(`Could not reach Ollama at ${baseUrl}. Is it running?`, { cause: error });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Ollama request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content ?? '';
}

async function askGemini(
  model: string,
  prompt: string,
  history: AskAiHistoryMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const settings = await store.getSettings();
  const apiKey = settings.geminiApiKey?.trim();
  if (!apiKey) throw new Error('Set a Gemini API key in Settings first.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        ...history.map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: prompt }] },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `Gemini request failed with status ${response.status}.`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Response body wasn't JSON, fall back to the generic status message.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}

async function listGeminiModels(): Promise<string[]> {
  const settings = await store.getSettings();
  const apiKey = settings.geminiApiKey?.trim();
  if (!apiKey) throw new Error('Set a Gemini API key in Settings first.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `Gemini request failed with status ${response.status}.`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Response body wasn't JSON, fall back to the generic status message.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };
  return (data.models ?? [])
    .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => (m.name as string).replace(/^models\//, ''))
    .sort();
}

async function listOllamaModels(baseUrlOverride?: string): Promise<string[]> {
  const baseUrl = await ollamaBaseUrl(baseUrlOverride);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new Error(`Could not reach Ollama at ${baseUrl}. Is it running?`);
  }
  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}

/** Probes a server for the Settings "Test connection" button, reporting failures instead of throwing. */
async function testOllamaConnection(baseUrlOverride?: string): Promise<OllamaConnectionTest> {
  const baseUrl = await ollamaBaseUrl(baseUrlOverride);

  let version: string | undefined;
  try {
    const response = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return { ok: false, error: `Ollama answered with status ${response.status}.` };
    }
    const data = (await response.json()) as { version?: string };
    version = data.version;
  } catch {
    return { ok: false, error: `Could not reach Ollama at ${baseUrl}. Is it running?` };
  }

  try {
    const models = await listOllamaModels(baseUrl);
    return { ok: true, version, modelCount: models.length };
  } catch (error) {
    return { ok: false, version, error: (error as Error).message };
  }
}

/** Shared by the Ask AI IPC handler and other features (e.g. git branch/commit suggestions). */
export async function runAiPrompt(
  provider: AiProvider,
  model: string,
  prompt: string,
  history: AskAiHistoryMessage[] = [],
  signal?: AbortSignal,
): Promise<string> {
  if (provider === 'openai') return askOpenAi(model, prompt, history, signal);
  if (provider === 'gemini') return askGemini(model, prompt, history, signal);
  return askOllama(model, prompt, history, signal);
}

/** In-flight requests that carried a requestId, so the renderer can abort them. */
const inFlightRequests = new Map<string, AbortController>();

export function registerAiHandlers(): void {
  ipcMain.handle(IPC.ai.ask, async (_event, input: AskAiInput): Promise<AskAiResult> => {
    const controller = new AbortController();
    if (input.requestId) inFlightRequests.set(input.requestId, controller);
    try {
      const text = await runAiPrompt(
        input.provider,
        input.model,
        input.prompt,
        input.history ?? [],
        controller.signal,
      );
      return { ok: true, text };
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        return { ok: false, text: '', cancelled: true, error: 'Request cancelled.' };
      }
      return { ok: false, text: '', error: (error as Error).message };
    } finally {
      if (input.requestId) inFlightRequests.delete(input.requestId);
    }
  });

  ipcMain.handle(IPC.ai.cancel, (_event, requestId: string): boolean => {
    const controller = inFlightRequests.get(requestId);
    if (!controller) return false;
    controller.abort();
    inFlightRequests.delete(requestId);
    return true;
  });

  ipcMain.handle(
    IPC.ai.listOllamaModels,
    (_event, baseUrl?: string): Promise<string[]> => listOllamaModels(baseUrl),
  );
  ipcMain.handle(
    IPC.ai.testOllama,
    (_event, baseUrl?: string): Promise<OllamaConnectionTest> => testOllamaConnection(baseUrl),
  );
  ipcMain.handle(IPC.ai.listGeminiModels, (): Promise<string[]> => listGeminiModels());
}
