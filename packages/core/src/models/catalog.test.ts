import { describe, expect, it } from 'vitest';
import { CLI_REGISTRY } from '../cli/registry.js';
import { runProfileForTargetAI } from '../promptBuilder/runRecommendation.js';
import { getModelPrice } from '../usage/pricing.js';
import {
  CLAUDE_MODELS,
  CLI_MODEL_EXAMPLES,
  catalogModelForApiId,
  DEFAULT_GEMINI_API_MODEL,
  DEFAULT_OPENAI_API_MODEL,
  DEFAULT_WHISPER_MODEL,
  GEMINI_API_MODELS,
  OPENAI_API_MODELS,
  WHISPER_MODELS,
} from './catalog.js';

// These guard the catalog against a half-done update: a renamed model that loses its price, a
// default that is no longer in its own list, or an example for a CLI that no longer exists.
describe('model catalog', () => {
  it('prices every Claude model', () => {
    for (const model of Object.values(CLAUDE_MODELS)) {
      expect(getModelPrice(model.apiId), model.apiId).not.toBeNull();
    }
  });

  it('keeps each default inside its own list', () => {
    expect(OPENAI_API_MODELS.map((m) => m.value)).toContain(DEFAULT_OPENAI_API_MODEL);
    expect(GEMINI_API_MODELS.map((m) => m.value)).toContain(DEFAULT_GEMINI_API_MODEL);
    expect(WHISPER_MODELS.map((m) => m.key)).toContain(DEFAULT_WHISPER_MODEL);
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
