import type {
  CaptureCapabilities,
  CaptureOptions,
  CaptureSurface,
  ICaptureProvider,
  Unsubscribe,
} from './types';

/**
 * The portable fallback provider: Chromium's `getDisplayMedia`, available on
 * every platform Electron runs on.
 *
 * It produces a `MediaStreamTrack` that feeds WebRTC's encoder directly, so the
 * *primary* path through this provider is already zero-copy — frames never
 * reach JavaScript. The `zeroCopy: false` capability below refers to what the
 * provider can offer callers that want raw frames (the JPEG tile fallback still
 * has to read pixels back); native providers will flip it to true by handing
 * out GPU textures.
 */
export class ElectronCaptureProvider implements ICaptureProvider {
  readonly name = 'electron-getdisplaymedia';

  readonly capabilities: CaptureCapabilities = {
    // Raw frames are only reachable via a canvas readback.
    zeroCopy: false,
    // getDisplayMedia exposes no damage information.
    dirtyRegions: false,
    // Cursor exclusion is requested below but honoured inconsistently; the
    // runtime answer is isCursorBaked(), not this flag.
    cursorSeparate: false,
  };

  private stream: MediaStream | null = null;
  private surface: CaptureSurface | null = null;
  private cursorBaked = true;
  private paused = false;
  private readonly trackCallbacks = new Set<(track: MediaStreamTrack) => void>();
  private readonly endedCallbacks = new Set<() => void>();

  async start(options: CaptureOptions): Promise<void> {
    if (this.stream) return;

    const stream = await navigator.mediaDevices.getDisplayMedia({
      // `cursor` is a non-exact hint: platforms that don't implement it ignore
      // it rather than failing the whole request.
      video: options.excludeCursor
        ? ({ frameRate: options.frameRate, cursor: 'never' } as MediaTrackConstraints)
        : { frameRate: options.frameRate },
      audio: false,
    });

    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Screen capture returned no video track.');
    }

    // Downscale at the source: the encoder's bitrate requirement scales with
    // input pixels, so resizing before encoding is strictly cheaper than
    // encoding large and letting the network shed quality.
    try {
      await track.applyConstraints({
        width: { max: options.maxEdge },
        height: { max: options.maxEdge },
        frameRate: options.frameRate,
      });
    } catch {
      // Some platforms reject downscale constraints; the encoder still adapts.
    }

    const settings = track.getSettings() as MediaTrackSettings & { cursor?: string };
    this.cursorBaked = !(options.excludeCursor && settings.cursor === 'never');
    this.surface = {
      width: settings.width ?? 0,
      height: settings.height ?? 0,
    };
    this.stream = stream;
    this.paused = false;

    track.addEventListener('ended', () => {
      for (const cb of this.endedCallbacks) cb();
    });
    for (const cb of this.trackCallbacks) cb(track);
  }

  async stop(): Promise<void> {
    const stream = this.stream;
    this.stream = null;
    this.surface = null;
    this.paused = false;
    this.cursorBaked = true;
    stream?.getTracks().forEach((t) => t.stop());
  }

  /**
   * Disabling the track keeps the transceiver and all negotiation intact while
   * the encoder stops doing real work — resuming needs no renegotiation and no
   * new permission prompt, which stopping the track would both require.
   */
  pause(): void {
    if (!this.stream || this.paused) return;
    this.paused = true;
    for (const track of this.stream.getVideoTracks()) track.enabled = false;
  }

  resume(): void {
    if (!this.stream || !this.paused) return;
    this.paused = false;
    for (const track of this.stream.getVideoTracks()) track.enabled = true;
  }

  isPaused(): boolean {
    return this.paused;
  }

  onTrack(callback: (track: MediaStreamTrack) => void): Unsubscribe {
    this.trackCallbacks.add(callback);
    // Late subscribers still get the already-running track.
    const existing = this.stream?.getVideoTracks()[0];
    if (existing) callback(existing);
    return () => this.trackCallbacks.delete(callback);
  }

  onEnded(callback: () => void): Unsubscribe {
    this.endedCallbacks.add(callback);
    return () => this.endedCallbacks.delete(callback);
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getSurface(): CaptureSurface | null {
    return this.surface;
  }

  isCursorBaked(): boolean {
    return this.cursorBaked;
  }
}
