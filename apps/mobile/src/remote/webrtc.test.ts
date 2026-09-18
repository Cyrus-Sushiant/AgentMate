import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { WebRtc } from './webrtc';

/**
 * react-native-webrtc is a native module: it is absent from Expo Go and from any
 * APK built before it was added. The defensive require exists so that case
 * degrades to JPEG tiles instead of crashing the app at import time, which is
 * only provable by loading the module both ways.
 */
describe('WebRtc', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('exposes the module when the native package resolves', () => {
    expect(WebRtc).not.toBeNull();
    expect(typeof WebRtc?.RTCPeerConnection).toBe('function');
    expect(typeof WebRtc?.RTCSessionDescription).toBe('function');
  });

  it('re-reads the native package on a fresh module load', () => {
    // The require lives at module scope, so a reload has to redo it rather than
    // hand back whatever the first load happened to resolve.
    jest.isolateModules(() => {
      // biome-ignore lint/style/noCommonJs: jest.isolateModules runs synchronously, so the reload has to be a require
      const reloaded = require('./webrtc') as { WebRtc: unknown };
      expect(reloaded.WebRtc).not.toBeNull();
    });
  });

  it('is null when requiring the native package throws', () => {
    // What a build without the native module actually does at require time: the
    // app has to keep running on the JPEG tile fallback instead of crashing.
    jest.isolateModules(() => {
      jest.doMock('react-native-webrtc', () => {
        throw new Error('native module missing');
      });
      // biome-ignore lint/style/noCommonJs: same reason as above
      const reloaded = require('./webrtc') as { WebRtc: unknown };
      expect(reloaded.WebRtc).toBeNull();
    });
  });
});
