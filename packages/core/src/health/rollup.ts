import { isHealthProblem } from './transitions.js';
import type { HealthSample } from './types.js';

/**
 * Hourly roll-ups of a target's checks, kept for 30 days, so the 24-hour uptime and the charts
 * read real history instead of the last few hundred samples (200 checks at a one-minute interval
 * is barely three hours).
 *
 * Hours start on the local clock's hour by default, so days split at the user's own midnight
 * even in a zone with a half-hour offset. The newest hour keeps a thinned list of raw latencies
 * so its percentiles stay current; an hour that closes keeps only its median and 95th percentile.
 */

export const HEALTH_HOUR_MS = 60 * 60 * 1000;
export const HEALTH_ROLLUP_HOURS = 30 * 24;
/** Raw latencies kept for the open hour: one every 15 s, the shortest interval, fits as is. */
export const HEALTH_HOUR_LATENCY_CAP = 240;

export interface HealthHourBucket {
  /** When the hour starts, epoch ms. */
  start: number;
  checks: number;
  /** Checks that found a problem. A warning is not one. */
  failures: number;
  p50: number | null;
  p95: number | null;
  /** The newest hour only: latencies kept so far, every `stride`-th of `seen`. */
  latencies?: number[];
  stride?: number;
  seen?: number;
}

export interface HealthDayBucket {
  start: number;
  checks: number;
  failures: number;
}

export interface HealthLatencyPoint {
  start: number;
  checks: number;
  failures: number;
  p50: number | null;
  p95: number | null;
}

export function localHourStart(ms: number): number {
  const date = new Date(ms);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

export function localDayStart(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

interface HourOptions {
  hourStart?: (ms: number) => number;
  keepHours?: number;
}

/** Median and 95th percentile by nearest rank. */
export function healthLatencyPercentiles(values: readonly number[]): {
  p50: number | null;
  p95: number | null;
} {
  if (values.length === 0) return { p50: null, p95: null };
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return { p50: rank(0.5), p95: rank(0.95) };
}

/** An hour that is no longer the newest: its percentiles settle and the raw list goes. */
function closed(hour: HealthHourBucket): HealthHourBucket {
  const { latencies, stride: _stride, seen: _seen, ...rest } = hour;
  return latencies ? { ...rest, ...healthLatencyPercentiles(latencies) } : rest;
}

function opened(start: number): HealthHourBucket {
  return { start, checks: 0, failures: 0, p50: null, p95: null, latencies: [], stride: 1, seen: 0 };
}

/** Adds one latency to the open hour, halving the kept list (and the rate) once it is full. */
function withLatency(hour: HealthHourBucket, latencyMs: number): HealthHourBucket {
  const seen = (hour.seen ?? 0) + 1;
  let stride = hour.stride ?? 1;
  let latencies = hour.latencies ?? [];
  if ((seen - 1) % stride === 0) latencies = [...latencies, latencyMs];
  if (latencies.length > HEALTH_HOUR_LATENCY_CAP) {
    latencies = latencies.filter((_, i) => i % 2 === 0);
    stride *= 2;
  }
  return { ...hour, seen, stride, latencies, ...healthLatencyPercentiles(latencies) };
}

/** The hours with one more check counted. Returns a new list; the one given is left alone. */
export function addHealthSampleToHours(
  hours: readonly HealthHourBucket[],
  sample: HealthSample,
  options: HourOptions = {},
): HealthHourBucket[] {
  const hourStart = options.hourStart ?? localHourStart;
  const keepHours = options.keepHours ?? HEALTH_ROLLUP_HOURS;
  const start = hourStart(sample.at);
  const failed = isHealthProblem(sample.state) ? 1 : 0;
  const newest = hours[hours.length - 1];
  let next: HealthHourBucket[];

  if (!newest || start > newest.start) {
    let hour: HealthHourBucket = { ...opened(start), checks: 1, failures: failed };
    if (sample.latencyMs !== null) hour = withLatency(hour, sample.latencyMs);
    next = [...hours.slice(0, -1), ...(newest ? [closed(newest)] : []), hour];
  } else if (start === newest.start) {
    let hour: HealthHourBucket = {
      ...newest,
      checks: newest.checks + 1,
      failures: newest.failures + failed,
    };
    if (sample.latencyMs !== null) hour = withLatency(hour, sample.latencyMs);
    next = [...hours.slice(0, -1), hour];
  } else {
    // A late sample for an hour that has closed: it counts, but the settled percentiles stay.
    const index = hours.findIndex((one) => one.start >= start);
    const existing = hours[index];
    if (existing && existing.start === start) {
      next = hours.map((one, i) =>
        i === index ? { ...one, checks: one.checks + 1, failures: one.failures + failed } : one,
      );
    } else {
      const latency = sample.latencyMs === null ? [] : [sample.latencyMs];
      const hour = { start, checks: 1, failures: failed, ...healthLatencyPercentiles(latency) };
      next = [...hours.slice(0, index), hour, ...hours.slice(index)];
    }
  }

  const newestStart = next[next.length - 1].start;
  const cutoff = newestStart - keepHours * HEALTH_HOUR_MS;
  return next.filter((one) => one.start > cutoff);
}

/** Hours for results saved before hours were kept, built from the samples they have. */
export function healthHoursFromSamples(
  samples: readonly HealthSample[],
  options: HourOptions = {},
): HealthHourBucket[] {
  return [...samples]
    .sort((a, b) => a.at - b.at)
    .reduce<HealthHourBucket[]>((hours, one) => addHealthSampleToHours(hours, one, options), []);
}

/** The share of checks without a problem in the hours from `since` on, or null without any. */
export function healthUptimeSince(
  hours: readonly HealthHourBucket[],
  since: number,
  options: { hourStart?: (ms: number) => number } = {},
): number | null {
  const from = (options.hourStart ?? localHourStart)(since);
  let checks = 0;
  let failures = 0;
  for (const hour of hours) {
    if (hour.start < from) continue;
    checks += hour.checks;
    failures += hour.failures;
  }
  return checks === 0 ? null : (checks - failures) / checks;
}

/** The last `days` calendar days, oldest first, each the sum of its hours. */
export function healthDays(
  hours: readonly HealthHourBucket[],
  options: { days: number; now: number; startOfDay?: (ms: number) => number },
): HealthDayBucket[] {
  const startOfDay = options.startOfDay ?? localDayStart;
  const starts: number[] = [];
  let day = startOfDay(options.now);
  for (let i = 0; i < options.days; i += 1) {
    starts.unshift(day);
    // The day before is found from its last millisecond, so a 23 or 25 hour day still works.
    day = startOfDay(day - 1);
  }
  const byStart = new Map(starts.map((start) => [start, { start, checks: 0, failures: 0 }]));
  for (const hour of hours) {
    const bucket = byStart.get(startOfDay(hour.start));
    if (!bucket) continue;
    bucket.checks += hour.checks;
    bucket.failures += hour.failures;
  }
  return starts.map((start) => byStart.get(start) as HealthDayBucket);
}

/** Several targets' days added together, matched by the day's start. */
export function mergeHealthDays(lists: readonly (readonly HealthDayBucket[])[]): HealthDayBucket[] {
  const byStart = new Map<number, HealthDayBucket>();
  for (const list of lists) {
    for (const day of list) {
      const bucket = byStart.get(day.start) ?? { start: day.start, checks: 0, failures: 0 };
      bucket.checks += day.checks;
      bucket.failures += day.failures;
      byStart.set(day.start, bucket);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/** One point per hour for the last `hoursBack` hours, oldest first, empty where nothing ran. */
export function healthLatencyHours(
  hours: readonly HealthHourBucket[],
  options: { hoursBack: number; now: number; hourStart?: (ms: number) => number },
): HealthLatencyPoint[] {
  const hourStart = options.hourStart ?? localHourStart;
  const starts: number[] = [];
  let start = hourStart(options.now);
  for (let i = 0; i < options.hoursBack; i += 1) {
    starts.unshift(start);
    start = hourStart(start - 1);
  }
  const byStart = new Map(hours.map((hour) => [hour.start, hour]));
  return starts.map((at) => {
    const hour = byStart.get(at);
    return hour
      ? { start: at, checks: hour.checks, failures: hour.failures, p50: hour.p50, p95: hour.p95 }
      : { start: at, checks: 0, failures: 0, p50: null, p95: null };
  });
}
