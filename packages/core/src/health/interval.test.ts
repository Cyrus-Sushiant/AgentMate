import { describe, expect, it } from 'vitest';
import {
  formatHealthInterval,
  HEALTH_INTERVAL_DEFAULT_SEC,
  HEALTH_INTERVAL_MAX_SEC,
  HEALTH_INTERVAL_MIN_SEC,
  HEALTH_INTERVAL_PRESETS,
  HEALTH_TIMEOUT_DEFAULT_SEC,
  healthNextDelayMs,
  normalizeHealthInterval,
  normalizeHealthTimeout,
} from './interval.js';

describe('normalizeHealthInterval', () => {
  it('keeps a valid whole number of seconds', () => {
    expect(normalizeHealthInterval(300)).toBe(300);
  });

  it('clamps to the allowed range', () => {
    expect(normalizeHealthInterval(1)).toBe(HEALTH_INTERVAL_MIN_SEC);
    expect(normalizeHealthInterval(10_000_000)).toBe(HEALTH_INTERVAL_MAX_SEC);
  });

  it('falls back to the default for anything that is not a finite number', () => {
    for (const value of [undefined, null, 'x', Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      expect(normalizeHealthInterval(value)).toBe(HEALTH_INTERVAL_DEFAULT_SEC);
    }
  });

  it('rounds fractions', () => {
    expect(normalizeHealthInterval(59.6)).toBe(60);
  });

  it('only offers presets inside the range', () => {
    for (const preset of HEALTH_INTERVAL_PRESETS) {
      expect(normalizeHealthInterval(preset)).toBe(preset);
    }
  });
});

describe('normalizeHealthTimeout', () => {
  it('clamps between 2 and 60 seconds and defaults to 10', () => {
    expect(normalizeHealthTimeout(1)).toBe(2);
    expect(normalizeHealthTimeout(600)).toBe(60);
    expect(normalizeHealthTimeout('x')).toBe(HEALTH_TIMEOUT_DEFAULT_SEC);
    expect(normalizeHealthTimeout(15)).toBe(15);
  });
});

describe('healthNextDelayMs', () => {
  it('waits the interval, plus up to 5% jitter so targets do not fire together', () => {
    expect(healthNextDelayMs(60, false, () => 0)).toBe(60_000);
    expect(healthNextDelayMs(60, false, () => 0.999)).toBeLessThanOrEqual(63_000);
    expect(healthNextDelayMs(60, false, () => 0.999)).toBeGreaterThan(62_000);
  });

  it('rechecks soon while a change waits to be confirmed', () => {
    expect(healthNextDelayMs(3600, true, () => 0)).toBe(15_000);
  });

  it('never rechecks later than the interval itself', () => {
    expect(healthNextDelayMs(15, true, () => 0)).toBe(15_000);
  });
});

describe('formatHealthInterval', () => {
  it('reads like a person would say it', () => {
    expect(formatHealthInterval(30)).toBe('30 sec');
    expect(formatHealthInterval(60)).toBe('1 min');
    expect(formatHealthInterval(90)).toBe('90 sec');
    expect(formatHealthInterval(900)).toBe('15 min');
    expect(formatHealthInterval(3600)).toBe('1 hour');
    expect(formatHealthInterval(21_600)).toBe('6 hours');
    expect(formatHealthInterval(86_400)).toBe('24 hours');
    expect(formatHealthInterval(5400)).toBe('90 min');
  });
});
