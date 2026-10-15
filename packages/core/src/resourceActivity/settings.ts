/** Minutes a container or emulator can sit quiet before it shows up in the idle list. */
export const DEFAULT_IDLE_RESOURCE_MINUTES = 20;
export const MIN_IDLE_RESOURCE_MINUTES = 1;
export const MAX_IDLE_RESOURCE_MINUTES = 1440;

/** Anything that is not a finite number gives the default; numbers are rounded and clamped. */
export function normalizeIdleResourceMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_IDLE_RESOURCE_MINUTES;
  return Math.min(
    MAX_IDLE_RESOURCE_MINUTES,
    Math.max(MIN_IDLE_RESOURCE_MINUTES, Math.round(value)),
  );
}
