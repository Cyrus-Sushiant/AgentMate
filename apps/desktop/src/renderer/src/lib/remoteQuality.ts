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

export function describeRemoteQuality(
  sample: Pick<RemoteQualitySample, 'rttMs' | 'packetsLost' | 'fps'>,
): RemoteQualityInfo {
  const { rttMs, packetsLost, fps } = sample;
  if ((rttMs !== null && rttMs > RTT_BAD_MS) || packetsLost > 20 || fps < 8) {
    return { label: 'Poor', variant: 'destructive' };
  }
  if ((rttMs !== null && rttMs > RTT_GOOD_MS) || packetsLost > 5 || fps < 18) {
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
