import { MODEL_PRICES, type ModelPrice } from '../models/catalog.js';
import type { UsageTokens } from './types.js';

// Prices live with the model names in models/catalog.ts. Used to estimate cost for local-log
// providers (Claude Code, Codex) where the logs record tokens but not dollars. Unknown models
// return null so the UI can hide the cost instead of showing a wrong one.

function priceForModel(model: string): ModelPrice | null {
  const id = model.toLowerCase();
  let best: { key: string; price: ModelPrice } | null = null;
  for (const [key, price] of Object.entries(MODEL_PRICES)) {
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

/** Per-1M-token price for `model`, or null when it isn't in the price map. */
export function getModelPrice(model: string): ModelPrice | null {
  return priceForModel(model);
}

/** True when we have a price for `model` (used to decide cost vs. tokens-only UI). */
export function isModelPriced(model: string): boolean {
  return priceForModel(model) !== null;
}
