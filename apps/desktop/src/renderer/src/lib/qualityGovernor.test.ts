import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QualityGovernor, type QualitySample } from './qualityGovernor';

/**
 * The governor is a closed loop over `RTCPeerConnection.getStats`, so the test drives it by
 * answering that call and stepping the timer, and reads back what it asked the sender for.
 */

type Stat = Record<string, unknown>;

interface StatsInput {
  /** Total packets sent so far, as the stats report counts them. */
  packetsSent?: number;
  packetsLost?: number;
  rttSeconds?: number | null;
  availableOutgoingBitrate?: number | null;
  limitation?: string;
  framesPerSecond?: number;
}

function report(input: StatsInput = {}): Map<string, Stat> {
  const stats = new Map<string, Stat>();
  stats.set('o1', {
    id: 'o1',
    type: 'outbound-rtp',
    kind: 'video',
    packetsSent: input.packetsSent ?? 1000,
    bytesSent: 500_000,
    framesPerSecond: input.framesPerSecond ?? 30,
    framesDropped: 0,
    qualityLimitationReason: input.limitation ?? 'none',
    codecId: 'c1',
  });
  stats.set('c1', { id: 'c1', type: 'codec', mimeType: 'video/H264' });
  stats.set('r1', {
    id: 'r1',
    type: 'remote-inbound-rtp',
    kind: 'video',
    packetsLost: input.packetsLost ?? 0,
    ...(input.rttSeconds === null ? {} : { roundTripTime: input.rttSeconds ?? 0.02 }),
  });
  stats.set('p1', {
    id: 'p1',
    type: 'candidate-pair',
    state: 'succeeded',
    ...(input.availableOutgoingBitrate === null
      ? {}
      : { availableOutgoingBitrate: input.availableOutgoingBitrate ?? 20_000_000 }),
  });
  return stats;
}

function setup(surface: { width: number; height: number } | null = { width: 1920, height: 1080 }) {
  const encoding: RTCRtpEncodingParameters = {};
  const parameters = { encodings: [encoding] } as RTCRtpSendParameters;
  const setParameters = vi.fn(async () => undefined);
  const sender = {
    getParameters: () => parameters,
    setParameters,
  } as unknown as RTCRtpSender;

  let stats: Map<string, Stat> = report();
  const pc = {
    getStats: vi.fn(async () => stats as unknown as RTCStatsReport),
  } as unknown as RTCPeerConnection;

  const samples: QualitySample[] = [];
  const governor = new QualityGovernor(pc, sender, () => surface);
  governor.onSample((sample) => samples.push(sample));

  /** One second of the loop: answer getStats with `input`, then let the timer fire. */
  async function tick(input: StatsInput = {}): Promise<void> {
    stats = report(input);
    await vi.advanceTimersByTimeAsync(1000);
  }

  return { governor, encoding, parameters, setParameters, samples, tick };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QualityGovernor', () => {
  it('starts one rung below the top, not at the most aggressive one', async () => {
    const { governor, encoding, samples, tick } = setup();
    governor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(encoding.maxFramerate).toBe(30);
    expect(encoding.scaleResolutionDownBy).toBe(1);
    await tick();
    expect(samples.at(-1)?.level).toBe('native/30');
    governor.stop();
  });

  it('lets the encoder shed resolution and framerate together', async () => {
    // 'maintain-resolution' collapses to a slideshow on weak WiFi; staying fluid wins here.
    const { governor, parameters, setParameters, tick } = setup();
    governor.start();
    await tick();
    expect(setParameters).toHaveBeenCalled();
    expect(parameters.degradationPreference).toBe('balanced');
    governor.stop();
  });

  it('marks the stream high priority so congestion control favours it', async () => {
    const { governor, encoding } = setup();
    governor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(encoding.priority).toBe('high');
    expect(encoding.networkPriority).toBe('high');
    governor.stop();
  });

  it('steps down a rung on a round trip that is too long', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick({ rttSeconds: 0.4 });
    expect(samples.at(-1)?.level).toBe('2/3/30');
    expect(samples.at(-1)?.rttMs).toBe(400);
    governor.stop();
  });

  it('steps down on packet loss, counted as a share of the packets in that second', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    // First sample only establishes the counters the deltas are measured from.
    await tick({ packetsSent: 1000, packetsLost: 0 });
    await tick({ packetsSent: 2000, packetsLost: 100 });
    expect(samples.at(-1)?.lossRatio).toBeCloseTo(100 / 1100, 5);
    expect(samples.at(-1)?.level).toBe('2/3/30');
    governor.stop();
  });

  it('steps down while the encoder says bandwidth or CPU is holding it back', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick({ limitation: 'bandwidth' });
    expect(samples.at(-1)?.level).toBe('2/3/30');
    await tick({ limitation: 'cpu' });
    expect(samples.at(-1)?.level).toBe('half/24');
    governor.stop();
  });

  it('steps down when the estimate cannot pay for what is being sent', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    // Below the minimum bitrate the target stops tracking the estimate, which is the point
    // at which the link is genuinely too thin for what is going out.
    await tick({ availableOutgoingBitrate: 100_000 });
    expect(samples.at(-1)?.level).toBe('2/3/30');
    governor.stop();
  });

  it('never drops below the bottom rung', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    for (let i = 0; i < 12; i++) await tick({ rttSeconds: 0.5 });
    expect(samples.at(-1)?.level).toBe('quarter/10');
    expect(samples.at(-1)?.scale).toBe(4);
    expect(samples.at(-1)?.fps).toBe(10);
    governor.stop();
  });

  it('recovers slowly, only after a run of healthy seconds', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick({ rttSeconds: 0.4 });
    expect(samples.at(-1)?.level).toBe('2/3/30');
    // Four good seconds are not enough: the climb is deliberately slower than the drop.
    for (let i = 0; i < 4; i++) await tick();
    expect(samples.at(-1)?.level).toBe('2/3/30');
    await tick();
    expect(samples.at(-1)?.level).toBe('native/30');
    governor.stop();
  });

  it('starts the healthy run over after one bad second', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick({ rttSeconds: 0.4 });
    for (let i = 0; i < 4; i++) await tick();
    await tick({ rttSeconds: 0.2 });
    for (let i = 0; i < 4; i++) await tick();
    expect(samples.at(-1)?.level).toBe('2/3/30');
    governor.stop();
  });

  it('will not climb to a rung the bandwidth estimate cannot pay for', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick({ limitation: 'bandwidth' });
    // Healthy, but only 1 Mbps available: native/30 at 1080p needs far more than that.
    for (let i = 0; i < 8; i++) await tick({ availableOutgoingBitrate: 1_000_000 });
    expect(samples.at(-1)?.level).toBe('2/3/30');
    governor.stop();
  });

  it('caps the bitrate at what the pixels need and at the measured bandwidth', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    // 1920x1080 at 30fps and 0.06 bits per pixel is a touch under 3.8 Mbps.
    await tick({ availableOutgoingBitrate: 20_000_000 });
    expect(samples.at(-1)?.targetBitrate).toBe(Math.round(1920 * 1080 * 30 * 0.06));
    // With less bandwidth than that, it takes 85% of what is on offer instead.
    await tick({ availableOutgoingBitrate: 2_000_000 });
    expect(samples.at(-1)?.targetBitrate).toBe(1_700_000);
    governor.stop();
  });

  it('never starves the encoder completely', async () => {
    const { governor, samples, tick } = setup({ width: 320, height: 180 });
    governor.start();
    await tick({ availableOutgoingBitrate: 10_000 });
    expect(samples.at(-1)?.targetBitrate).toBe(250_000);
    governor.stop();
  });

  it('reports the codec without its media prefix', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick();
    expect(samples.at(-1)?.codec).toBe('H264');
    governor.stop();
  });

  it('reports no round trip time until one has been measured', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick({ rttSeconds: null });
    expect(samples.at(-1)?.rttMs).toBeNull();
    // A missing measurement is not a fault, so quality holds.
    expect(samples.at(-1)?.level).toBe('native/30');
    governor.stop();
  });

  it('stops sampling and stops telling its listeners once stopped', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    await tick();
    const seen = samples.length;
    governor.stop();
    await tick();
    expect(samples).toHaveLength(seen);
  });

  it('drops a listener that unsubscribed', async () => {
    const { governor, tick } = setup();
    const heard: QualitySample[] = [];
    const off = governor.onSample((sample) => heard.push(sample));
    governor.start();
    await tick();
    expect(heard).toHaveLength(1);
    off();
    await tick();
    expect(heard).toHaveLength(1);
    governor.stop();
  });

  it('does nothing when there is no capture surface to measure', async () => {
    const { governor, samples, tick } = setup(null);
    governor.start();
    await tick();
    expect(samples.at(-1)?.targetBitrate).toBe(2_000_000);
    governor.stop();
  });

  it('only starts its timer once', async () => {
    const { governor, samples, tick } = setup();
    governor.start();
    governor.start();
    await tick();
    expect(samples).toHaveLength(1);
    governor.stop();
  });
});

describe('QualityGovernor with a controller display size', () => {
  it('sends no more pixels than the controller window can show', async () => {
    const encoding: RTCRtpEncodingParameters = {};
    const sender = {
      getParameters: () => ({ encodings: [encoding] }) as RTCRtpSendParameters,
      setParameters: vi.fn(async () => undefined),
    } as unknown as RTCRtpSender;
    const pc = {
      getStats: vi.fn(async () => report() as unknown as RTCStatsReport),
    } as unknown as RTCPeerConnection;
    const governor = new QualityGovernor(
      pc,
      sender,
      () => ({ width: 1920, height: 1080 }),
      () => ({ width: 960, height: 540 }),
    );
    governor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(encoding.scaleResolutionDownBy).toBe(2);
    governor.stop();
  });

  it('never upscales for a controller window bigger than the captured screen', async () => {
    const encoding: RTCRtpEncodingParameters = {};
    const sender = {
      getParameters: () => ({ encodings: [encoding] }) as RTCRtpSendParameters,
      setParameters: vi.fn(async () => undefined),
    } as unknown as RTCRtpSender;
    const pc = {
      getStats: vi.fn(async () => report() as unknown as RTCStatsReport),
    } as unknown as RTCPeerConnection;
    const governor = new QualityGovernor(
      pc,
      sender,
      () => ({ width: 1280, height: 720 }),
      () => ({ width: 3840, height: 2160 }),
    );
    governor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(encoding.scaleResolutionDownBy).toBe(1);
    governor.stop();
  });
});
