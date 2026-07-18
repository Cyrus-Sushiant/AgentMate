/**
 * Wire protocol shared between two AgentMate peers over a single WebSocket, and
 * re-used by the renderer<->main IPC bridge that feeds it.
 *
 * Two planes travel over the same socket:
 *   - Control plane: JSON text frames (see {@link RemoteControlMessage}). Small,
 *     human-readable, order-preserving.
 *   - Data plane: binary frames (see the `encode*`/`decode*` helpers). Screen
 *     tiles and file chunks are large and frequent, so they skip JSON/base64
 *     overhead and travel as compact length-prefixed buffers.
 */

export const REMOTE_PROTOCOL_VERSION = 1;

export type RemoteRole = 'host' | 'controller';

export type RemoteMouseButton = 'left' | 'right' | 'middle';

/**
 * Input coming from the controller. Pointer coordinates are normalized to
 * `0..1` against the host's screen so they survive any resolution/scaling
 * difference between the two machines.
 */
export type RemoteInputEvent =
  | { k: 'move'; x: number; y: number }
  | { k: 'down'; x: number; y: number; button: RemoteMouseButton }
  | { k: 'up'; x: number; y: number; button: RemoteMouseButton }
  | { k: 'wheel'; x: number; y: number; dx: number; dy: number }
  /** A special (non-character) key such as Enter/Backspace/Arrow keys. `code` is a DOM `KeyboardEvent.code`. */
  | { k: 'key'; code: string; down: boolean }
  /** A run of literal text to type (produced from `keypress`/IME), injected as Unicode. */
  | { k: 'text'; text: string };

export type RemoteControlMessage =
  /** First frame each side sends after the socket opens. */
  | { t: 'hello'; role: RemoteRole; deviceName: string; protocolVersion: number }
  /** Controller proves it holds a valid one-time pairing token. */
  | { t: 'auth'; token: string }
  | { t: 'auth-ok'; deviceName: string; screen: { width: number; height: number } }
  | { t: 'auth-fail'; reason: string }
  /** Host announces its capture surface size (physical pixels); re-sent if it changes. */
  | { t: 'screen-info'; width: number; height: number }
  /** Controller asks the host to start / stop streaming its screen. */
  | { t: 'control-start' }
  | { t: 'control-stop' }
  | { t: 'input'; event: RemoteInputEvent }
  | { t: 'clipboard'; text: string }
  /** Sender proposes a file; receiver replies with accept (or ignores). */
  | { t: 'file-offer'; transferId: string; name: string; size: number }
  | { t: 'file-accept'; transferId: string }
  | { t: 'file-complete'; transferId: string }
  | { t: 'file-done'; transferId: string; savedPath: string }
  | { t: 'file-error'; transferId: string; message: string }
  | { t: 'ping' }
  | { t: 'pong' }
  | { t: 'bye'; reason: string };

// --- Binary data-plane framing -------------------------------------------------

export const BIN_SCREEN_TILE = 0x01;
export const BIN_FILE_CHUNK = 0x02;

/** Header layout for a screen tile: kind(1) frameId(4) x(2) y(2) w(2) h(2) = 13 bytes, then JPEG bytes. */
const TILE_HEADER_BYTES = 13;

export interface ScreenTile {
  frameId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** JPEG-encoded pixels for this tile. */
  jpeg: Uint8Array;
}

export function encodeScreenTile(tile: ScreenTile): Uint8Array {
  const out = new Uint8Array(TILE_HEADER_BYTES + tile.jpeg.byteLength);
  const view = new DataView(out.buffer);
  view.setUint8(0, BIN_SCREEN_TILE);
  view.setUint32(1, tile.frameId >>> 0);
  view.setUint16(5, tile.x);
  view.setUint16(7, tile.y);
  view.setUint16(9, tile.w);
  view.setUint16(11, tile.h);
  out.set(tile.jpeg, TILE_HEADER_BYTES);
  return out;
}

export function decodeScreenTile(buf: Uint8Array): ScreenTile {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    frameId: view.getUint32(1),
    x: view.getUint16(5),
    y: view.getUint16(7),
    w: view.getUint16(9),
    h: view.getUint16(11),
    jpeg: buf.subarray(TILE_HEADER_BYTES),
  };
}

/** Header layout for a file chunk: kind(1) transferId(4) seq(4) = 9 bytes, then raw bytes. */
const FILE_HEADER_BYTES = 9;

export interface FileChunk {
  /** Numeric handle for the transfer (low 32 bits of the transfer id hash). */
  transferKey: number;
  seq: number;
  bytes: Uint8Array;
}

export function encodeFileChunk(chunk: FileChunk): Uint8Array {
  const out = new Uint8Array(FILE_HEADER_BYTES + chunk.bytes.byteLength);
  const view = new DataView(out.buffer);
  view.setUint8(0, BIN_FILE_CHUNK);
  view.setUint32(1, chunk.transferKey >>> 0);
  view.setUint32(5, chunk.seq >>> 0);
  out.set(chunk.bytes, FILE_HEADER_BYTES);
  return out;
}

export function decodeFileChunk(buf: Uint8Array): FileChunk {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    transferKey: view.getUint32(1),
    seq: view.getUint32(5),
    bytes: buf.subarray(FILE_HEADER_BYTES),
  };
}

export function binaryKind(buf: Uint8Array): number {
  return buf[0];
}

/** Compact, deterministic 32-bit key derived from a transfer's string id (FNV-1a). */
export function transferKeyFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// --- Pairing code --------------------------------------------------------------

const PAIRING_PREFIX = 'AGENTMATE1:';

/** Everything the controller needs to reach and authenticate against a host. */
export interface PairingPayload {
  /** Host LAN IP the controller should dial. */
  ip: string;
  port: number;
  /** One-time pairing token; the host invalidates it after a successful pair. */
  token: string;
  /** Friendly host name shown to the operator before connecting. */
  deviceName: string;
  v: number;
}

function base64UrlEncode(text: string): string {
  const b64 = typeof btoa === 'function' ? btoa(text) : Buffer.from(text, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf-8');
}

export function encodePairingCode(payload: PairingPayload): string {
  return PAIRING_PREFIX + base64UrlEncode(JSON.stringify(payload));
}

export function decodePairingCode(code: string): PairingPayload | null {
  const trimmed = code.trim();
  const body = trimmed.startsWith(PAIRING_PREFIX) ? trimmed.slice(PAIRING_PREFIX.length) : trimmed;
  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as Partial<PairingPayload>;
    if (
      typeof parsed.ip === 'string' &&
      typeof parsed.port === 'number' &&
      typeof parsed.token === 'string' &&
      typeof parsed.deviceName === 'string'
    ) {
      return { ip: parsed.ip, port: parsed.port, token: parsed.token, deviceName: parsed.deviceName, v: parsed.v ?? 1 };
    }
  } catch {
    // fall through
  }
  return null;
}
