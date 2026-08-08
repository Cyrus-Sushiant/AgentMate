import type { UsageTokens } from './types.js';

// Hand-maintained subset of model pricing (USD per 1,000,000 tokens), in the
// spirit of LiteLLM's price map. Used to estimate cost for local-log providers
// (Claude Code, Codex) where the logs record tokens but not dollars. Unknown
// models return null so the UI can hide the cost instead of showing a wrong one.
export interface ModelPrice {
  input: number;
  output: number;
  /** Price of reading a cached input token (usually a fraction of `input`). */
  cacheRead: number;
  /** Price of writing/creating a cache entry (usually a premium over `input`). */
  cacheWrite: number;
}

// Keys are matched by longest-prefix against the model id, so "claude-sonnet-5"
// matches the "claude-sonnet-5" entry and dated variants fall through to it.
const MODEL_PRICING: Record<string, ModelPrice> = {
  // Anthropic (Claude), per 1M tokens. Cache read is a tenth of the input rate;
  // cache write carries a 1.25× premium (the 5-minute TTL, which is what the
  // CLIs use). Opus dropped from $15/$75 to $5/$25 at 4.5, so the newer Opus
  // ids need their own entries; longest-prefix keeps 4.0/4.1 on the old rate.
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  'claude-mythos-5': { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-3-5-sonnet': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-3-5-haiku': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  'claude-3-opus': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },

  // OpenAI (GPT / o-series / Codex), per 1M tokens.
  'gpt-5': { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
  'gpt-4.1': { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 2 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
  'gpt-4o': { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
  'o4-mini': { input: 1.1, output: 4.4, cacheRead: 0.275, cacheWrite: 1.1 },
  o3: { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 2 },
  'codex-mini': { input: 1.5, output: 6, cacheRead: 0.375, cacheWrite: 1.5 },

  // Google (Gemini), per 1M tokens.
  'gemini-2.5-pro': { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 1.25 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cacheRead: 0.075, cacheWrite: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite: 0.1 },

  // Others.
  'deepseek-chat': { input: 0.27, output: 1.1, cacheRead: 0.07, cacheWrite: 0.27 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 },
  'mistral-large': { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 2 },
};

function priceForModel(model: string): ModelPrice | null {
  const id = model.toLowerCase();
  let best: { key: string; price: ModelPrice } | null = null;
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (id.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, price };
    }
  }
  return best?.price ?? null;
}

/**
 * Estimate cost (USD) for a token breakdown on a given model.
 * Returns null when the model isn't in the price map, so callers can hide cost.
 */
export function estimateCost(model: string, tokens: UsageTokens): number | null {
  const price = priceForModel(model);
  if (!price) return null;
  const per = 1_000_000;
  return (
    (tokens.input * price.input +
      tokens.output * price.output +
      tokens.cacheRead * price.cacheRead +
      tokens.cacheWrite * price.cacheWrite) /
    per
  );
}

/** True when we have a price for `model` (used to decide cost vs. tokens-only UI). */
export function isModelPriced(model: string): boolean {
  return priceForModel(model) !== null;
}
