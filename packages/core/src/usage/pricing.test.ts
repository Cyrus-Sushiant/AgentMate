import { describe, expect, it } from 'vitest';
import { MODEL_PRICES } from '../models/catalog.js';
import { estimateCost, getModelPrice, isModelPriced } from './pricing.js';
import { emptyUsageTokens, type UsageTokens } from './types.js';

/**
 * These numbers are the dollar figures on the Usage cards and the widgets, derived
 * from local logs that record tokens but no cost. An unknown model has to come back
 * null so the UI hides the figure instead of showing a confidently wrong one, and the
 * longest-prefix match is what keeps a dated model id on its own rate rather than a
 * shorter entry's.
 */

function tokens(overrides: Partial<UsageTokens> = {}): UsageTokens {
  return { ...emptyUsageTokens(), ...overrides };
}

describe('getModelPrice', () => {
  it('finds a model listed verbatim in the catalog', () => {
    const [key, price] = Object.entries(MODEL_PRICES)[0];
    expect(getModelPrice(key)).toEqual(price);
  });

  it('matches case-insensitively, since log ids are not normalized', () => {
    const key = Object.keys(MODEL_PRICES)[0];
    expect(getModelPrice(key.toUpperCase())).toEqual(MODEL_PRICES[key]);
  });

  it('matches a key that appears anywhere in the id, including a dated suffix', () => {
    expect(getModelPrice('claude-sonnet-4-20250514')).toEqual(MODEL_PRICES['claude-sonnet-4']);
    expect(getModelPrice('anthropic/claude-sonnet-4')).toEqual(MODEL_PRICES['claude-sonnet-4']);
  });

  it('prefers the longest matching key when several apply', () => {
    // 'claude-opus-4' and 'claude-opus-4-5' both match this id; the longer one is the
    // newer, cheaper rate, and picking the short one would overcharge by 3x.
    expect(getModelPrice('claude-opus-4-5-20260101')).toEqual(MODEL_PRICES['claude-opus-4-5']);
    expect(getModelPrice('claude-opus-4-1')).toEqual(MODEL_PRICES['claude-opus-4']);
  });

  it('returns null for a model that is not in the map, and for an empty id', () => {
    expect(getModelPrice('test-model')).toBeNull();
    expect(getModelPrice('')).toBeNull();
  });
});

describe('isModelPriced', () => {
  it('agrees with getModelPrice', () => {
    for (const id of [Object.keys(MODEL_PRICES)[0], 'test-model', '']) {
      expect(isModelPriced(id), id).toBe(getModelPrice(id) !== null);
    }
  });
});

describe('estimateCost', () => {
  const model = 'claude-sonnet-4';
  const price = MODEL_PRICES[model];

  it('charges each token kind at its own per-million rate', () => {
    const usage = tokens({
      input: 1_000_000,
      output: 1_000_000,
      cacheRead: 1_000_000,
      cacheWrite: 1_000_000,
      total: 4_000_000,
    });
    expect(estimateCost(model, usage)).toBeCloseTo(
      price.input + price.output + price.cacheRead + price.cacheWrite,
      10,
    );
  });

  it('prices cache reads well below fresh input, which is the whole point of caching', () => {
    const read = estimateCost(model, tokens({ cacheRead: 1_000_000 })) ?? 0;
    const fresh = estimateCost(model, tokens({ input: 1_000_000 })) ?? 0;
    expect(read).toBeLessThan(fresh);
  });

  it('prices a cache write above fresh input, since creating the entry carries a premium', () => {
    const write = estimateCost(model, tokens({ cacheWrite: 1_000_000 })) ?? 0;
    const fresh = estimateCost(model, tokens({ input: 1_000_000 })) ?? 0;
    expect(write).toBeGreaterThan(fresh);
  });

  it('scales linearly and keeps sub-cent precision rather than rounding it away', () => {
    const one = estimateCost(model, tokens({ input: 1 })) ?? 0;
    expect(one).toBeCloseTo(price.input / 1_000_000, 12);
    expect(one).toBeGreaterThan(0);
    expect(estimateCost(model, tokens({ input: 1000 })) ?? 0).toBeCloseTo(one * 1000, 12);
  });

  it('returns exactly 0 for zero usage on a known model', () => {
    expect(estimateCost(model, emptyUsageTokens())).toBe(0);
  });

  it('ignores the `total` field, which is a display sum and not a billable kind', () => {
    // Counting it too would double every figure on the card.
    const withTotal = estimateCost(model, tokens({ input: 1_000_000, total: 1_000_000 }));
    const withoutTotal = estimateCost(model, tokens({ input: 1_000_000 }));
    expect(withTotal).toBe(withoutTotal);
  });

  it('returns null for an unknown model so the UI can hide the cost', () => {
    expect(estimateCost('test-model', tokens({ input: 1_000_000 }))).toBeNull();
    expect(estimateCost('', emptyUsageTokens())).toBeNull();
  });

  it('prices every catalog entry as a finite, non-negative number', () => {
    const usage = tokens({ input: 1000, output: 1000, cacheRead: 1000, cacheWrite: 1000 });
    for (const id of Object.keys(MODEL_PRICES)) {
      const cost = estimateCost(id, usage);
      expect(cost, id).not.toBeNull();
      expect(Number.isFinite(cost ?? Number.NaN), id).toBe(true);
      expect(cost ?? -1, id).toBeGreaterThan(0);
    }
  });
});

describe('MODEL_PRICES', () => {
  it('quotes every rate as a non-negative number, output never below input', () => {
    for (const [id, price] of Object.entries(MODEL_PRICES)) {
      for (const [kind, value] of Object.entries(price)) {
        expect(Number.isFinite(value), `${id}.${kind}`).toBe(true);
        expect(value, `${id}.${kind}`).toBeGreaterThanOrEqual(0);
      }
      expect(price.output, id).toBeGreaterThanOrEqual(price.input);
      expect(price.cacheRead, id).toBeLessThanOrEqual(price.input);
    }
  });
});
