import type { RemoteQualitySample } from '@shared/apiTypes';

/**
 * Same RTT/loss bands used by `QualityGovernor` (see qualityGovernor.ts's
 * RTT_GOOD_MS/RTT_BAD_MS/LOSS_GOOD/LOSS_BAD) so a session badged "Poor" here
 * is the same session the governor is actively stepping down.
 */
const RTT_GOOD_MS = 150;
const RTT_BAD_MS = 300;

export interface RemoteQualityInfo {
  label: string;
  variant: 'success' | 'warning' | 'destructive';
}

/**
 * fps deliberately isn't a signal here: screen-share encoders correctly send
 * close to 0 fps for an unchanging desktop (nothing to encode), which isn't a
 * quality problem, so badging that "Poor" would flag the common, efficient case
 * as broken. RTT and loss are the only reliable network-health signals; they
 * stay meaningful regardless of how static the screen content is.
 */
export function describeRemoteQuality(
  sample: Pick<RemoteQualitySample, 'rttMs' | 'packetsLost'>,
): RemoteQualityInfo {
  const { rttMs, packetsLost } = sample;
  if ((rttMs !== null && rttMs > RTT_BAD_MS) || packetsLost > 20) {
    return { label: 'Poor', variant: 'destructive' };
  }
  if ((rttMs !== null && rttMs > RTT_GOOD_MS) || packetsLost > 5) {
    return { label: 'Fair', variant: 'warning' };
  }
  if (rttMs !== null && rttMs > 50) return { label: 'Good', variant: 'success' };
  return { label: 'Excellent', variant: 'success' };
}

export function formatMbps(kbps: number): string {
  const mbps = kbps / 1000;
  return mbps >= 1 ? `${mbps.toFixed(1)} Mbps` : `${kbps} kbps`;
}

const LOSS_GOOD = 0.01;
const LOSS_BAD = 0.05;

/** Host-side variant: the governor reports a running loss *ratio*, not a packet delta. */
export function describeHostQuality(sample: {
  rttMs: number | null;
  lossRatio: number;
  limitation: string | null;
}): RemoteQualityInfo {
  const { rttMs, lossRatio, limitation } = sample;
  if ((rttMs !== null && rttMs > RTT_BAD_MS) || lossRatio > LOSS_BAD) {
    return { label: 'Poor', variant: 'destructive' };
  }
  if ((rttMs !== null && rttMs > RTT_GOOD_MS) || lossRatio > LOSS_GOOD || limitation !== null) {
    return { label: 'Fair', variant: 'warning' };
  }
  if (rttMs !== null && rttMs > 50) return { label: 'Good', variant: 'success' };
  return { label: 'Excellent', variant: 'success' };
}
