import type { HealthProbeState } from './types.js';

/**
 * When a target counts as down or back up. One bad sample is not an outage (a deploy restarting
 * the app, a dropped packet), so a change has to repeat `confirm` times in a row before an
 * incident opens or resolves. The first good sample is believed at once: there is nothing to
 * announce about a target that was never down.
 */

export type HealthVerdict = 'ok' | 'problem';

export interface HealthTrack {
  /** What the target was last confirmed as, or null before the first confirmation. */
  confirmed: HealthVerdict | null;
  /** How many samples in a row disagreed with `confirmed`. */
  streak: number;
  /** True while a change is waiting for its confirming sample. */
  pending: boolean;
}

export const INITIAL_HEALTH_TRACK: HealthTrack = { confirmed: null, streak: 0, pending: false };

const PROBLEM_STATES: ReadonlySet<HealthProbeState> = new Set([
  'fail',
  'unreachable',
  'unauthorized',
  'invalid',
]);

/** Warn is degraded, not down: it shows on the page but opens no incident. */
export function isHealthProblem(state: HealthProbeState): boolean {
  return PROBLEM_STATES.has(state);
}

export interface HealthTrackStep {
  track: HealthTrack;
  opened: boolean;
  resolved: boolean;
}

export function nextHealthTrack(
  previous: HealthTrack,
  state: HealthProbeState,
  confirm = 2,
): HealthTrackStep {
  const verdict: HealthVerdict = isHealthProblem(state) ? 'problem' : 'ok';
  const needed = Math.max(1, Math.round(confirm));

  if (verdict === previous.confirmed) {
    return {
      track: { confirmed: verdict, streak: 0, pending: false },
      opened: false,
      resolved: false,
    };
  }
  if (previous.confirmed === null && verdict === 'ok') {
    return {
      track: { confirmed: 'ok', streak: 0, pending: false },
      opened: false,
      resolved: false,
    };
  }

  const streak = previous.streak + 1;
  if (streak < needed) {
    return {
      track: { confirmed: previous.confirmed, streak, pending: true },
      opened: false,
      resolved: false,
    };
  }
  return {
    track: { confirmed: verdict, streak: 0, pending: false },
    opened: verdict === 'problem',
    resolved: verdict === 'ok' && previous.confirmed === 'problem',
  };
}
