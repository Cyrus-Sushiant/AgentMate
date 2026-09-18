import { describe, expect, it } from 'vitest';
import { describeHostQuality, describeRemoteQuality, formatMbps } from './remoteQuality';

describe('describeRemoteQuality', () => {
  it('is excellent on a local link', () => {
    expect(describeRemoteQuality({ rttMs: 12, packetsLost: 0 })).toEqual({
      label: 'Excellent',
      variant: 'success',
    });
  });

  it('is excellent, not unknown, while the RTT has not been measured yet', () => {
    // The first samples of a session have no round trip time; that is not a fault.
    expect(describeRemoteQuality({ rttMs: null, packetsLost: 0 }).label).toBe('Excellent');
  });

  it('steps down through good, fair and poor as the round trip grows', () => {
    expect(describeRemoteQuality({ rttMs: 51, packetsLost: 0 }).label).toBe('Good');
    expect(describeRemoteQuality({ rttMs: 151, packetsLost: 0 }).label).toBe('Fair');
    expect(describeRemoteQuality({ rttMs: 301, packetsLost: 0 }).label).toBe('Poor');
  });

  it('keeps each band inclusive of its own edge', () => {
    expect(describeRemoteQuality({ rttMs: 50, packetsLost: 0 }).label).toBe('Excellent');
    expect(describeRemoteQuality({ rttMs: 150, packetsLost: 0 }).label).toBe('Good');
    expect(describeRemoteQuality({ rttMs: 300, packetsLost: 0 }).label).toBe('Fair');
  });

  it('lets lost packets alone drag the badge down', () => {
    expect(describeRemoteQuality({ rttMs: 10, packetsLost: 6 })).toEqual({
      label: 'Fair',
      variant: 'warning',
    });
    expect(describeRemoteQuality({ rttMs: 10, packetsLost: 21 })).toEqual({
      label: 'Poor',
      variant: 'destructive',
    });
  });

  it('badges a still desktop by its network, not by its frame rate', () => {
    // An unchanging screen encodes near 0 fps on purpose, which is the efficient case.
    expect(describeRemoteQuality({ rttMs: 20, packetsLost: 0 }).variant).toBe('success');
  });
});

describe('describeHostQuality', () => {
  const sample = (patch: Partial<Parameters<typeof describeHostQuality>[0]> = {}) =>
    describeHostQuality({ rttMs: 20, lossRatio: 0, limitation: null, ...patch });

  it('reads the governor is loss ratio rather than a packet count', () => {
    expect(sample({ lossRatio: 0.02 }).label).toBe('Fair');
    expect(sample({ lossRatio: 0.06 }).label).toBe('Poor');
    expect(sample({ lossRatio: 0.01 }).label).toBe('Excellent');
  });

  it('is only fair while the encoder says it is being held back', () => {
    expect(sample({ limitation: 'bandwidth' })).toEqual({ label: 'Fair', variant: 'warning' });
    expect(sample({ limitation: 'cpu' }).label).toBe('Fair');
    expect(sample({ limitation: null }).label).toBe('Excellent');
  });

  it('uses the same round trip bands as the controller side', () => {
    expect(sample({ rttMs: null }).label).toBe('Excellent');
    expect(sample({ rttMs: 51 }).label).toBe('Good');
    expect(sample({ rttMs: 151 }).label).toBe('Fair');
    expect(sample({ rttMs: 301 }).label).toBe('Poor');
  });
});

describe('formatMbps', () => {
  it('stays in kbps below one megabit', () => {
    expect(formatMbps(0)).toBe('0 kbps');
    expect(formatMbps(640)).toBe('640 kbps');
    expect(formatMbps(999)).toBe('999 kbps');
  });

  it('switches to one decimal of Mbps at a megabit', () => {
    expect(formatMbps(1000)).toBe('1.0 Mbps');
    expect(formatMbps(2540)).toBe('2.5 Mbps');
    expect(formatMbps(12_000)).toBe('12.0 Mbps');
  });
});
