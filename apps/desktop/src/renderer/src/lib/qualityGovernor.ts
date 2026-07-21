/**
 * Closed-loop quality control for one outbound screen-share connection.
 *
 * Nothing here is a fixed target. Each sample reads what the transport actually
 * achieved — RTT, loss, the encoder's own limitation reason, and Chromium's
 * bandwidth estimate — and moves along a quality ladder. Bitrate is then derived
 * from the resolution and framerate that survived, so it always matches the
 * pixels being sent instead of a number picked in advance.
 *
 * The ladder (rather than continuous control) is deliberate: screen content is
 * bursty, and a proportional controller oscillates visibly on it. Discrete steps
 * plus asymmetric hysteresis — drop fast, recover slowly — keeps quality stable
 * through a scroll burst instead of pulsing.
 */

export interface QualityLevel {
  /** Resolution divisor applied to the captured surface. */
  scale: number;
  fps: number;
  label: string;
}

/** Highest quality first. */
const LADDER: QualityLevel[] = [
  { scale: 1, fps: 60, label: 'native/60' },
  { scale: 1, fps: 30, label: 'native/30' },
  { scale: 1.5, fps: 30, label: '2/3/30' },
  { scale: 2, fps: 24, label: 'half/24' },
  { scale: 3, fps: 15, label: 'third/15' },
  { scale: 4, fps: 10, label: 'quarter/10' },
];

/**
 * Bits per pixel per frame for screen content. Text and UI compress far better
 * than camera video, so this is well below the ~0.1 rule of thumb for natural
 * video. Only sets the *ceiling* — the bandwidth estimate usually binds first.
 */
const BITS_PER_PIXEL = 0.06;
/** Never starve the encoder completely, even on a terrible link. */
const MIN_BITRATE = 250_000;
/** Fraction of the measured available bandwidth we're willing to occupy. */
const BANDWIDTH_HEADROOM = 0.85;

const SAMPLE_MS = 1000;
/** Consecutive healthy samples required before stepping quality back up. */
const UPGRADE_PATIENCE = 5;

const LOSS_BAD = 0.05;
const LOSS_GOOD = 0.01;
const RTT_BAD_MS = 300;
const RTT_GOOD_MS = 150;

export interface QualitySample {
  level: string;
  scale: number;
  fps: number;
  targetBitrate: number;
  availableBitrate: number | null;
  rttMs: number | null;
  lossRatio: number;
  framesPerSecond: number;
  framesDropped: number;
  limitation: string | null;
  codec: string | null;
  bytesSent: number;
}

interface Surface {
  width: number;
  height: number;
}

export class QualityGovernor {
  private timer: number | null = null;
  private levelIndex = 1; // start at native/30, not the most aggressive rung
  private healthyStreak = 0;
  private lastPacketsSent = 0;
  private lastPacketsLost = 0;
  private lastFramesDropped = 0;
  private listeners = new Set<(sample: QualitySample) => void>();
  private stopped = false;

  constructor(
    private readonly pc: RTCPeerConnection,
    private readonly sender: RTCRtpSender,
    private readonly surface: () => Surface | null,
  ) {}

  start(): void {
    if (this.timer !== null) return;
    void this.apply();
    this.timer = window.setInterval(() => void this.sample(), SAMPLE_MS);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  onSample(callback: (sample: QualitySample) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private get level(): QualityLevel {
    return LADDER[this.levelIndex];
  }

  /** Ceiling implied by the pixels we're actually sending at this rung. */
  private ceilingBitrate(): number {
    const surface = this.surface();
    if (!surface) return 2_000_000;
    const { scale, fps } = this.level;
    const pixels = (surface.width / scale) * (surface.height / scale);
    return Math.max(MIN_BITRATE, Math.round(pixels * fps * BITS_PER_PIXEL));
  }

  private targetBitrate(available: number | null): number {
    const ceiling = this.ceilingBitrate();
    if (available === null || available <= 0) return ceiling;
    return Math.max(MIN_BITRATE, Math.min(ceiling, Math.round(available * BANDWIDTH_HEADROOM)));
  }

  private async apply(available: number | null = null): Promise<void> {
    if (this.stopped) return;
    try {
      const params = this.sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) return;
      // 'balanced' lets the encoder shed both resolution and framerate under
      // congestion. 'maintain-resolution' collapses to a ~1 fps slideshow on
      // weak WiFi — for remote control, staying fluid wins.
      params.degradationPreference = 'balanced';
      const { scale, fps } = this.level;
      for (const encoding of params.encodings) {
        encoding.maxBitrate = this.targetBitrate(available);
        encoding.maxFramerate = fps;
        encoding.scaleResolutionDownBy = scale;
        encoding.priority = 'high';
        encoding.networkPriority = 'high';
      }
      await this.sender.setParameters(params);
    } catch {
      // Parameter application is best-effort; the next sample retries.
    }
  }

  private async sample(): Promise<void> {
    if (this.stopped) return;
    let report: RTCStatsReport;
    try {
      report = await this.pc.getStats();
    } catch {
      return;
    }

    // Collected onto an object rather than into `let` bindings: TypeScript
    // can't see that the forEach callback ran, and narrows the latter to never.
    const found: {
      outbound?: Stat;
      remoteInbound?: Stat;
      candidatePair?: Stat;
    } = {};
    const byId = new Map<string, Stat>();

    report.forEach((entry) => {
      const stat = entry as unknown as Stat;
      if (typeof stat.id === 'string') byId.set(stat.id, stat);
      if (stat.type === 'outbound-rtp' && stat.kind === 'video') found.outbound = stat;
      else if (stat.type === 'remote-inbound-rtp' && stat.kind === 'video') {
        found.remoteInbound = stat;
      } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        found.candidatePair = stat;
      }
    });
    const out = found.outbound;
    if (!out) return;
    const codec = typeof out.codecId === 'string' ? byId.get(out.codecId) : undefined;

    const available = num(found.candidatePair?.availableOutgoingBitrate);
    const remoteRtt = num(found.remoteInbound?.roundTripTime);
    const pairRtt = num(found.candidatePair?.currentRoundTripTime);
    const rttMs =
      remoteRtt !== null
        ? Math.round(remoteRtt * 1000)
        : pairRtt !== null
          ? Math.round(pairRtt * 1000)
          : null;

    const packetsSent = num(out.packetsSent) ?? 0;
    const packetsLost = num(found.remoteInbound?.packetsLost) ?? 0;
    const sentDelta = Math.max(0, packetsSent - this.lastPacketsSent);
    const lostDelta = Math.max(0, packetsLost - this.lastPacketsLost);
    this.lastPacketsSent = packetsSent;
    this.lastPacketsLost = packetsLost;
    const lossRatio = sentDelta > 0 ? lostDelta / (sentDelta + lostDelta) : 0;

    const framesDroppedTotal =
      (num(out.framesDropped) ?? 0) + (num(out.qualityLimitationResolutionChanges) ?? 0);
    const framesDropped = Math.max(0, framesDroppedTotal - this.lastFramesDropped);
    this.lastFramesDropped = framesDroppedTotal;

    const limitation =
      typeof out.qualityLimitationReason === 'string' && out.qualityLimitationReason !== 'none'
        ? out.qualityLimitationReason
        : null;

    // --- control decision -----------------------------------------------------
    const target = this.targetBitrate(available);
    const starved = available !== null && available > 0 && available < target * 0.7;
    const unhealthy =
      lossRatio > LOSS_BAD ||
      (rttMs !== null && rttMs > RTT_BAD_MS) ||
      limitation === 'bandwidth' ||
      limitation === 'cpu' ||
      starved;

    if (unhealthy && this.levelIndex < LADDER.length - 1) {
      this.levelIndex++;
      this.healthyStreak = 0;
      void this.apply(available);
    } else if (unhealthy) {
      this.healthyStreak = 0;
    } else {
      const healthy =
        lossRatio < LOSS_GOOD && (rttMs === null || rttMs < RTT_GOOD_MS) && limitation === null;
      if (healthy && this.levelIndex > 0) {
        this.healthyStreak++;
        // Only climb when the estimate can actually pay for the next rung.
        const nextNeeds = this.ceilingBitrateFor(this.levelIndex - 1);
        const affordable = available === null || available > nextNeeds * 0.8;
        if (this.healthyStreak >= UPGRADE_PATIENCE && affordable) {
          this.levelIndex--;
          this.healthyStreak = 0;
          void this.apply(available);
        }
      } else {
        this.healthyStreak = 0;
        // Retrack the bandwidth estimate even when the rung doesn't change.
        void this.apply(available);
      }
    }

    const sample: QualitySample = {
      level: this.level.label,
      scale: this.level.scale,
      fps: this.level.fps,
      targetBitrate: target,
      availableBitrate: available,
      rttMs,
      lossRatio,
      framesPerSecond: num(out.framesPerSecond) ?? 0,
      framesDropped,
      limitation,
      codec: typeof codec?.mimeType === 'string' ? codec.mimeType.replace(/^video\//i, '') : null,
      bytesSent: num(out.bytesSent) ?? 0,
    };
    for (const listener of this.listeners) listener(sample);
  }

  private ceilingBitrateFor(levelIndex: number): number {
    const surface = this.surface();
    if (!surface) return 2_000_000;
    const { scale, fps } = LADDER[levelIndex];
    const pixels = (surface.width / scale) * (surface.height / scale);
    return Math.max(MIN_BITRATE, Math.round(pixels * fps * BITS_PER_PIXEL));
  }
}

/** A single `RTCStatsReport` entry, read structurally. */
type Stat = Record<string, unknown>;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
