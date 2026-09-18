import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shortAge, timeAgo } from './time';

/**
 * Both helpers work off wall-clock differences, so the clock is frozen. The fixed moment is
 * written with an explicit offset so the test says the same thing in every time zone.
 */
const NOW = new Date('2026-03-01T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();

describe('timeAgo', () => {
  it('calls anything under a minute "just now"', () => {
    expect(timeAgo(ago(0))).toBe('just now');
    expect(timeAgo(ago(59_999))).toBe('just now');
  });

  it('counts whole minutes, then hours, then days', () => {
    expect(timeAgo(ago(60_000))).toBe('1m ago');
    expect(timeAgo(ago(59 * 60_000))).toBe('59m ago');
    expect(timeAgo(ago(60 * 60_000))).toBe('1h ago');
    expect(timeAgo(ago(23.5 * 3_600_000))).toBe('23h ago');
    expect(timeAgo(ago(24 * 3_600_000))).toBe('1d ago');
    expect(timeAgo(ago(43 * 24 * 3_600_000))).toBe('43d ago');
  });

  it('reads the same whatever offset the timestamp is written with', () => {
    // A server that answers in +03:30 must not look half a day stale.
    expect(timeAgo('2026-03-01T15:30:00.000+03:30')).toBe('just now');
  });

  it('does not count a clock skew into the future as age', () => {
    expect(timeAgo(new Date(NOW.getTime() + 5 * 60_000).toISOString())).toBe('just now');
  });
});

describe('shortAge', () => {
  it('shows seconds first, in the largest whole unit after that', () => {
    expect(shortAge(NOW.getTime(), NOW.getTime())).toBe('0s');
    expect(shortAge(NOW.getTime() - 40_000, NOW.getTime())).toBe('40s');
    expect(shortAge(NOW.getTime() - 59_999, NOW.getTime())).toBe('59s');
    expect(shortAge(NOW.getTime() - 12 * 60_000, NOW.getTime())).toBe('12m');
    expect(shortAge(NOW.getTime() - 15 * 3_600_000, NOW.getTime())).toBe('15h');
    expect(shortAge(NOW.getTime() - 43 * 24 * 3_600_000, NOW.getTime())).toBe('43d');
  });

  it('never reports a negative age for a moment in the future', () => {
    expect(shortAge(NOW.getTime() + 10_000, NOW.getTime())).toBe('0s');
  });

  it('falls back to the current clock when no "now" is given', () => {
    expect(shortAge(NOW.getTime() - 90_000)).toBe('1m');
  });
});
