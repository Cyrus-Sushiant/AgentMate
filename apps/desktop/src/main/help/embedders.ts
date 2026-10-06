import { HELP_EMBEDDING_MODELS } from '@agentmat/core';
import type { AiProvider } from '../../shared/apiTypes';

/**
 * Turns text into vectors with the same provider the help chat answers with, so a user who set up
 * one provider needs nothing else. Every vector comes back unit length: the index compares them by
 * cosine distance, and Gemini's reduced-size vectors are not normalized by the API.
 */

export type EmbedKind = 'document' | 'query';

export interface Embedder {
  /** `<provider>:<model>`. Vectors from different embedders never share an index table. */
  id: string;
  embed(texts: string[], kind: EmbedKind, signal?: AbortSignal): Promise<Float32Array[]>;
}

export interface EmbedderSettings {
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  ollamaBaseUrl: string;
}

const BATCH = 100;
const OLLAMA_BATCH = 32;

function normalize(values: number[]): Float32Array {
  const vector = Float32Array.from(values);
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vector.length; i++) vector[i]! /= norm;
  return vector;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(body) as { error?: string | { message?: string } };
    const message = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message;
    if (message) return message;
  } catch {
    // Not JSON. The status line is all there is to go on.
  }
  return `${fallback} failed with status ${response.status}.`;
}

async function inBatches(
  texts: string[],
  size: number,
  run: (batch: string[]) => Promise<number[][]>,
): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += size) {
    for (const values of await run(texts.slice(i, i + size))) out.push(normalize(values));
  }
  return out;
}

function openAiEmbedder(apiKey: string): Embedder {
  const model = HELP_EMBEDDING_MODELS.openai.id;
  return {
    id: `openai:${model}`,
    embed: (texts, _kind, signal) =>
      inBatches(texts, BATCH, async (input) => {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, input }),
          signal,
        });
        if (!response.ok) throw new Error(await errorMessage(response, 'OpenAI embeddings'));
        const data = (await response.json()) as { data: { index: number; embedding: number[] }[] };
        return [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      }),
  };
}

function geminiEmbedder(apiKey: string): Embedder {
  const { id: model, dimensions } = HELP_EMBEDDING_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`;
  return {
    id: `gemini:${model}`,
    embed: (texts, kind, signal) =>
      inBatches(texts, BATCH, async (batch) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
              taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
              outputDimensionality: dimensions,
            })),
          }),
          signal,
        });
        if (!response.ok) throw new Error(await errorMessage(response, 'Gemini embeddings'));
        const data = (await response.json()) as { embeddings: { values: number[] }[] };
        return data.embeddings.map((e) => e.values);
      }),
  };
}

function ollamaEmbedder(savedUrl: string): Embedder {
  const model = HELP_EMBEDDING_MODELS.ollama.id;
  const baseUrl = (savedUrl.trim() || 'http://localhost:11434').replace(/\/+$/, '');
  return {
    id: `ollama:${model}`,
    embed: (texts, _kind, signal) =>
      inBatches(texts, OLLAMA_BATCH, async (input) => {
        let response: Response;
        try {
          response = await fetch(`${baseUrl}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, input }),
            signal,
          });
        } catch (error) {
          if (signal?.aborted) throw error;
          throw new Error(`Could not reach Ollama at ${baseUrl}. Is it running?`, { cause: error });
        }
        if (response.status === 404) {
          throw new Error(
            `Ollama has no ${model} model for search. Run "ollama pull ${model}" to add it.`,
          );
        }
        if (!response.ok) throw new Error(await errorMessage(response, 'Ollama embeddings'));
        const data = (await response.json()) as { embeddings: number[][] };
        return data.embeddings;
      }),
  };
}

/** The embedder for `provider`, or null when that provider is not set up in Settings. */
export function createEmbedder(provider: AiProvider, settings: EmbedderSettings): Embedder | null {
  if (provider === 'openai') {
    const key = settings.openaiApiKey?.trim();
    return key ? openAiEmbedder(key) : null;
  }
  if (provider === 'gemini') {
    const key = settings.geminiApiKey?.trim();
    return key ? geminiEmbedder(key) : null;
  }
  return ollamaEmbedder(settings.ollamaBaseUrl ?? '');
}
