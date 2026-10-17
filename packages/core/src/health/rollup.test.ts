import { describe, expect, it } from 'vitest';
import {
  addHealthSampleToHours,
  HEALTH_HOUR_MS,
  HEALTH_ROLLUP_HOURS,
  type HealthHourBucket,
  healthDays,
  healthHoursFromSamples,
  healthLatencyHours,
  healthLatencyPercentiles,
  healthUptimeSince,
  localDayStart,
  localHourStart,
  mergeHealthDays,
} from './rollup.js';
import type { HealthSample } from './types.js';

// UTC boundaries, so the tests read the same in every time zone.
const hourStart = (ms: number) => Math.floor(ms / HEALTH_HOUR_MS) * HEALTH_HOUR_MS;
const DAY = 24 * HEALTH_HOUR_MS;
const dayStart = (ms: number) => Math.floor(ms / DAY) * DAY;
const opts = { hourStart };

const T0 = Date.UTC(2026, 9, 17, 10, 0, 0);
const MIN = 60_000;

function sample(at: number, state: HealthSample['state'] = 'pass', latencyMs: number | null = 100) {
  return { at, state, latencyMs };
}

function feed(samples: HealthSample[]): HealthHourBucket[] {
  return samples.reduce<HealthHourBucket[]>(
    (hours, one) => addHealthSampleToHours(hours, one, opts),
    [],
  );
}

describe('healthLatencyPercentiles', () => {
  it('gives the median and the 95th percentile by nearest rank', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(healthLatencyPercentiles(values)).toEqual({ p50: 50, p95: 95 });
    expect(healthLatencyPercentiles([30, 10, 20])).toEqual({ p50: 20, p95: 30 });
    expect(healthLatencyPercentiles([7])).toEqual({ p50: 7, p95: 7 });
  });

  it('has nothing to say about no readings', () => {
    expect(healthLatencyPercentiles([])).toEqual({ p50: null, p95: null });
  });
});

describe('addHealthSampleToHours', () => {
  it('counts checks and failures per hour, with warn counted as up', () => {
    const hours = feed([
      sample(T0 + 1 * MIN),
      sample(T0 + 2 * MIN, 'warn'),
      sample(T0 + 3 * MIN, 'fail', 900),
      sample(T0 + 4 * MIN, 'unreachable', null),
      sample(T0 + 61 * MIN),
    ]);
    expect(hours).toHaveLength(2);
    expect(hours[0]).toMatchObject({ start: T0, checks: 4, failures: 2 });
    expect(hours[1]).toMatchObject({ start: T0 + HEALTH_HOUR_MS, checks: 1, failures: 0 });
  });

  it('keeps raw latencies only on the newest hour, and settles the percentiles of a closed one', () => {
    const hours = feed([
      sample(T0 + 1 * MIN, 'pass', 100),
      sample(T0 + 2 * MIN, 'pass', 300),
      sample(T0 + 3 * MIN, 'pass', 200),
      sample(T0 + 61 * MIN, 'pass', 50),
    ]);
    expect(hours[0]).toEqual({
      start: T0,
      checks: 3,
      failures: 0,
      p50: 200,
      p95: 300,
    });
    expect(hours[1].latencies).toEqual([50]);
    expect(hours[1]).toMatchObject({ p50: 50, p95: 50 });
  });

  it('caps the raw latencies of an hour so a tight interval cannot grow the file', () => {
    // 1000 checks, 3 s apart, all inside one hour.
    const many = Array.from({ length: 1000 }, (_, i) => sample(T0 + i * 3_000, 'pass', i + 1));
    const [hour] = feed(many);
    expect(hour.checks).toBe(1000);
    expect(hour.latencies?.length).toBeLessThanOrEqual(240);
    // Thinned evenly across the hour, so the percentiles stay close to the real ones.
    expect(hour.p50).toBeGreaterThan(450);
    expect(hour.p50).toBeLessThan(550);
    expect(hour.p95).toBeGreaterThan(900);
  });

  it('adds a late sample to its own hour and leaves the order alone', () => {
    let hours = feed([sample(T0 + 5 * MIN), sample(T0 + 65 * MIN)]);
    hours = addHealthSampleToHours(hours, sample(T0 + 10 * MIN, 'fail'), opts);
    expect(hours.map((one) => one.start)).toEqual([T0, T0 + HEALTH_HOUR_MS]);
    expect(hours[0]).toMatchObject({ checks: 2, failures: 1 });
  });

  it('drops hours older than the window', () => {
    const old = sample(T0);
    const recent = sample(T0 + HEALTH_ROLLUP_HOURS * HEALTH_HOUR_MS + MIN);
    const hours = feed([old, recent]);
    expect(hours.map((one) => one.start)).toEqual([hourStart(recent.at)]);
  });

  it('does not change the list it was given', () => {
    const hours = feed([sample(T0)]);
    const copy = structuredClone(hours);
    addHealthSampleToHours(hours, sample(T0 + MIN), opts);
    expect(hours).toEqual(copy);
  });
});

describe('healthHoursFromSamples', () => {
  it('builds the hours from samples saved before the hours existed', () => {
    const samples = [sample(T0 + 2 * MIN), sample(T0 + MIN, 'fail'), sample(T0 + 70 * MIN)];
    expect(healthHoursFromSamples(samples, opts)).toEqual(
      feed([samples[1], samples[0], samples[2]]),
    );
  });
});

describe('healthUptimeSince', () => {
  it('is the share of checks without a problem in the hours since a moment', () => {
    const hours = feed([
      sample(T0 - 30 * HEALTH_HOUR_MS, 'fail'),
      sample(T0 + MIN),
      sample(T0 + 2 * MIN),
      sample(T0 + 3 * MIN),
      sample(T0 + 4 * MIN, 'fail'),
    ]);
    expect(healthUptimeSince(hours, T0 + 30 * MIN - DAY, opts)).toBe(0.75);
  });

  it('is null without checks in the window', () => {
    expect(healthUptimeSince([], T0)).toBeNull();
    expect(healthUptimeSince(feed([sample(T0 - DAY * 2)]), T0, opts)).toBeNull();
  });
});

describe('healthDays', () => {
  it('sums the hours into one bucket per day, oldest first, with empty days kept', () => {
    const today = dayStart(T0);
    const hours = feed([
      sample(today - 2 * DAY + MIN, 'fail'),
      sample(today - 2 * DAY + 2 * MIN),
      sample(T0 + MIN),
    ]);
    const days = healthDays(hours, { days: 3, now: T0 + 2 * MIN, startOfDay: dayStart });
    expect(days).toEqual([
      { start: today - 2 * DAY, checks: 2, failures: 1 },
      { start: today - DAY, checks: 0, failures: 0 },
      { start: today, checks: 1, failures: 0 },
    ]);
  });

  it('steps by calendar day, so a 23 or 25 hour day still lands on its own midnight', () => {
    const days = healthDays([], { days: 2, now: T0, startOfDay: dayStart });
    expect(days.map((one) => one.start)).toEqual([dayStart(T0) - DAY, dayStart(T0)]);
  });
});

describe('mergeHealthDays', () => {
  it('adds the targets together day by day', () => {
    const a = [
      { start: 1, checks: 10, failures: 1 },
      { start: 2, checks: 0, failures: 0 },
    ];
    const b = [
      { start: 1, checks: 5, failures: 0 },
      { start: 2, checks: 4, failures: 4 },
    ];
    expect(mergeHealthDays([a, b])).toEqual([
      { start: 1, checks: 15, failures: 1 },
      { start: 2, checks: 4, failures: 4 },
    ]);
    expect(mergeHealthDays([])).toEqual([]);
  });

  it('matches days by their start, not their place, when lists differ', () => {
    const a = [{ start: 2, checks: 1, failures: 0 }];
    const b = [
      { start: 1, checks: 3, failures: 1 },
      { start: 2, checks: 1, failures: 1 },
    ];
    expect(mergeHealthDays([a, b])).toEqual([
      { start: 1, checks: 3, failures: 1 },
      { start: 2, checks: 2, failures: 1 },
    ]);
  });
});

describe('healthLatencyHours', () => {
  it('gives one point per hour of the window, with gaps where there were no readings', () => {
    const hours = feed([
      sample(T0 - 2 * HEALTH_HOUR_MS + MIN, 'pass', 120),
      sample(T0 + MIN, 'pass', 80),
      sample(T0 + 2 * MIN, 'fail', null),
    ]);
    const points = healthLatencyHours(hours, { hoursBack: 3, now: T0 + 5 * MIN, hourStart });
    expect(points).toEqual([
      { start: T0 - 2 * HEALTH_HOUR_MS, checks: 1, failures: 0, p50: 120, p95: 120 },
      { start: T0 - HEALTH_HOUR_MS, checks: 0, failures: 0, p50: null, p95: null },
      { start: T0, checks: 2, failures: 1, p50: 80, p95: 80 },
    ]);
  });
});

describe('late samples and the local clock', () => {
  it('opens a closed hour of its own for a late sample whose hour is missing', () => {
    let hours = feed([sample(T0 + MIN), sample(T0 + 2 * HEALTH_HOUR_MS + MIN)]);
    hours = addHealthSampleToHours(hours, sample(T0 + HEALTH_HOUR_MS + MIN, 'fail', 40), opts);
    expect(hours.map((one) => one.start)).toEqual([
      T0,
      T0 + HEALTH_HOUR_MS,
      T0 + 2 * HEALTH_HOUR_MS,
    ]);
    expect(hours[1]).toEqual({
      start: T0 + HEALTH_HOUR_MS,
      checks: 1,
      failures: 1,
      p50: 40,
      p95: 40,
    });
  });

  it('starts hours and days on the local clock by default', () => {
    const at = new Date(2026, 9, 17, 14, 37, 12, 5).getTime();
    expect(localHourStart(at)).toBe(new Date(2026, 9, 17, 14, 0, 0, 0).getTime());
    expect(localDayStart(at)).toBe(new Date(2026, 9, 17, 0, 0, 0, 0).getTime());
    const [hour] = addHealthSampleToHours([], sample(at));
    expect(hour.start).toBe(localHourStart(at));
    expect(healthDays([hour], { days: 1, now: at })).toEqual([
      { start: localDayStart(at), checks: 1, failures: 0 },
    ]);
  });
});
