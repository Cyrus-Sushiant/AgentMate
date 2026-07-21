import {
  DC_CURSOR,
  DC_INPUT,
  DC_UNRELIABLE,
  encodeCursorState,
  type RemoteInputEvent,
  type RemoteRtcMessage,
} from '@shared/remoteProtocol';
import { getCaptureStream, getCaptureSurface, isCursorBaked } from './screenCapture';
import { preferredCodecOrder } from './rtcCodecs';
import { QualityGovernor, type QualitySample } from './qualityGovernor';
import { recordHostSample } from './remoteBench';

/**
 * Host-side WebRTC streaming: one RTCPeerConnection per connected controller,
 * all sharing the single screen-capture MediaStream.
 *
 * This is the primary transport for *every* controller — desktop and mobile
 * alike. The capture track goes straight to the encoder, so screen pixels never
 * enter JavaScript on this path: no canvas, no readback, no JPEG.
 *
 * Each connection carries three planes:
 *   - the video track (congestion-controlled by WebRTC itself)
 *   - an unreliable `input` channel, so a keystroke never queues behind a frame
 *   - an unreliable `cursor` channel, so pointer motion beats the frame rate
 *
 * Signaling travels over the peer's existing WebSocket, relayed through the main
 * process tagged with the peer id.
 */

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
/** How long to wait for capture to come up before telling the peer to fall back. */
const CAPTURE_WAIT_MS = 8000;
const CAPTURE_POLL_MS = 250;

interface HostPeerSession {
  pc: RTCPeerConnection;
  governor: QualityGovernor | null;
  input: RTCDataChannel | null;
  cursor: RTCDataChannel | null;
}

const peers = new Map<string, HostPeerSession>();
let initialized = false;
let cursorTracking = false;

export function initRtcHost(): void {
  if (initialized) return;
  initialized = true;
  window.agentmat.remote.onRtcSignal(({ peerId, message }) => {
    void handleSignal(peerId, message).catch(() => {
      closeRtcPeer(peerId);
      signal(peerId, { t: 'rtc-unavailable', reason: 'WebRTC negotiation failed on the host.' });
    });
  });
  window.agentmat.remote.onRtcPeerGone((peerId) => closeRtcPeer(peerId));
  window.agentmat.remote.onHostCursor((point) => broadcastCursor(point));
}

export function closeRtcPeer(peerId: string): void {
  const session = peers.get(peerId);
  if (!session) return;
  peers.delete(peerId);
  session.governor?.stop();
  try {
    session.input?.close();
    session.cursor?.close();
    session.pc.close();
  } catch {
    // already closed
  }
  updateCursorTracking();
  // Tiles resume for this peer (no-op in main if the peer already left).
  window.agentmat.remote.rtcPeerState(peerId, false);
}

/** Called when screen capture stops entirely: drop every video connection. */
export function closeAllRtcPeers(): void {
  for (const peerId of [...peers.keys()]) closeRtcPeer(peerId);
}

function signal(peerId: string, message: RemoteRtcMessage): void {
  window.agentmat.remote.rtcSignal(peerId, message);
}

async function handleSignal(peerId: string, message: RemoteRtcMessage): Promise<void> {
  switch (message.t) {
    case 'rtc-request':
      await startPeer(peerId);
      break;
    case 'rtc-cancel':
      closeRtcPeer(peerId);
      break;
    case 'rtc-answer': {
      const session = peers.get(peerId);
      if (session) await session.pc.setRemoteDescription({ type: 'answer', sdp: message.sdp });
      break;
    }
    case 'rtc-ice': {
      const session = peers.get(peerId);
      if (session && message.candidate) {
        await session.pc.addIceCandidate({
          candidate: message.candidate,
          sdpMid: message.sdpMid,
          sdpMLineIndex: message.sdpMLineIndex,
        });
      }
      break;
    }
    default:
      break;
  }
}

/** Capture may still be starting when the controller asks for video. */
async function waitForCaptureStream(): Promise<MediaStream | null> {
  const deadline = Date.now() + CAPTURE_WAIT_MS;
  for (;;) {
    const stream = getCaptureStream();
    if (stream) return stream;
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, CAPTURE_POLL_MS));
  }
}

async function startPeer(peerId: string): Promise<void> {
  closeRtcPeer(peerId);
  const stream = await waitForCaptureStream();
  const track = stream?.getVideoTracks()[0];
  if (!stream || !track) {
    signal(peerId, { t: 'rtc-unavailable', reason: 'Screen capture is not running on the host.' });
    return;
  }

  const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
  const session: HostPeerSession = { pc, governor: null, input: null, cursor: null };
  peers.set(peerId, session);

  // Screen content: favor legible text over silky motion when bandwidth dips.
  track.contentHint = 'detail';
  const sender = pc.addTrack(track, stream);

  // The offerer creates the data channels; the controller picks them up via
  // ondatachannel. Both are unreliable — a lost mouse-move is superseded by the
  // next one, so retransmitting it would only deliver a stale position late.
  session.input = pc.createDataChannel(DC_INPUT, DC_UNRELIABLE);
  session.input.binaryType = 'arraybuffer';
  session.input.onmessage = (event) => onInputMessage(peerId, event);

  session.cursor = pc.createDataChannel(DC_CURSOR, DC_UNRELIABLE);
  session.cursor.binaryType = 'arraybuffer';
  session.cursor.onopen = () => updateCursorTracking();
  session.cursor.onclose = () => updateCursorTracking();

  try {
    const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
    const capabilities = RTCRtpSender.getCapabilities('video');
    if (transceiver && capabilities) {
      // Ordered by *measured* hardware support, not a hardcoded list.
      transceiver.setCodecPreferences(await preferredCodecOrder(capabilities.codecs));
    }
  } catch {
    // Codec preference is best-effort; negotiation still finds a common codec.
  }

  session.governor = new QualityGovernor(pc, sender, () => getCaptureSurface());
  session.governor.onSample((sample: QualitySample) => recordHostSample(peerId, sample));
  session.governor.start();

  pc.onicecandidate = (event) => {
    if (!event.candidate || !peers.has(peerId)) return;
    signal(peerId, {
      t: 'rtc-ice',
      candidate: event.candidate.candidate,
      sdpMid: event.candidate.sdpMid,
      sdpMLineIndex: event.candidate.sdpMLineIndex,
    });
  };
  pc.onconnectionstatechange = () => {
    // A replaced/stale connection must not act on the current one.
    if (peers.get(peerId)?.pc !== pc) return;
    if (pc.connectionState === 'connected') {
      // Video is flowing; main stops JPEG tiles for this peer. 'disconnected'
      // is deliberately ignored — it is usually a transient blip that returns
      // to 'connected' on its own, and tearing down would flap transports.
      window.agentmat.remote.rtcPeerState(peerId, true);
    } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      closeRtcPeer(peerId);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  signal(peerId, { t: 'rtc-offer', sdp: offer.sdp ?? '' });
}

function onInputMessage(peerId: string, event: MessageEvent<unknown>): void {
  if (typeof event.data !== 'string') return;
  let parsed: RemoteInputEvent;
  try {
    parsed = JSON.parse(event.data) as RemoteInputEvent;
  } catch {
    return;
  }
  // Main re-checks that the peer is authorized before injecting; the renderer
  // owns no authorization state.
  window.agentmat.remote.rtcInput(peerId, parsed);
}

// --- Cursor plane --------------------------------------------------------------

/**
 * Cursor sampling in main costs a timer, so it only runs while at least one
 * peer has an open cursor channel.
 */
function updateCursorTracking(): void {
  const wanted = [...peers.values()].some((s) => s.cursor?.readyState === 'open');
  if (wanted === cursorTracking) return;
  cursorTracking = wanted;
  window.agentmat.remote.setCursorTracking(wanted);
}

function broadcastCursor(point: { x: number; y: number; visible: boolean }): void {
  const baked = isCursorBaked();
  const frame = encodeCursorState({
    x: point.x,
    y: point.y,
    visible: point.visible,
    baked,
    // Electron exposes no cursor-shape API; a native provider will fill this in.
    shape: 'default',
  });
  for (const session of peers.values()) {
    const channel = session.cursor;
    if (channel?.readyState !== 'open') continue;
    // Never queue cursor updates: a backlog would deliver stale positions.
    if (channel.bufferedAmount > 0) continue;
    try {
      // encodeCursorState returns a tightly-packed 7-byte array, so its backing
      // buffer is exactly the frame.
      channel.send(frame.buffer as ArrayBuffer);
    } catch {
      // Channel closing mid-send; the next sample skips it.
    }
  }
}
