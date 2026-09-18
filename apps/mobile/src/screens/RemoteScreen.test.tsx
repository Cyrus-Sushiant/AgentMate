import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fakeClient } from '../remote/__fixtures__/fakeClient';
import { RemoteTransportMode } from '../remote/transport';
import type { StreamStats, useRemoteClient } from '../remote/useRemoteClient';
import { RemoteScreen } from './RemoteScreen';

type RemoteClient = ReturnType<typeof useRemoteClient>;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function videoStats(overrides: Partial<StreamStats> = {}): StreamStats {
  return {
    transport: RemoteTransportMode.WEBRTC_VIDEO,
    phase: 'connected',
    connectionState: 'connected',
    iceConnectionState: 'connected',
    codec: 'H264',
    width: 1920,
    height: 1080,
    fps: 60,
    kbps: 820,
    totalBytes: 5 * 1024 * 1024,
    rttMs: 24,
    packetsLost: 3,
    framesDropped: 2,
    jitterMs: 12,
    ...overrides,
  };
}

async function renderRemote(client: RemoteClient) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RemoteScreen client={client} />
    </SafeAreaProvider>,
  );
}

/** The header and its buttons live behind the ⋯ toggle. */
async function openMenu() {
  await fireEvent.press(screen.getByText('⋯'));
}

function connectedClient(overrides: Partial<RemoteClient> = {}): RemoteClient {
  return fakeClient({
    status: 'connected',
    remoteDeviceName: 'STUDIO-PC',
    remoteScreen: { width: 1920, height: 1080 },
    phase: 'connected',
    ...overrides,
  });
}

describe('RemoteScreen', () => {
  describe('the waiting overlay', () => {
    it('says Connecting… before the host has accepted', async () => {
      await renderRemote(fakeClient({ status: 'connecting' }));
      expect(screen.getByText('Connecting…')).toBeTruthy();
    });

    it('names the negotiation step while the first frame is still missing', async () => {
      // A blank screen with no explanation is exactly what the phase split was
      // added to avoid, so the label has to name the step, not just "wait".
      await renderRemote(connectedClient({ phase: 'answered' }));
      expect(screen.getByText('Starting video: answered, awaiting track')).toBeTruthy();
    });

    it('disappears once tiles are bridging the gap', async () => {
      const client = connectedClient({
        phase: 'answered',
        tiles: new Map([['0,0', { x: 0, y: 0, w: 64, h: 48, uri: 'data:image/jpeg;base64,AA' }]]),
      });
      await renderRemote(client);
      expect(screen.queryByText(/^Starting video/)).toBeNull();
    });

    it('disappears on the fallback transport, which has nothing left to wait for', async () => {
      await renderRemote(
        connectedClient({ transport: RemoteTransportMode.JPEG_TILE_FALLBACK, phase: 'failed' }),
      );
      expect(screen.queryByText(/^Starting video/)).toBeNull();
    });
  });

  describe('the overlay header', () => {
    it('stays hidden until the ⋯ button is tapped', async () => {
      // The host's display owns the whole screen; chrome is opt-in.
      await renderRemote(connectedClient());
      expect(screen.queryByText('Disconnect')).toBeNull();

      await openMenu();
      expect(screen.getByText('STUDIO-PC')).toBeTruthy();
      expect(screen.getByText('1920×1080')).toBeTruthy();
      expect(screen.getByText('Disconnect')).toBeTruthy();

      await openMenu();
      expect(screen.queryByText('Disconnect')).toBeNull();
    });

    it('falls back to a generic name before the host has introduced itself', async () => {
      await renderRemote(fakeClient({ status: 'connecting' }));
      await openMenu();
      expect(screen.getByText('Remote device')).toBeTruthy();
    });

    it('marks the resolution as compat while on the tile fallback', async () => {
      await renderRemote(
        connectedClient({ transport: RemoteTransportMode.JPEG_TILE_FALLBACK, phase: 'failed' }),
      );
      await openMenu();
      expect(screen.getByText('1920×1080 · compat')).toBeTruthy();
    });

    it('ends the session with the reason the user chose it', async () => {
      const client = connectedClient();
      await renderRemote(client);
      await openMenu();
      await fireEvent.press(screen.getByText('Disconnect'));
      expect(jest.mocked(client.disconnect)).toHaveBeenCalledWith('user disconnected');
    });

    it('pushes the phone clipboard to the host', async () => {
      const client = connectedClient();
      await renderRemote(client);
      await openMenu();
      await fireEvent.press(screen.getByText('Clipboard'));
      expect(jest.mocked(client.sendClipboardToHost)).toHaveBeenCalled();
    });

    it('will not push the clipboard before the session is up', async () => {
      const client = fakeClient({ status: 'connecting' });
      await renderRemote(client);
      await openMenu();
      await fireEvent.press(screen.getByText('Clipboard'));
      expect(jest.mocked(client.sendClipboardToHost)).not.toHaveBeenCalled();
    });
  });

  describe('the stats overlay', () => {
    it('reports the live WebRTC numbers behind the Stats toggle', async () => {
      await renderRemote(connectedClient({ stats: videoStats() }));
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));

      expect(screen.getByText('WEBRTC_VIDEO · H264')).toBeTruthy();
      expect(screen.getByText('phase: video flowing')).toBeTruthy();
      expect(screen.getByText('pc: connected · ice: connected')).toBeTruthy();
      expect(screen.getByText('1920×1080 @ 60 fps')).toBeTruthy();
      expect(screen.getByText('820 kbps')).toBeTruthy();
      expect(screen.getByText('5.0 MB received')).toBeTruthy();
      expect(screen.getByText('ping 24 ms')).toBeTruthy();
      expect(screen.getByText('lost 3 · dropped 2 · jitter 12 ms')).toBeTruthy();
    });

    it('switches to megabits once the rate passes 1 Mbps', async () => {
      await renderRemote(connectedClient({ stats: videoStats({ kbps: 4200 }) }));
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));
      expect(screen.getByText('4.2 Mbps')).toBeTruthy();
    });

    it('hides again on a second tap', async () => {
      await renderRemote(connectedClient({ stats: videoStats() }));
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));
      await fireEvent.press(screen.getByText('Stats'));
      expect(screen.queryByText('WEBRTC_VIDEO · H264')).toBeNull();
    });

    it('leaves out the WebRTC-only rows on the tile fallback', async () => {
      await renderRemote(
        connectedClient({
          transport: RemoteTransportMode.JPEG_TILE_FALLBACK,
          phase: 'failed',
          stats: videoStats({
            transport: RemoteTransportMode.JPEG_TILE_FALLBACK,
            phase: 'failed',
            codec: 'JPEG',
            connectionState: null,
            iceConnectionState: null,
            width: 0,
            height: 0,
            rttMs: null,
            jitterMs: null,
          }),
        }),
      );
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));

      expect(screen.getByText('JPEG_TILE_FALLBACK')).toBeTruthy();
      expect(screen.getByText('phase: failed')).toBeTruthy();
      expect(screen.queryByText(/^pc:/)).toBeNull();
      expect(screen.queryByText(/^ping/)).toBeNull();
      expect(screen.queryByText(/^lost/)).toBeNull();
    });

    it('offers a manual retry only after a fallback', async () => {
      const client = connectedClient({ stats: videoStats() });
      await renderRemote(client);
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));
      expect(screen.queryByText('Retry video')).toBeNull();
    });

    it('retries video on demand from the fallback overlay', async () => {
      const client = connectedClient({
        transport: RemoteTransportMode.JPEG_TILE_FALLBACK,
        phase: 'failed',
        stats: videoStats({ transport: RemoteTransportMode.JPEG_TILE_FALLBACK }),
      });
      await renderRemote(client);
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));
      await fireEvent.press(screen.getByText('Retry video'));
      expect(jest.mocked(client.retryVideo)).toHaveBeenCalled();
    });

    it('fills in placeholders for numbers the report has not produced yet', async () => {
      // getStats needs a second or two before it names a codec or an RTT, and a
      // blank line there reads as a broken overlay.
      await renderRemote(
        connectedClient({
          stats: videoStats({
            codec: null,
            iceConnectionState: null,
            rttMs: null,
            jitterMs: null,
          }),
        }),
      );
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));

      expect(screen.getByText('WEBRTC_VIDEO · …')).toBeTruthy();
      expect(screen.getByText('pc: connected · ice: n/a')).toBeTruthy();
      expect(screen.getByText('lost 3 · dropped 2')).toBeTruthy();
      expect(screen.queryByText(/^ping/)).toBeNull();
    });

    it('shows nothing when there is no sample yet', async () => {
      await renderRemote(connectedClient({ stats: null }));
      await openMenu();
      await fireEvent.press(screen.getByText('Stats'));
      expect(screen.queryByText(/^phase:/)).toBeNull();
    });
  });

  it('keeps the key toolbar available during the session', async () => {
    const client = connectedClient();
    await renderRemote(client);
    await fireEvent.press(screen.getByText('Esc'));
    expect(jest.mocked(client.sendInput)).toHaveBeenCalledWith({
      k: 'key',
      code: 'Escape',
      down: true,
    });
  });
});
