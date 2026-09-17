import { describe, expect, it } from 'vitest';
import { relativeDate } from './relativeDate';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 17, 12);

describe('relativeDate', () => {
  it.each([
    [NOW - 30_000, 'just now'],
    [NOW - 5 * 60_000, '5 minutes ago'],
    [NOW - 3 * 3_600_000, '3 hours ago'],
    [NOW - DAY, 'yesterday'],
    [NOW - 12 * DAY, '12 days ago'],
    [NOW - 70 * DAY, '2 months ago'],
    [NOW - 800 * DAY, '2 years ago'],
    [NOW + 10 * DAY, 'in 10 days'],
  ])('%s', (ms, text) => {
    expect(relativeDate(ms, NOW)).toBe(text);
  });
});
