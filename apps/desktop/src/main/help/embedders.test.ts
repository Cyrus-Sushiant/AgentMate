import { HELP_EMBEDDING_MODELS } from '@agentmat/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmbedder } from './embedders';

const fetchMock = vi.fn();

function reply(json: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as Response;
}

function sent(call = 0): {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
} {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return {
    url,
    body: JSON.parse(init.body as string),
    headers: init.headers as Record<string, string>,
  };
}

const settings = {
  openaiApiKey: 'sk-test',
  geminiApiKey: 'gm-test',
  ollamaBaseUrl: 'http://ollama:11434/',
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createEmbedder', () => {
  it('returns null when the provider has no API key', () => {
    expect(createEmbedder('openai', { ...settings, openaiApiKey: '  ' })).toBeNull();
    expect(createEmbedder('gemini', { ...settings, geminiApiKey: null })).toBeNull();
  });

  it('names each embedder after its provider and model', () => {
    expect(createEmbedder('openai', settings)?.id).toBe(
      `openai:${HELP_EMBEDDING_MODELS.openai.id}`,
    );
    expect(createEmbedder('ollama', settings)?.id).toBe(
      `ollama:${HELP_EMBEDDING_MODELS.ollama.id}`,
    );
  });
});

describe('OpenAI embeddings', () => {
  it('posts the texts in one batch and returns vectors in input order', async () => {
    fetchMock.mockResolvedValue(
      reply({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      }),
    );
    const vectors = await createEmbedder('openai', settings)!.embed(['a', 'b'], 'document');
    expect(vectors.map((v) => [...v])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    const { url, body, headers } = sent();
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    expect(body).toEqual({ model: HELP_EMBEDDING_MODELS.openai.id, input: ['a', 'b'] });
    expect(headers.Authorization).toBe('Bearer sk-test');
  });

  it('splits large inputs into batches of 100', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const { input } = JSON.parse(init.body as string) as { input: string[] };
      return reply({
        data: input.map((text, index) => ({ index, embedding: [1, Number(text.slice(1))] })),
      });
    });
    const texts = Array.from({ length: 150 }, (_, i) => `t${i}`);
    const vectors = await createEmbedder('openai', settings)!.embed(texts, 'document');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vectors).toHaveLength(150);
    // Unit length, but the direction still says which text it came from.
    expect(vectors[120]![1]! / vectors[120]![0]!).toBeCloseTo(120);
  });

  it('surfaces the provider error message', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'Incorrect API key' } }, 401));
    await expect(createEmbedder('openai', settings)!.embed(['a'], 'query')).rejects.toThrow(
      'Incorrect API key',
    );
  });
});

describe('Gemini embeddings', () => {
  it('uses batchEmbedContents with a task type per use', async () => {
    fetchMock.mockResolvedValue(reply({ embeddings: [{ values: [0.5, 0.5] }] }));
    const embedder = createEmbedder('gemini', settings)!;
    await embedder.embed(['what is the vault'], 'query');
    const { url, body, headers } = sent();
    const model = HELP_EMBEDDING_MODELS.gemini.id;
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`,
    );
    expect(headers['x-goog-api-key']).toBe('gm-test');
    expect(body).toEqual({
      requests: [
        {
          model: `models/${model}`,
          content: { parts: [{ text: 'what is the vault' }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: HELP_EMBEDDING_MODELS.gemini.dimensions,
        },
      ],
    });

    await embedder.embed(['doc'], 'document');
    expect((sent(1).body.requests as Array<{ taskType: string }>)[0]?.taskType).toBe(
      'RETRIEVAL_DOCUMENT',
    );
  });

  it('normalizes vectors so cosine distance works on reduced sizes', async () => {
    fetchMock.mockResolvedValue(reply({ embeddings: [{ values: [3, 4] }] }));
    const [vector] = await createEmbedder('gemini', settings)!.embed(['x'], 'query');
    expect([...vector!].map((n) => Number(n.toFixed(3)))).toEqual([0.6, 0.8]);
  });
});

describe('Ollama embeddings', () => {
  it('posts to /api/embed on the saved server', async () => {
    fetchMock.mockResolvedValue(reply({ embeddings: [[1, 2, 3]] }));
    const [vector] = await createEmbedder('ollama', settings)!.embed(['a'], 'document');
    expect(vector).toHaveLength(3);
    const { url, body } = sent();
    expect(url).toBe('http://ollama:11434/api/embed');
    expect(body).toEqual({ model: HELP_EMBEDDING_MODELS.ollama.id, input: ['a'] });
  });

  it('falls back to the local server when none is saved', async () => {
    fetchMock.mockResolvedValue(reply({ embeddings: [[1]] }));
    await createEmbedder('ollama', { ...settings, ollamaBaseUrl: '' })!.embed(['a'], 'query');
    expect(sent().url).toBe('http://localhost:11434/api/embed');
  });

  it('tells you which model to pull when it is missing', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'model "nomic-embed-text" not found' }, 404));
    await expect(createEmbedder('ollama', settings)!.embed(['a'], 'query')).rejects.toThrow(
      `ollama pull ${HELP_EMBEDDING_MODELS.ollama.id}`,
    );
  });

  it('reports an unreachable server plainly', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(createEmbedder('ollama', settings)!.embed(['a'], 'query')).rejects.toThrow(
      /Could not reach Ollama/,
    );
  });
});
