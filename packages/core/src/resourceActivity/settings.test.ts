import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDLE_RESOURCE_MINUTES,
  MAX_IDLE_RESOURCE_MINUTES,
  MIN_IDLE_RESOURCE_MINUTES,
  normalizeIdleResourceMinutes,
} from './settings.js';

describe('normalizeIdleResourceMinutes', () => {
  it('defaults to 20 minutes', () => {
    expect(DEFAULT_IDLE_RESOURCE_MINUTES).toBe(20);
  });

  it('keeps a value inside the range', () => {
    expect(normalizeIdleResourceMinutes(45)).toBe(45);
    expect(normalizeIdleResourceMinutes(MIN_IDLE_RESOURCE_MINUTES)).toBe(1);
    expect(normalizeIdleResourceMinutes(MAX_IDLE_RESOURCE_MINUTES)).toBe(1440);
  });

  it('clamps values outside the range', () => {
    expect(normalizeIdleResourceMinutes(0)).toBe(1);
    expect(normalizeIdleResourceMinutes(-5)).toBe(1);
    expect(normalizeIdleResourceMinutes(99_999)).toBe(1440);
    expect(normalizeIdleResourceMinutes(Number.POSITIVE_INFINITY)).toBe(20);
  });

  it('rounds decimals', () => {
    expect(normalizeIdleResourceMinutes(12.6)).toBe(13);
    expect(normalizeIdleResourceMinutes(0.4)).toBe(1);
  });

  it('falls back to the default for anything that is not a number', () => {
    for (const bad of [undefined, null, '30', Number.NaN, {}, [], true]) {
      expect(normalizeIdleResourceMinutes(bad)).toBe(20);
    }
  });
});
