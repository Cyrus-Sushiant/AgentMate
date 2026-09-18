import { describe, expect, it } from 'vitest';
import {
  buildRdCleanPathError,
  buildRdCleanPathRequest,
  buildRdCleanPathResponse,
  destinationMatches,
  formatDestination,
  parseDestination,
  parseRdCleanPathRequest,
  RDCLEANPATH_VERSION,
  tpktRemaining,
} from './rdcleanpath';

/**
 * The proxy parses this handshake straight off a WebSocket, before anything has been
 * authenticated, so a malformed message has to come back as an error rather than as a crash or a
 * read past the end of the buffer.
 *
 * The small DER writer and reader below exist so a test can build a message the real encoder
 * would never produce (a missing field, a bogus length) and can look inside a response.
 */

const TAG_SEQUENCE = 0x30;
const TAG_INTEGER = 0x02;
const TAG_OCTET_STRING = 0x04;
const TAG_UTF8STRING = 0x0c;
const context = (n: number): number => 0xa0 + n;

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derInteger(value: number): Buffer {
  const bytes: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest & 0xff);
  if (bytes.length === 0) bytes.push(0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return der(TAG_INTEGER, Buffer.from(bytes));
}

interface Node {
  tag: number;
  value: Buffer;
  end: number;
}

function readNode(buf: Buffer, offset = 0): Node {
  const tag = buf[offset];
  const first = buf[offset + 1];
  let length = first;
  let headerBytes = 2;
  if (first >= 0x80) {
    const count = first & 0x7f;
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + buf[offset + 2 + i];
    headerBytes = 2 + count;
  }
  const start = offset + headerBytes;
  return { tag, value: buf.subarray(start, start + length), end: start + length };
}

function readChildren(buf: Buffer): Node[] {
  const nodes: Node[] = [];
  for (let offset = 0; offset < buf.length; ) {
    const node = readNode(buf, offset);
    nodes.push(node);
    offset = node.end;
  }
  return nodes;
}

/** Only the fields the real encoder leaves out, so a test can ask for an incomplete request. */
function requestWith(fields: {
  version?: number | null;
  destination?: string | null;
  proxyAuth?: string;
  preconnectionBlob?: string;
  x224?: Buffer | null;
  extra?: Buffer;
}): Buffer {
  const parts: Buffer[] = [];
  if (fields.version !== null) {
    parts.push(der(context(0), derInteger(fields.version ?? RDCLEANPATH_VERSION)));
  }
  if (fields.destination !== null) {
    parts.push(
      der(context(2), der(TAG_UTF8STRING, Buffer.from(fields.destination ?? 'host:3389', 'utf-8'))),
    );
  }
  if (fields.proxyAuth !== undefined) {
    parts.push(der(context(3), der(TAG_UTF8STRING, Buffer.from(fields.proxyAuth, 'utf-8'))));
  }
  if (fields.preconnectionBlob !== undefined) {
    parts.push(
      der(context(5), der(TAG_UTF8STRING, Buffer.from(fields.preconnectionBlob, 'utf-8'))),
    );
  }
  if (fields.x224 !== null) {
    parts.push(der(context(6), der(TAG_OCTET_STRING, fields.x224 ?? Buffer.from([3, 0, 0, 11]))));
  }
  if (fields.extra) parts.push(fields.extra);
  return der(TAG_SEQUENCE, Buffer.concat(parts));
}

const X224 = Buffer.from([0x03, 0x00, 0x00, 0x2b, 0x26, 0xe0, 0x00, 0x00, 0x00, 0x00, 0x00]);

describe('RDCleanPath request', () => {
  it('round-trips what the session window sends', () => {
    const encoded = buildRdCleanPathRequest({
      destination: 'desktop.example.com:3389',
      x224ConnectionRequest: X224,
    });
    const parsed = parseRdCleanPathRequest(encoded);
    expect(parsed.version).toBe(RDCLEANPATH_VERSION);
    expect(parsed.destination).toBe('desktop.example.com:3389');
    expect(parsed.x224ConnectionRequest.equals(X224)).toBe(true);
    expect(parsed.proxyAuth).toBeUndefined();
  });

  it('round-trips the proxy token', () => {
    const encoded = buildRdCleanPathRequest({
      destination: '[2001:db8::1]:3390',
      proxyAuth: 'one-shot-token-value',
      x224ConnectionRequest: X224,
    });
    const parsed = parseRdCleanPathRequest(encoded);
    expect(parsed.proxyAuth).toBe('one-shot-token-value');
    expect(parsed.destination).toBe('[2001:db8::1]:3390');
  });

  it('round-trips fields long enough to need a multi-byte length', () => {
    // Past 127 bytes DER switches to the long form, on both the write and the read side.
    const long = Buffer.alloc(900, 0x5a);
    const encoded = buildRdCleanPathRequest({
      destination: `${'sub.'.repeat(40)}example.com:3389`,
      x224ConnectionRequest: long,
    });
    const parsed = parseRdCleanPathRequest(encoded);
    expect(parsed.x224ConnectionRequest.equals(long)).toBe(true);
    expect(parsed.destination.endsWith('example.com:3389')).toBe(true);
  });

  it('round-trips a destination with non-ASCII characters', () => {
    const encoded = buildRdCleanPathRequest({
      destination: 'büro.example:3389',
      x224ConnectionRequest: X224,
    });
    expect(parseRdCleanPathRequest(encoded).destination).toBe('büro.example:3389');
  });

  it('reads the preconnection blob, which only other clients send', () => {
    const parsed = parseRdCleanPathRequest(requestWith({ preconnectionBlob: 'vm-id-42' }));
    expect(parsed.preconnectionBlob).toBe('vm-id-42');
  });

  it('ignores a field number it does not know', () => {
    // Forward compatibility: a newer client may add fields this proxy has no use for.
    const extra = der(context(8), der(TAG_UTF8STRING, Buffer.from('future', 'utf-8')));
    expect(parseRdCleanPathRequest(requestWith({ extra })).destination).toBe('host:3389');
  });

  it('rejects a message that is not a SEQUENCE', () => {
    const encoded = buildRdCleanPathRequest({ destination: 'h:1', x224ConnectionRequest: X224 });
    encoded[0] = 0x31;
    expect(() => parseRdCleanPathRequest(encoded)).toThrow(/not a SEQUENCE/);
  });

  it('rejects a truncated message instead of reading past the end', () => {
    const encoded = buildRdCleanPathRequest({
      destination: 'desktop.example.com:3389',
      x224ConnectionRequest: X224,
    });
    expect(() => parseRdCleanPathRequest(encoded.subarray(0, encoded.length - 5))).toThrow(
      /Truncated/,
    );
    expect(() => parseRdCleanPathRequest(encoded.subarray(0, 1))).toThrow(/Truncated/);
    expect(() => parseRdCleanPathRequest(Buffer.alloc(0))).toThrow(/Truncated/);
  });

  it('rejects a bogus length header', () => {
    // 0x80 means "long form with zero length bytes", and 0x85 claims five, which no length needs.
    expect(() => parseRdCleanPathRequest(Buffer.from([TAG_SEQUENCE, 0x80]))).toThrow(
      /Invalid length/,
    );
    expect(() =>
      parseRdCleanPathRequest(Buffer.from([TAG_SEQUENCE, 0x85, 1, 1, 1, 1, 1, 0, 0])),
    ).toThrow(/Invalid length/);
  });

  it('rejects a length that runs past the buffer', () => {
    expect(() => parseRdCleanPathRequest(Buffer.from([TAG_SEQUENCE, 0x7f, 0x00]))).toThrow(
      /Truncated/,
    );
  });

  it('rejects another version, so an old client is told rather than half-served', () => {
    const encoded = requestWith({ version: RDCLEANPATH_VERSION + 1 });
    expect(() => parseRdCleanPathRequest(encoded)).toThrow(
      `Unsupported RDCleanPath version ${RDCLEANPATH_VERSION + 1}.`,
    );
  });

  it('rejects a message with no version at all', () => {
    expect(() => parseRdCleanPathRequest(requestWith({ version: null }))).toThrow(
      /version missing/,
    );
  });

  it('rejects a missing or empty destination', () => {
    expect(() => parseRdCleanPathRequest(requestWith({ destination: null }))).toThrow(
      /no destination/,
    );
    expect(() => parseRdCleanPathRequest(requestWith({ destination: '' }))).toThrow(
      /no destination/,
    );
  });

  it('rejects a message with no X.224 connection request', () => {
    expect(() => parseRdCleanPathRequest(requestWith({ x224: null }))).toThrow(/no X.224 request/);
  });
});

describe('RDCleanPath response', () => {
  it('carries the version, the X.224 confirm, the chain and the server address', () => {
    const x224Response = Buffer.from([0x03, 0x00, 0x00, 0x13, 0x0e, 0xd0]);
    const chain = [Buffer.alloc(300, 0x11), Buffer.alloc(5, 0x22)];
    const encoded = buildRdCleanPathResponse('10.0.0.5:3389', x224Response, chain);

    const outer = readNode(encoded);
    expect(outer.tag).toBe(TAG_SEQUENCE);
    expect(outer.end).toBe(encoded.length);

    const fields = new Map(readChildren(outer.value).map((node) => [node.tag & 0x1f, node]));
    expect(readNode(fields.get(0)?.value as Buffer).value.readUInt16BE(0)).toBe(
      RDCLEANPATH_VERSION,
    );
    expect(readNode(fields.get(6)?.value as Buffer).value.equals(x224Response)).toBe(true);
    expect(readNode(fields.get(9)?.value as Buffer).value.toString('utf-8')).toBe('10.0.0.5:3389');

    const certs = readChildren(readNode(fields.get(7)?.value as Buffer).value);
    expect(certs.map((cert) => cert.value.length)).toEqual([300, 5]);
    expect(certs[0].value.equals(chain[0])).toBe(true);
  });

  it('handles an empty certificate chain', () => {
    const encoded = buildRdCleanPathResponse('host', Buffer.from([3, 0, 0, 4]), []);
    const fields = new Map(
      readChildren(readNode(encoded).value).map((node) => [node.tag & 0x1f, node]),
    );
    expect(readChildren(readNode(fields.get(7)?.value as Buffer).value)).toEqual([]);
  });

  it('builds an error with and without an HTTP status', () => {
    const plain = buildRdCleanPathError(2);
    const withStatus = buildRdCleanPathError(1, 502);

    for (const encoded of [plain, withStatus]) {
      const outer = readNode(encoded);
      expect(outer.tag).toBe(TAG_SEQUENCE);
      expect(outer.end).toBe(encoded.length);
    }

    const errorOf = (encoded: Buffer): number[] => {
      const fields = new Map(
        readChildren(readNode(encoded).value).map((node) => [node.tag & 0x1f, node]),
      );
      const inner = readNode(fields.get(1)?.value as Buffer);
      return readChildren(inner.value).map((node) => readNode(node.value).value[0]);
    };

    expect(errorOf(plain)).toEqual([2]);
    // 502 needs two bytes, so only the first is checked above; read it whole here.
    const fields = new Map(
      readChildren(readNode(withStatus).value).map((node) => [node.tag & 0x1f, node]),
    );
    const parts = readChildren(readNode(fields.get(1)?.value as Buffer).value);
    expect(readNode(parts[0].value).value[0]).toBe(1);
    expect(readNode(parts[1].value).value.readUInt16BE(0)).toBe(502);
  });
});

describe('parseDestination', () => {
  it.each([
    ['host:1234', 'host', 1234],
    ['desktop.example.com:3389', 'desktop.example.com', 3389],
    ['host', 'host', 3389],
    ['[::1]:3389', '::1', 3389],
    ['[::1]:13389', '::1', 13389],
    ['[2001:db8::1]', '2001:db8::1', 3389],
    // A bare v6 address has more than one colon, so the last one is not a port separator.
    ['2001:db8::1', '2001:db8::1', 3389],
    ['192.168.1.5:3390', '192.168.1.5', 3390],
  ])('reads %s', (destination, host, port) => {
    expect(parseDestination(destination)).toEqual({ host, port });
  });

  it.each([
    ['host:', 'host:'],
    ['host:not-a-number', 'host:not-a-number'],
  ])('falls back to the default port for %s', (destination, host) => {
    // Nothing usable after the colon, so the whole string is taken as the host and the
    // connection fails later with a name that shows what was asked for.
    expect(parseDestination(destination)).toEqual({ host, port: 3389 });
  });

  it('rejects a bracket that never closes', () => {
    expect(() => parseDestination('[::1:3389')).toThrow(/Invalid destination/);
  });

  it('reads an empty string as an empty host', () => {
    expect(parseDestination('')).toEqual({ host: '', port: 3389 });
  });
});

describe('formatDestination', () => {
  it('brackets an IPv6 address and leaves a name alone', () => {
    expect(formatDestination('desktop.example.com', 3389)).toBe('desktop.example.com:3389');
    expect(formatDestination('::1', 3389)).toBe('[::1]:3389');
  });

  it('round-trips through parseDestination', () => {
    for (const [host, port] of [
      ['desktop.example.com', 3389],
      ['192.168.1.5', 13389],
      ['::1', 3389],
      ['2001:db8::1', 3390],
    ] as const) {
      expect(parseDestination(formatDestination(host, port))).toEqual({ host, port });
    }
  });
});

describe('destinationMatches', () => {
  it('matches the saved host and port, ignoring host case', () => {
    expect(destinationMatches('Desktop.Example.com:3389', 'desktop.example.com', 3389)).toBe(true);
    expect(destinationMatches('[::1]:3389', '::1', 3389)).toBe(true);
    expect(destinationMatches('host', 'host', 3389)).toBe(true);
  });

  it('refuses another port or another host', () => {
    // This is what stops a one-shot proxy token being reused against a different machine.
    expect(destinationMatches('host:3389', 'host', 3390)).toBe(false);
    expect(destinationMatches('other:3389', 'host', 3389)).toBe(false);
  });

  it('refuses a destination it cannot even parse', () => {
    expect(destinationMatches('[::1:3389', '::1', 3389)).toBe(false);
  });
});

describe('tpktRemaining', () => {
  it('asks for the header first', () => {
    expect(tpktRemaining(Buffer.alloc(0))).toBe(4);
    expect(tpktRemaining(Buffer.from([0x03]))).toBe(3);
    expect(tpktRemaining(Buffer.from([0x03, 0x00, 0x00]))).toBe(1);
  });

  it('asks for the rest of the frame once the length is known', () => {
    expect(tpktRemaining(Buffer.from([0x03, 0x00, 0x00, 0x13]))).toBe(0x13 - 4);
    expect(
      tpktRemaining(Buffer.concat([Buffer.from([0x03, 0x00, 0x00, 0x13]), Buffer.alloc(9)])),
    ).toBe(6);
  });

  it('reports nothing left for a complete or over-long frame', () => {
    expect(
      tpktRemaining(Buffer.concat([Buffer.from([0x03, 0x00, 0x00, 0x08]), Buffer.alloc(4)])),
    ).toBe(0);
    expect(
      tpktRemaining(Buffer.concat([Buffer.from([0x03, 0x00, 0x00, 0x08]), Buffer.alloc(40)])),
    ).toBe(0);
  });

  it('rejects an answer that is not TPKT at all', () => {
    // An HTTP error page or an SSH banner arriving on port 3389, which does happen.
    expect(() => tpktRemaining(Buffer.from('HTTP/1.1 400', 'utf-8'))).toThrow(
      /did not answer like an RDP server/,
    );
  });
});
