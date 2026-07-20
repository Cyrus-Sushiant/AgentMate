import type * as WebRtcModule from 'react-native-webrtc';

/**
 * react-native-webrtc loaded defensively: it is a native module, so it only
 * exists in APKs built after it was added (and never in Expo Go). When it is
 * missing the app must still run — the client simply skips WebRTC negotiation
 * and streams JPEG tiles instead of crashing at import time with
 * "WebRTC native module not found".
 */
function loadWebRtc(): typeof WebRtcModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-webrtc') as typeof WebRtcModule;
  } catch {
    return null;
  }
}

export const WebRtc = loadWebRtc();
