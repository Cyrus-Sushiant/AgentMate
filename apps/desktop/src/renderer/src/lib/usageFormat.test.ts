import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatCost,
  formatCountdown,
  formatPercent,
  formatReset,
  formatTokens,
} from './usageFormat';

const NOW = new Date('2026-03-01T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const inMs = (ms: number): string => new Date(NOW.getTime() + ms).toISOString();

describe('formatTokens', () => {
  it('shows nothing used as a plain zero', () => {
    expect(formatTokens(0)).toBe('0');
    // A provider that reports a negative delta should still read as nothing.
    expect(formatTokens(-5)).toBe('0');
  });

  it('keeps counts under a thousand exact, and rounds a fractional one', () => {
    expect(formatTokens(1)).toBe('1');
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(12.4)).toBe('12');
  });

  it('switches unit at each thousand boundary', () => {
    expect(formatTokens(1_000)).toBe('1.0K');
    expect(formatTokens(15_400)).toBe('15.4K');
    expect(formatTokens(1_000_000)).toBe('1.00M');
    expect(formatTokens(2_350_000)).toBe('2.35M');
    expect(formatTokens(1_000_000_000)).toBe('1.00B');
    expect(formatTokens(12_300_000_000)).toBe('12.30B');
  });
});

describe('formatCost', () => {
  it('has no answer when the provider gives no cost', () => {
    expect(formatCost(null)).toBeNull();
  });

  it('says "free" as $0.00 but a fraction of a cent as a floor', () => {
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(0.0004)).toBe('<$0.01');
    expect(formatCost(0.0099)).toBe('<$0.01');
  });

  it('rounds to cents from a cent upward', () => {
    expect(formatCost(0.01)).toBe('$0.01');
    expect(formatCost(2.5)).toBe('$2.50');
    expect(formatCost(1234.567)).toBe('$1234.57');
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(49.4)).toBe('49%');
    expect(formatPercent(49.5)).toBe('50%');
    expect(formatPercent(100)).toBe('100%');
  });
});

describe('formatReset', () => {
  it('has no answer without a reset time', () => {
    expect(formatReset(null)).toBeNull();
    expect(formatReset(undefined)).toBeNull();
    expect(formatReset('')).toBeNull();
  });

  it('has no answer for a timestamp it cannot read', () => {
    expect(formatReset('not a date')).toBeNull();
  });

  it('says it is resetting once the moment has passed', () => {
    expect(formatReset(inMs(0))).toBe('resetting…');
    expect(formatReset(inMs(-60_000))).toBe('resetting…');
  });

  it('counts down in the two largest units that apply', () => {
    expect(formatReset(inMs(38 * 60_000))).toBe('resets in 38m');
    expect(formatReset(inMs(3 * 3_600_000 + 5 * 60_000))).toBe('resets in 3h 5m');
    expect(formatReset(inMs(2 * 24 * 3_600_000 + 4 * 3_600_000))).toBe('resets in 2d 4h');
  });

  it('drops seconds rather than rounding up to the next minute', () => {
    expect(formatReset(inMs(119_000))).toBe('resets in 1m');
  });
});

describe('formatCountdown', () => {
  it('is formatReset without the sentence around it', () => {
    expect(formatCountdown(inMs(38 * 60_000))).toBe('38m');
    expect(formatCountdown(inMs(2 * 24 * 3_600_000 + 4 * 3_600_000))).toBe('2d 4h');
  });

  it('keeps the wording that is not a duration, and the null', () => {
    expect(formatCountdown(inMs(0))).toBe('resetting…');
    expect(formatCountdown(null)).toBeNull();
  });
});
