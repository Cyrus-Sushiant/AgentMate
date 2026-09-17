import { describe, expect, it } from 'vitest';
import { DAILY_CHECK_INTERVAL_MS, isCheckDue } from './schedule';

describe('isCheckDue', () => {
  it('is due when nothing has ever been checked', () => {
    expect(isCheckDue(null, new Date('2026-09-17T12:00:00Z'))).toBe(true);
  });

  it('is due when the stored timestamp cannot be parsed', () => {
    expect(isCheckDue('not-a-date', new Date('2026-09-17T12:00:00Z'))).toBe(true);
  });

  it('is not due before a full day has passed', () => {
    const lastCheckedAt = '2026-09-17T00:00:00Z';
    const now = new Date('2026-09-17T23:59:59Z');
    expect(isCheckDue(lastCheckedAt, now)).toBe(false);
  });

  it('is due once a full day has passed', () => {
    const lastCheckedAt = '2026-09-16T12:00:00Z';
    const now = new Date('2026-09-17T12:00:00Z');
    expect(isCheckDue(lastCheckedAt, now)).toBe(true);
  });

  it('respects a custom interval', () => {
    const lastCheckedAt = '2026-09-17T11:00:00Z';
    const now = new Date('2026-09-17T12:00:00Z');
    expect(isCheckDue(lastCheckedAt, now, 30 * 60 * 1000)).toBe(true);
    expect(isCheckDue(lastCheckedAt, now, 2 * 60 * 60 * 1000)).toBe(false);
  });

  it('exposes the default interval as one day', () => {
    expect(DAILY_CHECK_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
