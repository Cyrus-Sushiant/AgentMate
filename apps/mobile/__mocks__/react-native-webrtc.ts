import { createElement } from 'react';

/**
 * react-native-webrtc without the native module. Jest picks this up automatically for the
 * package, including the `require` in src/remote/webrtc.ts.
 *
 * `MockPeerConnection.last()` reaches the connection the code under test created, so a test can
 * play the host's side: fire a track, an ICE candidate or a state change.
 */

type Listener = (event: unknown) => void;

export class RTCPeerConnection {
  static instances: RTCPeerConnection[] = [];

  readonly configuration: unknown;
  readonly listeners = new Map<string, Listener[]>();
  localDescription: unknown = null;
  remoteDescription: unknown = null;
  addedCandidates: unknown[] = [];
  connectionState = 'new';
  signalingState = 'stable';
  closed = false;

  ontrack: Listener | null = null;
  onicecandidate: Listener | null = null;
  onconnectionstatechange: Listener | null = null;
  oniceconnectionstatechange: Listener | null = null;

  constructor(configuration?: unknown) {
    this.configuration = configuration;
    RTCPeerConnection.instances.push(this);
  }

  static last(): RTCPeerConnection {
    const peer = RTCPeerConnection.instances.at(-1);
    if (!peer) throw new Error('no peer connection was created');
    return peer;
  }

  static reset(): void {
    RTCPeerConnection.instances = [];
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((one) => one !== listener),
    );
  }

  /** Fires an event on both the listener list and the matching `on<type>` property. */
  mockEmit(type: string, payload: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(payload);
    const direct = (this as unknown as Record<string, Listener | null>)[`on${type}`];
    if (typeof direct === 'function') direct(payload);
  }

  async setRemoteDescription(description: unknown): Promise<void> {
    this.remoteDescription = description;
    this.signalingState = 'have-remote-offer';
  }

  async createAnswer(): Promise<{ type: string; sdp: string }> {
    return { type: 'answer', sdp: 'v=0\r\nfake-answer\r\n' };
  }

  async createOffer(): Promise<{ type: string; sdp: string }> {
    return { type: 'offer', sdp: 'v=0\r\nfake-offer\r\n' };
  }

  async setLocalDescription(description: unknown): Promise<void> {
    this.localDescription = description;
  }

  async addIceCandidate(candidate: unknown): Promise<void> {
    if (!this.remoteDescription) {
      throw new Error('cannot add ICE candidate before the remote description is set');
    }
    this.addedCandidates.push(candidate);
  }

  addTransceiver(): { receiver: { track: null } } {
    return { receiver: { track: null } };
  }

  async getStats(): Promise<Map<string, unknown>> {
    return new Map();
  }

  close(): void {
    this.closed = true;
    this.connectionState = 'closed';
  }
}

export class RTCSessionDescription {
  constructor(readonly init: { type?: string; sdp?: string } = {}) {}
  get type(): string | undefined {
    return this.init.type;
  }
  get sdp(): string | undefined {
    return this.init.sdp;
  }
}

export class RTCIceCandidate {
  constructor(readonly init: Record<string, unknown> = {}) {}
}

export class MediaStream {
  readonly tracks: unknown[];
  readonly id = 'mock-stream';

  constructor(tracks: unknown[] = []) {
    this.tracks = tracks;
  }

  getTracks(): unknown[] {
    return this.tracks;
  }

  getVideoTracks(): unknown[] {
    return this.tracks;
  }

  toURL(): string {
    return 'mock://stream';
  }
}

export function RTCView(props: Record<string, unknown>): ReturnType<typeof createElement> {
  return createElement('RTCView', { testID: 'rtc-view', ...props });
}

export function registerGlobals(): void {
  return undefined;
}

export const mediaDevices = {
  getUserMedia: async () => new MediaStream(),
  getDisplayMedia: async () => new MediaStream(),
};

export default {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  RTCView,
  registerGlobals,
  mediaDevices,
};
