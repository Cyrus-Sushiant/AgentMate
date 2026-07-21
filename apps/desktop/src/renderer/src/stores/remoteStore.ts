import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  RemoteFileProgress,
  RemoteLogEvent,
  RemoteState,
} from '@shared/apiTypes';
import { closeAllRtcPeers, initRtcHost } from '@/lib/rtcHost';
import {
  initRtcController,
  requestRemoteVideo,
  teardownRemoteVideo,
} from '@/lib/rtcController';
import {
  forceFullFrame,
  setTilesEnabled,
  startScreenCapture,
  stopScreenCapture,
} from '@/lib/screenCapture';

const MAX_LOGS = 100;

interface RemoteStore {
  state: RemoteState | null;
  logs: RemoteLogEvent[];
  transfers: RemoteFileProgress[];
  initialized: boolean;
  refresh: () => Promise<void>;
}

export const useRemoteStore = create<RemoteStore>((set) => ({
  state: null,
  logs: [],
  transfers: [],
  initialized: false,
  refresh: async () => {
    const state = await window.agentmat.remote.getState();
    set({ state });
  },
}));

/**
 * Wires the renderer to the main-process remote manager exactly once. Kept
 * outside any component so screen capture keeps running while hosting even when
 * the operator leaves the Remote page.
 */
export function initRemote(): void {
  if (useRemoteStore.getState().initialized) return;
  useRemoteStore.setState({ initialized: true });

  const api = window.agentmat.remote;

  api.onState((state) => {
    const previous = useRemoteStore.getState().state?.connection.status;
    useRemoteStore.setState({ state });
    // Controller role: ask for the video track as soon as the control channel
    // is up, and drop the peer connection when it goes away.
    const status = state.connection.status;
    if (status === 'connected' && previous !== 'connected') requestRemoteVideo();
    else if (status !== 'connected' && previous === 'connected') teardownRemoteVideo();
  });

  api.onLog((event) => {
    useRemoteStore.setState((s) => ({ logs: [event, ...s.logs].slice(0, MAX_LOGS) }));
  });

  api.onFileProgress((progress) => {
    useRemoteStore.setState((s) => {
      const rest = s.transfers.filter((t) => t.transferId !== progress.transferId);
      return { transfers: [progress, ...rest].slice(0, 20) };
    });
    if (progress.done && !progress.error && progress.direction === 'incoming') {
      toast.success(`Received "${progress.name}"`);
    }
    if (progress.error) toast.error(`Transfer failed: ${progress.error}`);
  });

  // Host side: main tells us when a controller wants (or no longer wants) our screen.
  api.onCaptureStart(() => {
    void startScreenCapture().catch((err: unknown) => {
      toast.error(`Screen capture failed: ${(err as Error).message}`);
    });
  });
  api.onCaptureStop(() => {
    closeAllRtcPeers();
    void stopScreenCapture();
  });
  api.onCaptureRefresh(() => forceFullFrame());
  api.onTileDemand((demand) => setTilesEnabled(demand));

  // Host side: WebRTC signaling relay for controllers streaming video.
  initRtcHost();
  // Controller side: receives the host's video track (desktop-to-desktop).
  initRtcController();

  void useRemoteStore.getState().refresh();
}
