/**
 * Explicit transport selection for the mobile controller.
 *
 * Previously the transport was implied by a loose `'negotiating' | 'webrtc' |
 * 'tiles'` union, which conflated two very different states: "still setting up
 * video" and "gave up on video". A stalled negotiation therefore looked exactly
 * like a healthy tile session, which is how mobile ended up silently rendering
 * JPEG tiles with nothing reporting a problem.
 *
 * Transport and negotiation phase are now separate: transport says which
 * pipeline is rendering, phase says how far the WebRTC handshake got.
 */

export enum RemoteTransportMode {
  /** Hardware-decoded video track. The default and the intended steady state. */
  WEBRTC_VIDEO = 'WEBRTC_VIDEO',
  /** Emergency fallback: JPEG tiles over the control socket. */
  JPEG_TILE_FALLBACK = 'JPEG_TILE_FALLBACK',
}

export const DEFAULT_TRANSPORT_MODE = RemoteTransportMode.WEBRTC_VIDEO;

/**
 * How far WebRTC negotiation progressed. Reported in the debug overlay so a
 * failure names the step it died on instead of silently degrading.
 */
export type NegotiationPhase =
  | 'idle'
  | 'requesting'
  | 'offer-received'
  | 'answered'
  | 'connected'
  | 'failed'
  | 'unsupported';

export const PHASE_LABELS: Record<NegotiationPhase, string> = {
  idle: 'idle',
  requesting: 'requesting video…',
  'offer-received': 'offer received',
  answered: 'answered, awaiting track',
  connected: 'video flowing',
  failed: 'failed',
  unsupported: 'no WebRTC module',
};
