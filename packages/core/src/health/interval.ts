/**
 * How often a target is checked. Each target has its own interval; these keep it inside a range
 * that cannot hammer a site (15 seconds at the fastest) or forget it (a day at the slowest).
 */

export const HEALTH_INTERVAL_MIN_SEC = 15;
export const HEALTH_INTERVAL_MAX_SEC = 86_400;
export const HEALTH_INTERVAL_DEFAULT_SEC = 60;

/** The choices the target dialog offers before "Custom". */
export const HEALTH_INTERVAL_PRESETS = [30, 60, 300, 900, 3600, 21_600, 86_400] as const;

export const HEALTH_TIMEOUT_MIN_SEC = 2;
export const HEALTH_TIMEOUT_MAX_SEC = 60;
export const HEALTH_TIMEOUT_DEFAULT_SEC = 10;

/** How soon to look again while a change of state waits for its confirming sample. */
const CONFIRM_DELAY_SEC = 15;
/** Up to this share of the interval is added at random, so targets drift apart. */
const JITTER = 0.05;

function clampWhole(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeHealthInterval(value: unknown): number {
  return clampWhole(
    value,
    HEALTH_INTERVAL_MIN_SEC,
    HEALTH_INTERVAL_MAX_SEC,
    HEALTH_INTERVAL_DEFAULT_SEC,
  );
}

export function normalizeHealthTimeout(value: unknown): number {
  return clampWhole(
    value,
    HEALTH_TIMEOUT_MIN_SEC,
    HEALTH_TIMEOUT_MAX_SEC,
    HEALTH_TIMEOUT_DEFAULT_SEC,
  );
}

/**
 * Milliseconds until the next check. While a new state waits to be confirmed the recheck comes
 * sooner, so an outage is announced in seconds even on an hourly target.
 */
export function healthNextDelayMs(
  intervalSec: number,
  pendingConfirmation: boolean,
  random: () => number = Math.random,
): number {
  const interval = normalizeHealthInterval(intervalSec);
  if (pendingConfirmation) return Math.min(interval, CONFIRM_DELAY_SEC) * 1000;
  return Math.round(interval * 1000 * (1 + JITTER * random()));
}

export function formatHealthInterval(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} sec`;
}
