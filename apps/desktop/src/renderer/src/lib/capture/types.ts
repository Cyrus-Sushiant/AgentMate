/**
 * Platform-independent screen-capture contract.
 *
 * The application layer (rtcHost, screenCapture, QualityGovernor) talks only to
 * this interface and never learns which provider is active. Today the only
 * implementation is {@link ElectronCaptureProvider}, which wraps
 * `getDisplayMedia`; the interface exists so DXGI Desktop Duplication,
 * ScreenCaptureKit and PipeWire providers can be dropped in later without
 * touching a single call site.
 *
 * `capabilities` is how callers adapt without branching on platform: a provider
 * that reports `dirtyRegions: false` gets the software diff path, one that
 * reports `true` can skip it entirely.
 */

export interface CaptureCapabilities {
  /** Frames can reach the encoder without a GPU→CPU readback. */
  zeroCopy: boolean;
  /** The platform reports which regions actually changed. */
  dirtyRegions: boolean;
  /** The cursor can be captured (or excluded) independently of the frames. */
  cursorSeparate: boolean;
}

export interface CaptureOptions {
  /** Longest edge of the captured surface, in pixels. */
  maxEdge: number;
  frameRate: number;
  /**
   * Ask the platform to leave the OS cursor out of captured frames so the
   * controller can draw it from the cursor DataChannel instead. Best-effort:
   * check {@link ICaptureProvider.isCursorBaked} afterwards for what actually
   * happened.
   */
  excludeCursor?: boolean;
}

export interface CaptureSurface {
  width: number;
  height: number;
}

export type Unsubscribe = () => void;

export interface ICaptureProvider {
  readonly name: string;
  readonly capabilities: CaptureCapabilities;

  start(options: CaptureOptions): Promise<void>;
  stop(): Promise<void>;
  /** Suspend frame production without tearing down negotiation. */
  pause(): void;
  resume(): void;
  isPaused(): boolean;

  /** Fires with the live video track once capture is running. */
  onTrack(callback: (track: MediaStreamTrack) => void): Unsubscribe;
  /** Fires when capture ends outside our control (user stopped the share). */
  onEnded(callback: () => void): Unsubscribe;

  getStream(): MediaStream | null;
  getSurface(): CaptureSurface | null;

  /**
   * True when captured frames still contain a drawn OS cursor, so the
   * controller must not overlay its own (that would show two cursors).
   */
  isCursorBaked(): boolean;
}
