import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { AiProvider, AskAiInput, AskAiResult } from '../../shared/apiTypes';
import { store } from '../store';

async function askOpenAi(model: string, prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `OpenAI request failed with status ${response.status}.`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Response body wasn't JSON — fall back to the generic status message.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? '';
}

async function askOllama(model: string, prompt: string): Promise<string> {
  const settings = await store.getSettings();
  const baseUrl = (settings.ollamaBaseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  if (!model) throw new Error('Choose an Ollama model first.');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
  } catch {
    throw new Error(`Could not reach Ollama at ${baseUrl}. Is it running?`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Ollama request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { response?: string };
  return data.response ?? '';
}

async function askGemini(model: string, prompt: string): Promise<string> {
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
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `Gemini request failed with status ${response.status}.`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Response body wasn't JSON — fall back to the generic status message.
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
      // Response body wasn't JSON — fall back to the generic status message.
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

async function listOllamaModels(): Promise<string[]> {
  const settings = await store.getSettings();
  const baseUrl = (settings.ollamaBaseUrl || 'http://localhost:11434').replace(/\/+$/, '');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/tags`);
  } catch {
    throw new Error(`Could not reach Ollama at ${baseUrl}. Is it running?`);
  }
  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}

/** Shared by the Ask AI IPC handler and other features (e.g. git branch/commit suggestions). */
export async function runAiPrompt(provider: AiProvider, model: string, prompt: string): Promise<string> {
  if (provider === 'openai') return askOpenAi(model, prompt);
  if (provider === 'gemini') return askGemini(model, prompt);
  return askOllama(model, prompt);
}

export function registerAiHandlers(): void {
  ipcMain.handle(IPC.ai.ask, async (_event, input: AskAiInput): Promise<AskAiResult> => {
    try {
      const text = await runAiPrompt(input.provider, input.model, input.prompt);
      return { ok: true, text };
    } catch (error) {
      return { ok: false, text: '', error: (error as Error).message };
    }
  });

  ipcMain.handle(IPC.ai.listOllamaModels, (): Promise<string[]> => listOllamaModels());
  ipcMain.handle(IPC.ai.listGeminiModels, (): Promise<string[]> => listGeminiModels());
}
