import { describe, expect, it } from 'vitest';
import { CLI_REGISTRY } from '../cli/registry.js';
import { runProfileForTargetAI } from '../promptBuilder/runRecommendation.js';
import { getModelPrice } from '../usage/pricing.js';
import {
  CLAUDE_MODELS,
  CLI_MODEL_EXAMPLES,
  CODEX_MODELS,
  catalogModelForApiId,
  DEFAULT_GEMINI_API_MODEL,
  DEFAULT_OPENAI_API_MODEL,
  DEFAULT_WHISPER_MODEL,
  GEMINI_API_MODELS,
  GEMINI_CLI_MODELS,
  HELP_EMBEDDING_MODEL_OPTIONS,
  HELP_EMBEDDING_MODELS,
  helpEmbeddingModel,
  normalizeHelpEmbeddingModels,
  OPENAI_API_MODELS,
  WHISPER_MODELS,
} from './catalog.js';

// These guard the catalog against a half-done update: a renamed model that loses its price, a
// default that is no longer in its own list, or an example for a CLI that no longer exists.
describe('model catalog', () => {
  it('prices every Claude, Codex, and Gemini CLI model', () => {
    const models = [CLAUDE_MODELS, CODEX_MODELS, GEMINI_CLI_MODELS].flatMap((m) =>
      Object.values(m),
    );
    for (const model of models) {
      expect(getModelPrice(model.apiId), model.apiId).not.toBeNull();
    }
  });

  it('keeps each default inside its own list', () => {
    expect(OPENAI_API_MODELS.map((m) => m.value)).toContain(DEFAULT_OPENAI_API_MODEL);
    expect(GEMINI_API_MODELS.map((m) => m.value)).toContain(DEFAULT_GEMINI_API_MODEL);
    expect(WHISPER_MODELS.map((m) => m.key)).toContain(DEFAULT_WHISPER_MODEL);
  });

  it('names an embedding model with a positive vector size for every API provider', () => {
    expect(Object.keys(HELP_EMBEDDING_MODELS).sort()).toEqual(['gemini', 'ollama', 'openai']);
    for (const model of Object.values(HELP_EMBEDDING_MODELS)) {
      expect(model.id).not.toBe('');
      expect(model.dimensions).toBeGreaterThan(0);
    }
  });

  it('only has examples for CLIs in the registry', () => {
    const ids = new Set(CLI_REGISTRY.map((cli) => cli.id));
    for (const cliId of Object.keys(CLI_MODEL_EXAMPLES)) expect(ids.has(cliId), cliId).toBe(true);
  });

  it('is what the run profiles show', () => {
    const labels = runProfileForTargetAI('claude-code').models.map((m) => m.label);
    expect(labels).toEqual(Object.values(CLAUDE_MODELS).map((m) => m.label));
  });

  it('finds a model by API id, ignoring dates and the 1M tag', () => {
    expect(catalogModelForApiId(`${CLAUDE_MODELS.opus.apiId}-20260101`)).toBe(CLAUDE_MODELS.opus);
    expect(catalogModelForApiId(`${CLAUDE_MODELS.opus.apiId}[1m]`)).toBe(CLAUDE_MODELS.opus);
    expect(catalogModelForApiId('some-other-model')).toBeUndefined();
  });
});

describe('help embedding model options', () => {
  it('offers the default first for every provider', () => {
    for (const provider of Object.keys(HELP_EMBEDDING_MODELS) as Array<
      keyof typeof HELP_EMBEDDING_MODELS
    >) {
      const values = HELP_EMBEDDING_MODEL_OPTIONS[provider].map((o) => o.value);
      // The picker shows the first entry as the recommended one, so it has to be what is used when
      // nothing is picked.
      expect(values[0], provider).toBe(HELP_EMBEDDING_MODELS[provider].id);
      expect(new Set(values).size, provider).toBe(values.length);
    }
  });

  it('covers exactly the providers that have a default', () => {
    expect(Object.keys(HELP_EMBEDDING_MODEL_OPTIONS).sort()).toEqual(
      Object.keys(HELP_EMBEDDING_MODELS).sort(),
    );
  });
});

describe('helpEmbeddingModel', () => {
  it('returns the model picked for that provider, trimmed', () => {
    expect(helpEmbeddingModel('openai', { openai: '  text-embedding-3-large ' })).toBe(
      'text-embedding-3-large',
    );
  });

  it('only looks at its own provider', () => {
    expect(helpEmbeddingModel('gemini', { openai: 'text-embedding-3-large' })).toBe(
      HELP_EMBEDDING_MODELS.gemini.id,
    );
  });

  it('falls back to the default when nothing usable is picked', () => {
    expect(helpEmbeddingModel('ollama', {})).toBe(HELP_EMBEDDING_MODELS.ollama.id);
    expect(helpEmbeddingModel('ollama', { ollama: '' })).toBe(HELP_EMBEDDING_MODELS.ollama.id);
    expect(helpEmbeddingModel('ollama', { ollama: '   ' })).toBe(HELP_EMBEDDING_MODELS.ollama.id);
    expect(helpEmbeddingModel('ollama', null)).toBe(HELP_EMBEDDING_MODELS.ollama.id);
    expect(helpEmbeddingModel('ollama', undefined)).toBe(HELP_EMBEDDING_MODELS.ollama.id);
  });
});

describe('normalizeHelpEmbeddingModels', () => {
  it('keeps a good pick for each known provider', () => {
    expect(normalizeHelpEmbeddingModels({ openai: 'a', gemini: 'b', ollama: 'bge-m3' })).toEqual({
      openai: 'a',
      gemini: 'b',
      ollama: 'bge-m3',
    });
  });

  it('drops providers it does not know', () => {
    expect(normalizeHelpEmbeddingModels({ anthropic: 'x', ollama: 'bge-m3' })).toEqual({
      ollama: 'bge-m3',
    });
  });

  it('drops values that are not non-empty strings', () => {
    expect(normalizeHelpEmbeddingModels({ openai: 5, gemini: '   ', ollama: ['bge-m3'] })).toEqual(
      {},
    );
    expect(normalizeHelpEmbeddingModels({ openai: null, gemini: { id: 'x' } })).toEqual({});
  });

  it('trims names and caps them at 200 characters', () => {
    const out = normalizeHelpEmbeddingModels({ openai: '  spaced  ', ollama: 'm'.repeat(500) });
    expect(out.openai).toBe('spaced');
    expect(out.ollama).toHaveLength(200);
  });

  it('turns anything that is not a plain object into an empty map', () => {
    for (const junk of [null, undefined, 'openai', 7, true, ['openai']]) {
      expect(normalizeHelpEmbeddingModels(junk), String(junk)).toEqual({});
    }
  });
});
