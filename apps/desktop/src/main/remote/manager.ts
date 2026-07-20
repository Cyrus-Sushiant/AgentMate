import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, type WriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, BrowserWindow, clipboard, dialog } from 'electron';
import QRCode from 'qrcode';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  RemoteConnectionInfo,
  RemoteFileDirection,
  RemoteFileProgress,
  RemoteLogLevel,
  RemotePairingInfo,
  RemotePeerInfo,
  RemoteState,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  binaryKind,
  BIN_FILE_CHUNK,
  BIN_SCREEN_TILE,
  decodeFileChunk,
  encodeFileChunk,
  encodePairingCode,
  REMOTE_PROTOCOL_VERSION,
  transferKeyFromId,
  type RemoteControlMessage,
  type RemoteInputEvent,
  type RemoteRtcMessage,
} from '../../shared/remoteProtocol';
import { InputInjector } from './inputInjector';
import { listNetworkInterfaces } from './networkInterfaces';
import { TokenStore } from './tokens';

const FILE_CHUNK_BYTES = 64 * 1024;
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;
/** Sockets are considered drained (safe to resend a full frame) below this. */
const TILE_HEAL_LOW_WATER = 256 * 1024;
/** Minimum spacing between drop-healing full refreshes. */
const TILE_HEAL_MIN_INTERVAL_MS = 2000;

interface HostPeer {
  id: string;
  ws: WebSocket;
  deviceName: string;
  address: string;
  connectedAt: number;
  authed: boolean;
  /**
   * False while the peer receives video over a *connected* WebRTC session, so
   * the two transports don't compete for bandwidth. Deliberately stays true
   * through WebRTC negotiation — the renderer flips it via setRtcPeerConnected
   * once video truly flows, which keeps the controller's screen painted with
   * tiles instead of going black while ICE completes.
   */
  wantsTiles: boolean;
}

interface IncomingTransfer {
  id: string;
  name: string;
  size: number;
  received: number;
  stream: WriteStream;
  savedPath: string;
  direction: RemoteFileDirection;
}

/**
 * Orchestrates the whole remote-control feature for one AgentMate instance.
 *
 * A single machine can simultaneously *host* (let others control it) and act as
 * a *controller* (drive another machine). Both roles ride WebSockets that live
 * here in the main process — the renderer never opens a socket, so the app's
 * strict Content-Security-Policy is untouched. The renderer only captures the
 * screen (host) / paints frames and reads input (controller) and exchanges
 * everything with this manager over IPC.
 */
class RemoteManager {
  private mainWindow: BrowserWindow | null = null;
  private readonly injector = new InputInjector();
  private readonly tokens = new TokenStore();

  private server: WebSocketServer | null = null;
  private hostIp: string | null = null;
  private hostPort = 7900;
  private readonly peers = new Map<string, HostPeer>();
  private hostScreen: { width: number; height: number } | null = null;
  private capturing = false;
  private tileDemand = true;
  /** A backpressured peer had tiles dropped; a healing refresh is owed. */
  private tileRefreshPending = false;
  private lastTileHealAt = 0;
  private pairing: RemotePairingInfo | null = null;

  private client: WebSocket | null = null;
  private connection: RemoteConnectionInfo = {
    status: 'idle',
    remoteDeviceName: null,
    remoteScreen: null,
  };

  private readonly transfers = new Map<number, IncomingTransfer>();

  init(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private deviceName(): string {
    return process.env.COMPUTERNAME || process.env.HOSTNAME || app.getName();
  }

  getState(): RemoteState {
    return {
      deviceName: this.deviceName(),
      hosting: this.server !== null,
      hostIp: this.hostIp,
      hostPort: this.hostPort,
      inputSupported: this.injector.isSupported(),
      pairing: this.pairing,
      peers: [...this.peers.values()]
        .filter((p) => p.authed)
        .map<RemotePeerInfo>((p) => ({
          id: p.id,
          deviceName: p.deviceName,
          address: p.address,
          connectedAt: p.connectedAt,
        })),
      connection: this.connection,
      interfaces: listNetworkInterfaces(),
    };
  }

  // --- Host role ---------------------------------------------------------------

  startHost(ip: string, port: number): RemoteState {
    this.stopHost();
    this.hostIp = ip;
    this.hostPort = port;
    const server = new WebSocketServer({ host: '0.0.0.0', port });
    server.on('connection', (ws, req) => {
      const address = req.socket.remoteAddress ?? 'unknown';
      const peer: HostPeer = {
        id: randomUUID(),
        ws,
        deviceName: address,
        address,
        connectedAt: Date.now(),
        authed: false,
        wantsTiles: true,
      };
      this.peers.set(peer.id, peer);
      ws.on('message', (data, isBinary) => this.onHostMessage(peer, data as Buffer, isBinary));
      ws.on('close', () => this.onPeerGone(peer));
      ws.on('error', () => this.onPeerGone(peer));
    });
    server.on('error', (err) => {
      this.log('error', `Host server error: ${err.message}`);
      this.stopHost();
    });
    this.server = server;
    this.injector.start();
    this.log('info', `Hosting on ${ip}:${port}`);
    this.emitState();
    return this.getState();
  }

  stopHost(): void {
    for (const peer of this.peers.values()) this.safeClose(peer.ws, 'host stopped');
    this.peers.clear();
    this.pairing = null;
    this.tokens.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.capturing) {
      this.capturing = false;
      this.send(IPC.remote.onCaptureStop);
    }
    this.tileDemand = true; // matches the renderer's default for the next session
    this.tileRefreshPending = false;
    // Only tear the injector down if we aren't also acting as a controller elsewhere.
    this.injector.stop();
    this.emitState();
  }

  async generatePairingCode(): Promise<RemotePairingInfo> {
    if (!this.server || !this.hostIp) {
      throw new Error('Start hosting before generating a pairing code.');
    }
    const { token, expiresAt } = this.tokens.issue();
    const code = encodePairingCode({
      ip: this.hostIp,
      port: this.hostPort,
      token,
      deviceName: this.deviceName(),
      v: REMOTE_PROTOCOL_VERSION,
    });
    const qrDataUrl = await QRCode.toDataURL(code, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
    this.pairing = { code, qrDataUrl, expiresAt };
    this.log('info', 'Generated a new one-time pairing code.');
    this.emitState();
    return this.pairing;
  }

  /** Host renderer reports the size of the surface it is capturing. */
  setScreenInfo(width: number, height: number): void {
    this.hostScreen = { width, height };
    for (const peer of this.peers.values()) {
      if (peer.authed) this.sendControl(peer.ws, { t: 'screen-info', width, height });
    }
  }

  /** Host renderer produced an encoded screen tile; fan it out to controllers. */
  hostTile(buffer: Uint8Array): void {
    let dropped = false;
    let consumers = 0;
    let maxBuffered = 0;
    for (const peer of this.peers.values()) {
      if (!peer.authed || !peer.wantsTiles) continue;
      consumers++;
      if (peer.ws.bufferedAmount < MAX_BUFFERED_BYTES) {
        peer.ws.send(buffer, { binary: true });
        if (peer.ws.bufferedAmount > maxBuffered) maxBuffered = peer.ws.bufferedAmount;
      } else {
        // Dropping beats queueing (a controller lagging seconds behind is
        // worse than a briefly stale region), but the peer now shows stale
        // pixels for every tile skipped here.
        dropped = true;
      }
    }
    if (dropped) {
      this.tileRefreshPending = true;
      return;
    }
    // Heal those stale regions as soon as every consumer's socket has drained,
    // instead of leaving them wrong until the renderer's slow safety refresh.
    if (this.tileRefreshPending && consumers > 0 && maxBuffered < TILE_HEAL_LOW_WATER) {
      const now = Date.now();
      if (now - this.lastTileHealAt >= TILE_HEAL_MIN_INTERVAL_MS) {
        this.tileRefreshPending = false;
        this.lastTileHealAt = now;
        this.send(IPC.remote.onCaptureRefresh);
      }
    }
  }

  /**
   * Renderer reports whether a peer's WebRTC video session is delivering.
   * Only then do tiles stop for that peer; when video drops, tiles resume and
   * a full refresh repaints everything the peer missed while on video.
   */
  setRtcPeerConnected(peerId: string, connected: boolean): void {
    const peer = this.peers.get(peerId);
    if (!peer?.authed) return;
    const wantsTiles = !connected;
    if (peer.wantsTiles === wantsTiles) return;
    peer.wantsTiles = wantsTiles;
    this.updateTileDemand();
    if (wantsTiles && this.capturing) this.send(IPC.remote.onCaptureRefresh);
  }

  /** Renderer produced a WebRTC signaling message for one specific peer. */
  rtcSignalToPeer(peerId: string, message: RemoteRtcMessage): void {
    const peer = this.peers.get(peerId);
    if (peer?.authed) this.sendControl(peer.ws, message);
  }

  private onHostMessage(peer: HostPeer, data: Buffer, isBinary: boolean): void {
    if (isBinary) {
      this.onBinary(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      return;
    }
    const msg = this.parseControl(data);
    if (!msg) return;
    switch (msg.t) {
      case 'hello':
        peer.deviceName = msg.deviceName || peer.address;
        break;
      case 'auth': {
        // A fresh pairing code pairs the device and mints a durable token for
        // it; a durable token from an earlier pairing reconnects directly.
        const paired = this.tokens.consume(msg.token);
        const known = paired ? null : this.tokens.validateDeviceToken(msg.token, peer.deviceName);
        if (paired || known) {
          peer.authed = true;
          const deviceToken = paired ? this.tokens.issueDeviceToken(peer.deviceName) : undefined;
          if (paired) this.pairing = null; // code was single-use
          if (this.capturing) {
            // Capture is already streaming deltas; this newcomer needs every
            // tile once or it stares at a mostly-black screen.
            this.send(IPC.remote.onCaptureRefresh);
          }
          this.startCapture();
          this.updateTileDemand();
          this.sendControl(peer.ws, {
            t: 'auth-ok',
            deviceName: this.deviceName(),
            screen: this.hostScreen ?? { width: 0, height: 0 },
            ...(deviceToken ? { deviceToken } : {}),
          });
          this.log(
            'success',
            paired
              ? `${peer.deviceName} paired and is now controlling this machine.`
              : `${peer.deviceName} reconnected and is now controlling this machine.`,
          );
          this.emitState();
        } else {
          this.sendControl(peer.ws, { t: 'auth-fail', reason: 'Invalid or expired code' });
          this.log('warning', `Rejected a pairing attempt from ${peer.address} (bad code).`);
          this.safeClose(peer.ws, 'auth failed');
        }
        break;
      }
      case 'control-start':
        if (peer.authed) this.startCapture();
        break;
      case 'control-stop':
        break;
      case 'input':
        if (peer.authed) this.injector.apply(msg.event);
        break;
      case 'clipboard':
        if (peer.authed) {
          clipboard.writeText(msg.text);
          this.log('info', 'Clipboard received from controller.');
        }
        break;
      case 'file-offer':
        if (peer.authed) this.beginReceive(peer.ws, msg.transferId, msg.name, msg.size);
        break;
      case 'file-complete':
        this.finishReceive(peer.ws, msg.transferId);
        break;
      case 'ping':
        this.sendControl(peer.ws, { t: 'pong' });
        break;
      case 'rtc-request':
      case 'rtc-cancel':
      case 'rtc-answer':
      case 'rtc-ice':
        // WebRTC signaling is handled by the renderer (it owns the capture
        // MediaStream); the main process only relays, tagged with the peer id.
        // Tiles keep flowing throughout negotiation — they stop only when the
        // renderer confirms video is delivering (setRtcPeerConnected).
        if (peer.authed) {
          this.send(IPC.remote.onRtcSignal, { peerId: peer.id, message: msg });
          if (msg.t === 'rtc-cancel' && !peer.wantsTiles) {
            // Falling back from live video: resume tiles and repaint what the
            // peer missed while it was on the video track.
            peer.wantsTiles = true;
            this.updateTileDemand();
            this.send(IPC.remote.onCaptureRefresh);
          }
        }
        break;
      case 'bye':
        this.safeClose(peer.ws, 'peer said bye');
        break;
    }
  }

  private startCapture(): void {
    if (this.capturing) return;
    this.capturing = true;
    this.send(IPC.remote.onCaptureStart);
  }

  /**
   * Tell the renderer whether anyone still consumes JPEG tiles. When every
   * connected controller streams WebRTC video, the per-frame diff + JPEG
   * encode loop is pure wasted CPU that competes with the video encoder.
   */
  private updateTileDemand(): void {
    const demand = [...this.peers.values()].some((p) => p.authed && p.wantsTiles);
    if (demand !== this.tileDemand) {
      this.tileDemand = demand;
      this.send(IPC.remote.onTileDemand, demand);
    }
  }

  private onPeerGone(peer: HostPeer): void {
    if (!this.peers.has(peer.id)) return;
    this.peers.delete(peer.id);
    if (peer.authed) {
      this.send(IPC.remote.onRtcPeerGone, peer.id);
      this.log('info', `${peer.deviceName} disconnected.`);
    }
    const stillControlled = [...this.peers.values()].some((p) => p.authed);
    if (!stillControlled && this.capturing) {
      this.capturing = false;
      this.send(IPC.remote.onCaptureStop);
    }
    this.updateTileDemand();
    this.emitState();
  }

  // --- Controller role ---------------------------------------------------------

  connect(payload: { ip: string; port: number; token: string; deviceName: string }): void {
    this.disconnect();
    this.connection = {
      status: 'connecting',
      remoteDeviceName: payload.deviceName,
      remoteScreen: null,
    };
    this.emitState();

    const ws = new WebSocket(`ws://${payload.ip}:${payload.port}`);
    ws.binaryType = 'nodebuffer';
    this.client = ws;

    ws.on('open', () => {
      this.sendControl(ws, {
        t: 'hello',
        role: 'controller',
        deviceName: this.deviceName(),
        protocolVersion: REMOTE_PROTOCOL_VERSION,
      });
      this.sendControl(ws, { t: 'auth', token: payload.token });
    });
    ws.on('message', (data, isBinary) => this.onClientMessage(data as Buffer, isBinary));
    ws.on('close', () => {
      if (this.client === ws) {
        this.client = null;
        if (this.connection.status !== 'error') {
          this.connection = { status: 'idle', remoteDeviceName: null, remoteScreen: null };
          this.log('info', 'Disconnected from remote host.');
          this.emitState();
        }
      }
    });
    ws.on('error', (err) => {
      if (this.client === ws) {
        this.connection = {
          status: 'error',
          remoteDeviceName: payload.deviceName,
          remoteScreen: null,
          error: err.message,
        };
        this.log('error', `Connection failed: ${err.message}`);
        this.emitState();
      }
    });
  }

  disconnect(): void {
    if (this.client) {
      this.safeClose(this.client, 'controller disconnected');
      this.client = null;
    }
    this.connection = { status: 'idle', remoteDeviceName: null, remoteScreen: null };
    this.emitState();
  }

  sendInput(event: RemoteInputEvent): void {
    if (this.client && this.connection.status === 'connected') {
      this.sendControl(this.client, { t: 'input', event });
    }
  }

  private onClientMessage(data: Buffer, isBinary: boolean): void {
    if (isBinary) {
      this.onBinary(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      return;
    }
    const msg = this.parseControl(data);
    if (!msg) return;
    switch (msg.t) {
      case 'auth-ok':
        this.connection = {
          status: 'connected',
          remoteDeviceName: msg.deviceName,
          remoteScreen: msg.screen.width ? msg.screen : null,
        };
        if (this.client) this.sendControl(this.client, { t: 'control-start' });
        if (msg.screen.width) this.send(IPC.remote.onScreenInfo, msg.screen);
        this.log('success', `Connected to ${msg.deviceName}.`);
        this.emitState();
        break;
      case 'auth-fail':
        this.connection = {
          status: 'error',
          remoteDeviceName: this.connection.remoteDeviceName,
          remoteScreen: null,
          error: msg.reason,
        };
        this.log('error', `Pairing rejected: ${msg.reason}`);
        this.emitState();
        break;
      case 'screen-info':
        this.connection = { ...this.connection, remoteScreen: { width: msg.width, height: msg.height } };
        this.send(IPC.remote.onScreenInfo, { width: msg.width, height: msg.height });
        this.emitState();
        break;
      case 'clipboard':
        clipboard.writeText(msg.text);
        this.log('info', 'Clipboard received from host.');
        break;
      case 'file-offer':
        if (this.client) this.beginReceive(this.client, msg.transferId, msg.name, msg.size);
        break;
      case 'file-complete':
        if (this.client) this.finishReceive(this.client, msg.transferId);
        break;
      case 'pong':
        break;
      case 'bye':
        this.disconnect();
        break;
    }
  }

  // --- Shared: clipboard, files, binary ---------------------------------------

  /** Send this machine's clipboard text to whichever peer(s) are connected. */
  sendClipboard(): void {
    const text = clipboard.readText();
    if (!text) return;
    if (this.client && this.connection.status === 'connected') {
      this.sendControl(this.client, { t: 'clipboard', text });
    }
    for (const peer of this.peers.values()) {
      if (peer.authed) this.sendControl(peer.ws, { t: 'clipboard', text });
    }
    this.log('info', 'Clipboard sent.');
  }

  /** Prompt for a file and stream it to the connected peer. */
  async sendFile(): Promise<void> {
    const target = this.pickTransferTarget();
    if (!target) {
      this.log('warning', 'No active connection to send a file to.');
      return;
    }
    const picked = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (picked.canceled || picked.filePaths.length === 0) return;
    const filePath = picked.filePaths[0];
    const info = await stat(filePath);
    const transferId = randomUUID();
    const name = basename(filePath);
    this.sendControl(target, { t: 'file-offer', transferId, name, size: info.size });
    this.log('info', `Sending "${name}" (${formatBytes(info.size)})…`);
    await this.streamFile(target, transferId, filePath, name, info.size);
  }

  private pickTransferTarget(): WebSocket | null {
    if (this.client && this.connection.status === 'connected') return this.client;
    for (const peer of this.peers.values()) if (peer.authed) return peer.ws;
    return null;
  }

  private async streamFile(
    ws: WebSocket,
    transferId: string,
    filePath: string,
    name: string,
    size: number,
  ): Promise<void> {
    const key = transferKeyFromId(transferId);
    const stream = createReadStream(filePath, { highWaterMark: FILE_CHUNK_BYTES });
    let seq = 0;
    let sent = 0;
    try {
      for await (const chunk of stream) {
        const bytes = chunk as Buffer;
        await this.sendBinary(ws, encodeFileChunk({ transferKey: key, seq: seq++, bytes }));
        sent += bytes.byteLength;
        this.emitFileProgress({
          transferId,
          name,
          direction: 'outgoing',
          transferred: sent,
          total: size,
          done: false,
        });
      }
      this.sendControl(ws, { t: 'file-complete', transferId });
      this.emitFileProgress({ transferId, name, direction: 'outgoing', transferred: sent, total: size, done: true });
      this.log('success', `Sent "${name}".`);
    } catch (err) {
      this.emitFileProgress({
        transferId,
        name,
        direction: 'outgoing',
        transferred: sent,
        total: size,
        done: true,
        error: (err as Error).message,
      });
      this.log('error', `Failed to send "${name}": ${(err as Error).message}`);
    }
  }

  private beginReceive(ws: WebSocket, transferId: string, name: string, size: number): void {
    const key = transferKeyFromId(transferId);
    const savedPath = uniquePath(join(app.getPath('downloads'), sanitizeName(name)));
    const stream = createWriteStream(savedPath);
    this.transfers.set(key, {
      id: transferId,
      name,
      size,
      received: 0,
      stream,
      savedPath,
      direction: 'incoming',
    });
    this.sendControl(ws, { t: 'file-accept', transferId });
    this.log('info', `Receiving "${name}" (${formatBytes(size)})…`);
    this.emitFileProgress({ transferId, name, direction: 'incoming', transferred: 0, total: size, done: false });
  }

  private finishReceive(ws: WebSocket, transferId: string): void {
    const key = transferKeyFromId(transferId);
    const transfer = this.transfers.get(key);
    if (!transfer) return;
    transfer.stream.end(() => {
      this.sendControl(ws, { t: 'file-done', transferId, savedPath: transfer.savedPath });
      this.emitFileProgress({
        transferId,
        name: transfer.name,
        direction: 'incoming',
        transferred: transfer.received,
        total: transfer.size,
        done: true,
        savedPath: transfer.savedPath,
      });
      this.log('success', `Saved "${transfer.name}" to ${transfer.savedPath}.`);
      this.transfers.delete(key);
    });
  }

  private onBinary(buf: Uint8Array): void {
    const kind = binaryKind(buf);
    if (kind === BIN_SCREEN_TILE) {
      // Controller side: hand the raw tile to the renderer to paint.
      this.send(IPC.remote.onFrameTile, buf);
    } else if (kind === BIN_FILE_CHUNK) {
      const chunk = decodeFileChunk(buf);
      const transfer = this.transfers.get(chunk.transferKey);
      if (!transfer) return;
      transfer.stream.write(Buffer.from(chunk.bytes));
      transfer.received += chunk.bytes.byteLength;
      this.emitFileProgress({
        transferId: transfer.id,
        name: transfer.name,
        direction: 'incoming',
        transferred: transfer.received,
        total: transfer.size,
        done: false,
      });
    }
  }

  // --- Plumbing ----------------------------------------------------------------

  private sendControl(ws: WebSocket, msg: RemoteControlMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private sendBinary(ws: WebSocket, data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('socket closed'));
        return;
      }
      ws.send(data, { binary: true }, (err) => (err ? reject(err) : resolve()));
    });
  }

  private parseControl(data: Buffer): RemoteControlMessage | null {
    try {
      return JSON.parse(data.toString('utf-8')) as RemoteControlMessage;
    } catch {
      return null;
    }
  }

  private safeClose(ws: WebSocket, reason: string): void {
    try {
      this.sendControl(ws, { t: 'bye', reason });
      ws.close();
    } catch {
      // already closed
    }
  }

  private send(channel: string, payload?: unknown): void {
    const win = this.mainWindow;
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(channel, payload);
  }

  private emitState(): void {
    this.send(IPC.remote.onState, this.getState());
  }

  private emitFileProgress(progress: RemoteFileProgress): void {
    this.send(IPC.remote.onFileProgress, progress);
  }

  private log(level: RemoteLogLevel, message: string): void {
    this.send(IPC.remote.onLog, { level, message, at: Date.now() });
  }

  shutdown(): void {
    this.disconnect();
    this.stopHost();
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_') || 'received-file';
}

function uniquePath(path: string): string {
  // Downloads-style de-duplication: "file.txt" -> "file (1).txt".
  const dot = basename(path).lastIndexOf('.');
  const dir = path.slice(0, path.length - basename(path).length);
  const stem = dot > 0 ? basename(path).slice(0, dot) : basename(path);
  const ext = dot > 0 ? basename(path).slice(dot) : '';
  let candidate = path;
  let n = 0;
  while (existsSync(candidate)) {
    n++;
    candidate = join(dir, `${stem} (${n})${ext}`);
  }
  return candidate;
}

export const remoteManager = new RemoteManager();
