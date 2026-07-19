/**
 * Wire protocol shared between two AgentMate peers over a single WebSocket.
 *
 * This package is platform-agnostic on purpose: it is consumed by the desktop
 * app (Node/Electron, re-exported from `@shared/remoteProtocol`) and by the
 * mobile controller app (Hermes/React Native), so it must not rely on
 * `Buffer`, `btoa`/`atob`, or any other environment-specific global — only
 * `ArrayBuffer`/`DataView`/`Uint8Array`, which are standard everywhere.
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

// --- Portable base64 (no Buffer/btoa — safe on Node, browsers, and Hermes) ----

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Map<string, number>(Array.from(B64_CHARS).map((c, i) => [c, i]));

/** Encodes raw bytes as standard (non-URL) base64, with `=` padding. */
export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const hasB1 = i + 1 < len;
    const hasB2 = i + 2 < len;
    const b1 = hasB1 ? bytes[i + 1] : 0;
    const b2 = hasB2 ? bytes[i + 2] : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    result += B64_CHARS[(triplet >> 18) & 0x3f];
    result += B64_CHARS[(triplet >> 12) & 0x3f];
    result += hasB1 ? B64_CHARS[(triplet >> 6) & 0x3f] : '=';
    result += hasB2 ? B64_CHARS[triplet & 0x3f] : '=';
  }
  return result;
}

/** Decodes standard or URL-safe base64 (with or without padding) into raw bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const val = B64_LOOKUP.get(ch);
    if (val === undefined) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function utf8Encode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i) as number;
    if (code > 0xffff) i++; // consume the low surrogate too
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0) {
      const b1 = bytes[i++] ?? 0;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      const b3 = bytes[i++] ?? 0;
      const cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      out += String.fromCodePoint(cp);
    }
  }
  return out;
}

/** A `data:` URI a mobile `<Image>` can render directly from a decoded screen tile's JPEG bytes. */
export function jpegToDataUri(jpeg: Uint8Array): string {
  return `data:image/jpeg;base64,${bytesToBase64(jpeg)}`;
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
  return bytesToBase64(utf8Encode(text)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): string {
  return utf8Decode(base64ToBytes(text));
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
