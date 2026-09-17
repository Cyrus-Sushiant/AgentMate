export const DAILY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Whether enough time has passed since the last check to run another one. */
export function isCheckDue(
  lastCheckedAt: string | null,
  now: Date,
  intervalMs = DAILY_CHECK_INTERVAL_MS,
): boolean {
  if (!lastCheckedAt) return true;
  const last = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= intervalMs;
}
