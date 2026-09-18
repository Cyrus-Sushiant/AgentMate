import { jest } from '@jest/globals';
import type { SavedDevice } from '../savedDevices';
import { RemoteTransportMode } from '../transport';
import type { useRemoteClient } from '../useRemoteClient';

type RemoteClient = ReturnType<typeof useRemoteClient>;

/**
 * A stand-in for the remote client so screen tests can put the UI in any state
 * (connected, on the fallback transport, mid-error) without driving a socket
 * handshake first. useRemoteClient has its own tests.
 */
export function fakeClient(overrides: Partial<RemoteClient> = {}): RemoteClient {
  return {
    status: 'idle',
    remoteDeviceName: null,
    remoteScreen: null,
    error: null,
    log: [],
    tiles: new Map(),
    transport: RemoteTransportMode.WEBRTC_VIDEO,
    phase: 'idle',
    remoteStream: null,
    savedDevices: [],
    stats: null,
    connect: jest.fn<RemoteClient['connect']>(),
    connectToSaved: jest.fn<RemoteClient['connectToSaved']>(),
    renameDevice: jest.fn<RemoteClient['renameDevice']>(async () => undefined),
    removeDevice: jest.fn<RemoteClient['removeDevice']>(async () => undefined),
    disconnect: jest.fn<RemoteClient['disconnect']>(),
    sendInput: jest.fn<RemoteClient['sendInput']>(),
    sendClipboardToHost: jest.fn<RemoteClient['sendClipboardToHost']>(async () => undefined),
    retryVideo: jest.fn<RemoteClient['retryVideo']>(),
    ...overrides,
  };
}

export function fakeSavedDevice(overrides: Partial<SavedDevice> = {}): SavedDevice {
  return {
    id: 'dev-1',
    label: 'Studio PC',
    hostName: 'STUDIO-PC',
    ip: '192.168.1.44',
    port: 51000,
    token: 'durable-token',
    addedAt: Date.now(),
    lastConnectedAt: Date.now(),
    ...overrides,
  };
}
