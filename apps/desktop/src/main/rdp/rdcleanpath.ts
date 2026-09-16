/**
 * RDCleanPath, the small ASN.1 DER handshake the IronRDP web client speaks to its proxy. The
 * client can't open raw TCP or do its own TLS from a renderer, so it sends the proxy the
 * destination and its X.224 connection request; the proxy connects, upgrades to TLS, and
 * answers with the X.224 confirm plus the server's certificate chain. After that the WebSocket
 * carries the RDP stream both ways, with the proxy holding the TLS session to the server.
 *
 * Field numbers follow Devolutions' own definition in IronRDP (`crates/ironrdp-rdcleanpath`).
 * Kept free of Electron and sockets so the codec can be tested on its own.
 */

/** Version number is the RDP port plus one, by the protocol's own convention. */
export const RDCLEANPATH_VERSION = 3390;

const TAG_SEQUENCE = 0x30;
const TAG_INTEGER = 0x02;
const TAG_OCTET_STRING = 0x04;
const TAG_UTF8STRING = 0x0c;
const contextTag = (n: number): number => 0xa0 + n;

export interface RdCleanPathRequest {
  version: number;
  destination: string;
  proxyAuth?: string;
  preconnectionBlob?: string;
  x224ConnectionRequest: Buffer;
}

interface Tlv {
  tag: number;
  value: Buffer;
  totalLength: number;
}

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let rest = length;
  while (rest > 0) {
    bytes.unshift(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function wrap(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

function encodeInteger(value: number): Buffer {
  if (value === 0) return wrap(TAG_INTEGER, Buffer.from([0]));
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.unshift(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  // A set high bit would read as negative.
  if (bytes[0] & 0x80) bytes.unshift(0);
  return wrap(TAG_INTEGER, Buffer.from(bytes));
}

function decodeTlv(buf: Buffer, offset: number): Tlv {
  if (offset + 2 > buf.length) throw new Error('Truncated RDCleanPath message.');
  const tag = buf[offset];
  const first = buf[offset + 1];
  let length = first;
  let lengthBytes = 1;
  if (first >= 0x80) {
    const count = first & 0x7f;
    if (count === 0 || count > 4 || offset + 2 + count > buf.length) {
      throw new Error('Invalid length in RDCleanPath message.');
    }
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + buf[offset + 2 + i];
    lengthBytes = 1 + count;
  }
  const start = offset + 1 + lengthBytes;
  if (start + length > buf.length) throw new Error('Truncated RDCleanPath message.');
  return { tag, value: buf.subarray(start, start + length), totalLength: 1 + lengthBytes + length };
}

function decodeChildren(buf: Buffer): Tlv[] {
  const children: Tlv[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const tlv = decodeTlv(buf, offset);
    children.push(tlv);
    offset += tlv.totalLength;
  }
  return children;
}

function decodeInteger(buf: Buffer): number {
  let value = 0;
  for (const byte of buf) value = value * 256 + byte;
  return value;
}

export function parseRdCleanPathRequest(data: Buffer): RdCleanPathRequest {
  const outer = decodeTlv(data, 0);
  if (outer.tag !== TAG_SEQUENCE) throw new Error('RDCleanPath request is not a SEQUENCE.');

  let version: number | undefined;
  let destination: string | undefined;
  let proxyAuth: string | undefined;
  let preconnectionBlob: string | undefined;
  let x224ConnectionRequest: Buffer | undefined;

  for (const child of decodeChildren(outer.value)) {
    const inner = decodeTlv(child.value, 0);
    switch (child.tag & 0x1f) {
      case 0:
        version = decodeInteger(inner.value);
        break;
      case 2:
        destination = inner.value.toString('utf-8');
        break;
      case 3:
        proxyAuth = inner.value.toString('utf-8');
        break;
      case 5:
        preconnectionBlob = inner.value.toString('utf-8');
        break;
      case 6:
        x224ConnectionRequest = Buffer.from(inner.value);
        break;
    }
  }

  if (version !== RDCLEANPATH_VERSION) {
    throw new Error(`Unsupported RDCleanPath version ${version ?? 'missing'}.`);
  }
  if (!destination) throw new Error('RDCleanPath request has no destination.');
  if (!x224ConnectionRequest) throw new Error('RDCleanPath request has no X.224 request.');
  return { version, destination, proxyAuth, preconnectionBlob, x224ConnectionRequest };
}

/** Test and debugging counterpart of `parseRdCleanPathRequest`. */
export function buildRdCleanPathRequest(request: Omit<RdCleanPathRequest, 'version'>): Buffer {
  const parts = [
    wrap(contextTag(0), encodeInteger(RDCLEANPATH_VERSION)),
    wrap(contextTag(2), wrap(TAG_UTF8STRING, Buffer.from(request.destination, 'utf-8'))),
  ];
  if (request.proxyAuth != null) {
    parts.push(wrap(contextTag(3), wrap(TAG_UTF8STRING, Buffer.from(request.proxyAuth, 'utf-8'))));
  }
  parts.push(wrap(contextTag(6), wrap(TAG_OCTET_STRING, request.x224ConnectionRequest)));
  return wrap(TAG_SEQUENCE, Buffer.concat(parts));
}

export function buildRdCleanPathResponse(
  serverAddress: string,
  x224Response: Buffer,
  certChain: Buffer[],
): Buffer {
  return wrap(
    TAG_SEQUENCE,
    Buffer.concat([
      wrap(contextTag(0), encodeInteger(RDCLEANPATH_VERSION)),
      wrap(contextTag(6), wrap(TAG_OCTET_STRING, x224Response)),
      wrap(
        contextTag(7),
        wrap(TAG_SEQUENCE, Buffer.concat(certChain.map((c) => wrap(TAG_OCTET_STRING, c)))),
      ),
      wrap(contextTag(9), wrap(TAG_UTF8STRING, Buffer.from(serverAddress, 'utf-8'))),
    ]),
  );
}

/** `errorCode` 1 is a general failure, 2 a negotiation failure. */
export function buildRdCleanPathError(errorCode: number, httpStatusCode?: number): Buffer {
  const fields = [wrap(contextTag(0), encodeInteger(errorCode))];
  if (httpStatusCode != null) fields.push(wrap(contextTag(1), encodeInteger(httpStatusCode)));
  return wrap(
    TAG_SEQUENCE,
    Buffer.concat([
      wrap(contextTag(0), encodeInteger(RDCLEANPATH_VERSION)),
      wrap(contextTag(1), wrap(TAG_SEQUENCE, Buffer.concat(fields))),
    ]),
  );
}

/** Splits `host:port`, `[v6]:port`, or a bare host (port 3389). */
export function parseDestination(destination: string): { host: string; port: number } {
  if (destination.startsWith('[')) {
    const end = destination.indexOf(']');
    if (end < 0) throw new Error(`Invalid destination ${destination}.`);
    const rest = destination.slice(end + 1);
    return {
      host: destination.slice(1, end),
      port: rest.startsWith(':') ? Number.parseInt(rest.slice(1), 10) : 3389,
    };
  }
  const colon = destination.lastIndexOf(':');
  // More than one colon without brackets is a bare IPv6 address.
  if (colon < 0 || destination.indexOf(':') !== colon) return { host: destination, port: 3389 };
  const port = Number.parseInt(destination.slice(colon + 1), 10);
  if (Number.isNaN(port)) return { host: destination, port: 3389 };
  return { host: destination.slice(0, colon), port };
}

/** The `destination` string the session window sends for a saved host and port. */
export function formatDestination(host: string, port: number): string {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}

/** True when `destination` names exactly this host and port (host compared case-insensitively). */
export function destinationMatches(destination: string, host: string, port: number): boolean {
  try {
    const parsed = parseDestination(destination);
    return parsed.port === port && parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Bytes needed before a TPKT frame (the X.224 connection confirm) is complete, or 0 once it is.
 * TPKT is a 4-byte header: version 3, reserved, then the whole frame length big-endian.
 */
export function tpktRemaining(buf: Buffer): number {
  if (buf.length < 4) return 4 - buf.length;
  if (buf[0] !== 0x03) throw new Error('The server did not answer like an RDP server.');
  const length = buf.readUInt16BE(2);
  return Math.max(0, length - buf.length);
}
