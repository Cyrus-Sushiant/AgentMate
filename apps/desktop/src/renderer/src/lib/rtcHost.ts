import type { RemoteRtcMessage } from '@shared/remoteProtocol';
import { getCaptureStream } from './screenCapture';

/**
 * Host-side WebRTC streaming: one RTCPeerConnection per connected controller,
 * all sharing the single screen-capture MediaStream.
 *
 * This is the primary transport for mobile controllers — hardware H.264 with
 * WebRTC's built-in congestion control beats the JPEG-tile path on every axis
 * (startup latency, bandwidth, weak networks). Signaling travels over the
 * peer's existing WebSocket, relayed through the main process tagged with the
 * peer id. Controllers that never send `rtc-request` (e.g. the desktop
 * controller) keep receiving JPEG tiles as before.
 */

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
/** How long to wait for capture to come up before telling the peer to fall back. */
const CAPTURE_WAIT_MS = 8000;
const CAPTURE_POLL_MS = 250;
/**
 * Upper bound only — WebRTC's congestion control ramps far below this on weak
 * links. With the capture downscaled to phone-appropriate resolution (see
 * screenCapture.ts), 3.5 Mbps is plenty for crisp screen content; a higher cap
 * just invites queuing latency and packet loss on marginal WiFi.
 */
const MAX_VIDEO_BITRATE = 3_500_000;

/**
 * Put hardware-friendly codecs first in the SDP offer. Chromium tends to lead
 * with VP8 (software) otherwise; H.264 gets hardware encode on the host GPU
 * and hardware decode on virtually every phone, which cuts both latency and
 * the quality pulsing a starved software encoder produces. AV1/VP9 follow as
 * better-compression options where both ends support them in hardware.
 */
type VideoCodecCapability = RTCRtpCapabilities['codecs'][number];

function preferredCodecOrder(codecs: VideoCodecCapability[]): VideoCodecCapability[] {
  const rank = (c: VideoCodecCapability): number => {
    const mime = c.mimeType.toLowerCase();
    if (mime === 'video/h264') return 0;
    if (mime === 'video/av1') return 1;
    if (mime === 'video/vp9') return 2;
    if (mime === 'video/vp8') return 3;
    return 4;
  };
  return [...codecs].sort((a, b) => rank(a) - rank(b));
}

const peers = new Map<string, RTCPeerConnection>();
let initialized = false;

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
}

export function closeRtcPeer(peerId: string): void {
  const pc = peers.get(peerId);
  if (!pc) return;
  peers.delete(peerId);
  try {
    pc.close();
  } catch {
    // already closed
  }
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
      const pc = peers.get(peerId);
      if (pc) await pc.setRemoteDescription({ type: 'answer', sdp: message.sdp });
      break;
    }
    case 'rtc-ice': {
      const pc = peers.get(peerId);
      if (pc && message.candidate) {
        await pc.addIceCandidate({
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
  peers.set(peerId, pc);

  // Screen content: favor legible text over silky motion when bandwidth dips.
  track.contentHint = 'detail';
  const sender = pc.addTrack(track, stream);
  try {
    const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
    const capabilities = RTCRtpSender.getCapabilities('video');
    if (transceiver && capabilities) {
      transceiver.setCodecPreferences(preferredCodecOrder(capabilities.codecs));
    }
  } catch {
    // Codec preference is best-effort; negotiation still finds a common codec.
  }
  try {
    const params = sender.getParameters();
    // 'balanced' lets the encoder shed both resolution and framerate under
    // congestion. 'maintain-resolution' was tried and collapses to a ~1 fps
    // slideshow on weak WiFi — for remote control, staying fluid wins.
    params.degradationPreference = 'balanced';
    for (const encoding of params.encodings) {
      encoding.maxBitrate = MAX_VIDEO_BITRATE;
      encoding.priority = 'high';
      encoding.networkPriority = 'high';
    }
    await sender.setParameters(params);
  } catch {
    // Bitrate capping is a nice-to-have; defaults still adapt.
  }

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
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      closeRtcPeer(peerId);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  signal(peerId, { t: 'rtc-offer', sdp: offer.sdp ?? '' });
}
