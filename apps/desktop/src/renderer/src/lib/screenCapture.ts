import { encodeScreenTile } from '@shared/remoteProtocol';

/**
 * Host-side screen streaming with tile-based delta encoding.
 *
 * Each tick the primary screen is drawn to an offscreen canvas and split into a
 * grid of fixed tiles. A tile is only (re-)sent when its pixels differ from the
 * previous frame, so a mostly-static desktop transmits almost nothing and only
 * the regions that actually changed (a moving window, a typing caret, a video)
 * cost bandwidth. Changed tiles are JPEG-encoded individually and pushed to the
 * main process, which fans them out to connected controllers.
 *
 * This module is a singleton, deliberately decoupled from any React component:
 * capture must keep running even when the operator navigates away from the
 * Remote page while still hosting.
 */

const TILE = 128;
const MAX_EDGE = 1600;
/** Rate the tile encoder ticks at (WebSocket fallback path). */
const TARGET_FPS = 12;
/** Rate requested from the OS capturer — WebRTC consumers get the full rate. */
const CAPTURE_FPS = 30;
const JPEG_QUALITY = 0.55;
/**
 * Tile path safety net: resend the whole frame periodically so a viewer that
 * missed tiles (send-buffer backpressure drops them) never shows a stale
 * region for more than a few seconds.
 */
const FULL_REFRESH_MS = 10_000;

interface CaptureState {
  stream: MediaStream;
  video: HTMLVideoElement;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  tileCanvas: OffscreenCanvas;
  tileCtx: OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  prev: Uint8ClampedArray | null;
  frameId: number;
  timer: number | null;
  stopping: boolean;
  lastFullFrameAt: number;
}

/**
 * When no connected controller consumes JPEG tiles (they all stream WebRTC),
 * the per-tick diff + JPEG encode work is skipped entirely so it doesn't
 * compete with the video encoder for CPU.
 */
let tilesEnabled = true;

export function setTilesEnabled(enabled: boolean): void {
  if (tilesEnabled === enabled) return;
  tilesEnabled = enabled;
  // A viewer may have missed everything while tiles were off; start fresh.
  if (enabled && state) state.prev = null;
}

/** Resend every tile on the next tick (e.g. a controller joined mid-stream). */
export function forceFullFrame(): void {
  if (state) state.prev = null;
}

let state: CaptureState | null = null;

export function isCapturing(): boolean {
  return state !== null;
}

/** The live capture stream, shared with WebRTC peer connections (rtcHost.ts). */
export function getCaptureStream(): MediaStream | null {
  return state?.stream ?? null;
}

export async function startScreenCapture(): Promise<void> {
  if (state) return;
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: CAPTURE_FPS },
    audio: false,
  });
  // Downscale at the source: a phone never benefits from a 1440p+ stream, and
  // the WebRTC encoder's bitrate requirement scales with input pixels. This is
  // "resize for the destination screen" done once, before any encoding.
  try {
    await stream.getVideoTracks()[0]?.applyConstraints({
      width: { max: MAX_EDGE },
      height: { max: MAX_EDGE },
      frameRate: CAPTURE_FPS,
    });
  } catch {
    // Some platforms reject downscale constraints; the encoder still adapts.
  }

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  // Wait until the real frame dimensions are known.
  if (!video.videoWidth) {
    await new Promise<void>((resolve) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tileCanvas = new OffscreenCanvas(TILE, TILE);
  const tileCtx = tileCanvas.getContext('2d');
  if (!ctx || !tileCtx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Could not create a capture canvas.');
  }

  state = {
    stream,
    video,
    canvas,
    ctx,
    tileCanvas,
    tileCtx,
    width,
    height,
    prev: null,
    frameId: 0,
    timer: null,
    stopping: false,
    lastFullFrameAt: Date.now(),
  };
  tilesEnabled = true;

  window.agentmat.remote.setScreenInfo({ width, height });

  // If the user (or OS) stops the share from the system UI, tear down cleanly.
  stream.getVideoTracks()[0]?.addEventListener('ended', () => stopScreenCapture());

  const interval = Math.round(1000 / TARGET_FPS);
  state.timer = window.setInterval(() => void tick(), interval);
}

export function stopScreenCapture(): void {
  if (!state) return;
  state.stopping = true;
  if (state.timer !== null) window.clearInterval(state.timer);
  state.stream.getTracks().forEach((t) => t.stop());
  state.video.srcObject = null;
  state = null;
}

let ticking = false;

async function tick(): Promise<void> {
  const s = state;
  if (!s || ticking || !tilesEnabled) return;
  ticking = true;
  try {
    // Periodic keyframe for the tile path: heal any viewer that missed tiles.
    if (Date.now() - s.lastFullFrameAt > FULL_REFRESH_MS) s.prev = null;
    if (s.prev === null) s.lastFullFrameAt = Date.now();

    s.ctx.drawImage(s.video, 0, 0, s.width, s.height);
    const frame = s.ctx.getImageData(0, 0, s.width, s.height).data;
    const frameId = s.frameId++;
    const prev = s.prev;

    // Tiles are encoded sequentially: they share one tile canvas, and the async
    // convertToBlob() would otherwise let a later tile overwrite the canvas
    // before an earlier tile's blob has been read.
    for (let ty = 0; ty < s.height && !s.stopping; ty += TILE) {
      const th = Math.min(TILE, s.height - ty);
      for (let tx = 0; tx < s.width && !s.stopping; tx += TILE) {
        const tw = Math.min(TILE, s.width - tx);
        if (prev && !tileChanged(frame, prev, s.width, tx, ty, tw, th)) continue;
        await encodeAndSend(s, frame, frameId, tx, ty, tw, th);
      }
    }
    // Keep the frame as the new baseline (copy, since getImageData reuses buffers).
    s.prev = new Uint8ClampedArray(frame);
  } catch {
    // A dropped frame is harmless; the next tick recovers.
  } finally {
    ticking = false;
  }
}

function tileChanged(
  cur: Uint8ClampedArray,
  prev: Uint8ClampedArray,
  width: number,
  tx: number,
  ty: number,
  tw: number,
  th: number,
): boolean {
  const rowBytes = tw * 4;
  for (let y = 0; y < th; y++) {
    let i = ((ty + y) * width + tx) * 4;
    const end = i + rowBytes;
    for (; i < end; i += 4) {
      // Compare RGB (skip alpha, always 255 for an opaque screen grab).
      if (cur[i] !== prev[i] || cur[i + 1] !== prev[i + 1] || cur[i + 2] !== prev[i + 2]) {
        return true;
      }
    }
  }
  return false;
}

async function encodeAndSend(
  s: CaptureState,
  frame: Uint8ClampedArray,
  frameId: number,
  tx: number,
  ty: number,
  tw: number,
  th: number,
): Promise<void> {
  // Copy this tile's pixels into the small tile canvas and JPEG-encode them.
  // Resize the canvas to the exact tile size first so edge tiles (smaller than
  // TILE) don't encode stale margin pixels.
  const img = new ImageData(tw, th);
  for (let y = 0; y < th; y++) {
    const src = ((ty + y) * s.width + tx) * 4;
    const dst = y * tw * 4;
    img.data.set(frame.subarray(src, src + tw * 4), dst);
  }
  s.tileCanvas.width = tw;
  s.tileCanvas.height = th;
  s.tileCtx.putImageData(img, 0, 0);
  const blob = await s.tileCanvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  if (s.stopping) return;
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const encoded = encodeScreenTile({ frameId, x: tx, y: ty, w: tw, h: th, jpeg });
  // encodeScreenTile returns a freshly-allocated, tightly-packed Uint8Array, so
  // its backing buffer is exactly the bytes to hand to IPC.
  window.agentmat.remote.hostTile(encoded.buffer as ArrayBuffer);
}
