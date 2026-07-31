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

/**
 * The main window and the standalone remote-session window (`#/remote-session`,
 * see `sessionWindow.ts` in main) each run their own copy of this renderer
 * bundle, so `initRemote()` runs in both. Controller-role video negotiation
 * must only ever happen in one of them — both reacting to the same broadcast
 * `onState`/`onClientRtcSignal` events would open two independent WebRTC
 * negotiations over the single main-process-owned control socket. The session
 * window is the only place `RemoteScreen` mounts, so it's the only place that
 * should drive the controller side.
 */
function isRemoteSessionWindow(): boolean {
  return window.location.hash.startsWith('#/remote-session');
}

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
    // is up, and drop the peer connection when it goes away. Only the session
    // window does this (see isRemoteSessionWindow's doc comment above).
    if (!isRemoteSessionWindow()) return;
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

  // Host side: WebRTC signaling relay for controllers streaming video. Must
  // keep running in every window (hosting survives navigating off the page).
  initRtcHost();
  // Controller side: receives the host's video track (desktop-to-desktop).
  // Session-window-only — see isRemoteSessionWindow's doc comment above.
  if (isRemoteSessionWindow()) initRtcController();

  void useRemoteStore.getState().refresh();
}
