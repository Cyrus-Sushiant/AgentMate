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

const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
/** How long to wait for capture to come up before telling the peer to fall back. */
const CAPTURE_WAIT_MS = 8000;
const CAPTURE_POLL_MS = 250;
const MAX_VIDEO_BITRATE = 4_000_000;

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
    const params = sender.getParameters();
    params.degradationPreference = 'balanced';
    params.encodings = [{ maxBitrate: MAX_VIDEO_BITRATE }];
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
