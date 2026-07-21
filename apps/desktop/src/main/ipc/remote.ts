import { ipcMain } from 'electron';
import type { RemoteState } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  decodePairingCode,
  type RemoteInputEvent,
  type RemoteRtcMessage,
} from '../../shared/remoteProtocol';
import { listNetworkInterfaces } from '../remote/networkInterfaces';
import { remoteManager } from '../remote/manager';

export function registerRemoteHandlers(): void {
  ipcMain.handle(IPC.remote.getState, (): RemoteState => remoteManager.getState());

  ipcMain.handle(IPC.remote.listInterfaces, () => listNetworkInterfaces());

  ipcMain.handle(IPC.remote.startHost, (_e, input: { ip: string; port: number }) =>
    remoteManager.startHost(input.ip, input.port),
  );

  ipcMain.handle(IPC.remote.stopHost, () => {
    remoteManager.stopHost();
  });

  ipcMain.handle(IPC.remote.generatePairingCode, () => remoteManager.generatePairingCode());

  ipcMain.handle(IPC.remote.connect, (_e, code: string): { ok: boolean; error?: string } => {
    const payload = decodePairingCode(code);
    if (!payload) return { ok: false, error: 'That pairing code is not valid.' };
    remoteManager.connect(payload);
    return { ok: true };
  });

  ipcMain.handle(IPC.remote.disconnect, () => {
    remoteManager.disconnect();
  });

  ipcMain.handle(IPC.remote.sendClipboard, () => {
    remoteManager.sendClipboard();
  });

  ipcMain.handle(IPC.remote.sendFile, () => remoteManager.sendFile());

  // High-frequency, fire-and-forget channels use send/on rather than invoke so
  // they don't pay for a round-trip acknowledgement per event/tile.
  ipcMain.on(IPC.remote.sendInput, (_e, event: RemoteInputEvent) => {
    remoteManager.sendInput(event);
  });

  ipcMain.on(IPC.remote.setScreenInfo, (_e, size: { width: number; height: number }) => {
    remoteManager.setScreenInfo(size.width, size.height);
  });

  ipcMain.on(IPC.remote.hostTile, (_e, tile: ArrayBuffer | Uint8Array) => {
    const bytes = tile instanceof Uint8Array ? tile : new Uint8Array(tile);
    remoteManager.hostTile(bytes);
  });

  ipcMain.on(
    IPC.remote.rtcSignal,
    (_e, payload: { peerId: string; message: RemoteRtcMessage }) => {
      remoteManager.rtcSignalToPeer(payload.peerId, payload.message);
    },
  );

  ipcMain.on(
    IPC.remote.rtcPeerState,
    (_e, payload: { peerId: string; connected: boolean }) => {
      remoteManager.setRtcPeerConnected(payload.peerId, payload.connected);
    },
  );

  ipcMain.on(IPC.remote.clientRtcSignal, (_e, message: RemoteRtcMessage) => {
    remoteManager.sendClientRtcSignal(message);
  });

  ipcMain.on(
    IPC.remote.rtcInput,
    (_e, payload: { peerId: string; event: RemoteInputEvent }) => {
      remoteManager.applyRtcInput(payload.peerId, payload.event);
    },
  );

  ipcMain.on(IPC.remote.setCursorTracking, (_e, enabled: boolean) => {
    remoteManager.setCursorTracking(enabled);
  });

  // Benchmarking: the renderer can sample its own CPU/memory, but the main
  // process owns the sockets, so a full picture needs both halves.
  ipcMain.handle(IPC.remote.benchSample, () => ({
    cpu: process.getCPUUsage().percentCPUUsage,
    memory: process.memoryUsage().rss,
    at: Date.now(),
  }));
}
