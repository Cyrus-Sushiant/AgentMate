import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { isIP, connect as netConnect, type Socket } from 'node:net';
import { type DetailedPeerCertificate, type TLSSocket, connect as tlsConnect } from 'node:tls';
import { type RawData, type WebSocket, WebSocketServer } from 'ws';
import {
  buildRdCleanPathError,
  buildRdCleanPathResponse,
  destinationMatches,
  parseRdCleanPathRequest,
  tpktRemaining,
} from './rdcleanpath';

/**
 * A loopback-only WebSocket to TCP bridge for the RDP session windows. The IronRDP engine runs
 * in a sandboxed renderer, which can't open sockets, so it hands this proxy an RDCleanPath
 * request and the proxy does the TCP connect and TLS upgrade on its behalf.
 *
 * It is not an open relay: every connection needs a one-time token minted for a single saved
 * server, and the destination in the request has to be that server's host and port.
 */

const TICKET_TTL_MS = 60_000;
const CONNECT_TIMEOUT_MS = 15_000;
/** Stop reading from the server while this much is still queued for the renderer. */
const HIGH_WATER_BYTES = 8 * 1024 * 1024;

export interface RdpProxyTarget {
  sessionId: string;
  host: string;
  port: number;
  /** The certificate fingerprint saved last time, if any. */
  expectedFingerprint?: string;
}

export interface RdpCertificateInfo {
  fingerprint: string;
  subject: string;
  issuer: string;
  validTo: string;
}

export interface RdpProxyHooks {
  /** First connect to this server: remember its certificate. */
  onCertificateFirstSeen: (target: RdpProxyTarget, cert: RdpCertificateInfo) => void;
  /** The certificate changed. The connection is refused; the window asks whether to trust it. */
  onCertificateMismatch: (target: RdpProxyTarget, cert: RdpCertificateInfo) => void;
  onConnected: (target: RdpProxyTarget) => void;
  onError: (target: RdpProxyTarget, message: string) => void;
}

interface Ticket {
  target: RdpProxyTarget;
  expiresAt: number;
}

function formatName(name: Record<string, string | string[]> | undefined): string {
  if (!name) return '';
  return Object.entries(name)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join('+') : value}`)
    .join(', ');
}

function certChain(peer: DetailedPeerCertificate): Buffer[] {
  const chain: Buffer[] = [];
  const seen = new Set<string>();
  let current: DetailedPeerCertificate | undefined = peer;
  while (current?.raw && !seen.has(current.fingerprint256)) {
    seen.add(current.fingerprint256);
    chain.push(Buffer.from(current.raw));
    current = current.issuerCertificate === current ? undefined : current.issuerCertificate;
  }
  return chain;
}

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

/** Turns socket errors into something a person can act on. */
function friendlyError(error: NodeJS.ErrnoException, host: string, port: number): string {
  switch (error.code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Could not find ${host}. Check the host name.`;
    case 'ECONNREFUSED':
      return `${host}:${port} refused the connection. Check that Remote Desktop is enabled and the port is right.`;
    case 'ETIMEDOUT':
      return `Connection to ${host}:${port} timed out.`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `${host} is not reachable from this network.`;
    case 'ECONNRESET':
      return `${host}:${port} closed the connection during setup.`;
    default:
      return error.message || String(error);
  }
}

interface Handshake {
  /** The resolved IP address actually connected to. */
  address: string;
  x224Response: Buffer;
  tlsSocket: TLSSocket;
  cert: RdpCertificateInfo;
  chain: Buffer[];
}

function handshake(host: string, port: number, x224Request: Buffer): Promise<Handshake> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let tcp: Socket | null = null;
    let tlsSocket: TLSSocket | null = null;
    let received = Buffer.alloc(0);

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      tlsSocket?.destroy();
      tcp?.destroy();
      reject(error);
    };

    const timer = setTimeout(
      () => fail(new Error(`Connection to ${host}:${port} timed out.`)),
      CONNECT_TIMEOUT_MS,
    );

    tcp = netConnect({ host, port }, () => tcp?.write(x224Request));
    tcp.on('error', (error: NodeJS.ErrnoException) =>
      fail(new Error(friendlyError(error, host, port))),
    );

    const onData = (chunk: Buffer): void => {
      received = Buffer.concat([received, chunk]);
      let remaining: number;
      try {
        remaining = tpktRemaining(received);
      } catch (error) {
        fail(error as Error);
        return;
      }
      if (remaining > 0) return;
      // The server says nothing more until our TLS ClientHello, so TLS can take the socket over.
      tcp?.off('data', onData);

      tlsSocket = tlsConnect(
        {
          socket: tcp as Socket,
          // SNI must not be an IP address.
          servername: isIP(host) ? undefined : host,
          // RDP servers use self-signed certificates. Trust comes from the saved fingerprint.
          rejectUnauthorized: false,
        },
        () => {
          if (settled || !tlsSocket) return;
          const peer = tlsSocket.getPeerCertificate(true);
          if (!peer?.raw) {
            fail(new Error('The server did not present a certificate.'));
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve({
            address: tcp?.remoteAddress ?? host,
            x224Response: received,
            tlsSocket,
            chain: certChain(peer),
            cert: {
              fingerprint: peer.fingerprint256,
              subject: formatName(peer.subject as unknown as Record<string, string>),
              issuer: formatName(peer.issuer as unknown as Record<string, string>),
              validTo: peer.valid_to,
            },
          });
        },
      );
      tlsSocket.on('error', (error: NodeJS.ErrnoException) =>
        fail(new Error(`Secure connection to ${host}:${port} failed: ${error.message}`)),
      );
    };
    tcp.on('data', onData);
    tcp.on('close', () => fail(new Error(`${host}:${port} closed the connection during setup.`)));
  });
}

export class RdpProxy {
  private server: WebSocketServer | null = null;
  private port = 0;
  private starting: Promise<void> | null = null;
  private readonly tickets = new Map<string, Ticket>();
  private readonly live = new Map<string, Set<() => void>>();

  constructor(private readonly hooks: RdpProxyHooks) {}

  /** A `ws://` URL that lets one connection through to `target`, within the next minute. */
  async issueUrl(target: RdpProxyTarget): Promise<string> {
    await this.ensureStarted();
    this.pruneTickets();
    const token = randomBytes(32).toString('hex');
    this.tickets.set(token, { target, expiresAt: Date.now() + TICKET_TTL_MS });
    return `ws://127.0.0.1:${this.port}/${token}`;
  }

  /** Drops any unused tickets and open connections for a session (its window closed). */
  closeSession(sessionId: string): void {
    for (const [token, ticket] of this.tickets) {
      if (ticket.target.sessionId === sessionId) this.tickets.delete(token);
    }
    for (const close of this.live.get(sessionId) ?? []) close();
    this.live.delete(sessionId);
  }

  get activeSessionCount(): number {
    return this.live.size;
  }

  shutdown(): void {
    for (const sessionId of [...this.live.keys()]) this.closeSession(sessionId);
    this.tickets.clear();
    this.server?.close();
    this.server = null;
    this.starting = null;
  }

  private pruneTickets(): void {
    const now = Date.now();
    for (const [token, ticket] of this.tickets) {
      if (ticket.expiresAt < now) this.tickets.delete(token);
    }
  }

  private ensureStarted(): Promise<void> {
    if (this.server) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = new Promise<void>((resolve, reject) => {
      const server = new WebSocketServer({
        host: '127.0.0.1',
        port: 0,
        maxPayload: 64 * 1024 * 1024,
      });
      server.once('listening', () => {
        this.server = server;
        this.port = (server.address() as AddressInfo).port;
        resolve();
      });
      server.once('error', (error) => {
        this.starting = null;
        reject(error);
      });
      server.on('connection', (ws, request) => {
        const token = (request.url ?? '').replace(/^\//, '');
        const ticket = this.tickets.get(token);
        this.tickets.delete(token);
        if (!ticket || ticket.expiresAt < Date.now()) {
          ws.close(1008, 'Invalid or expired session token');
          return;
        }
        this.handle(ws, ticket.target);
      });
    });
    return this.starting;
  }

  private handle(ws: WebSocket, target: RdpProxyTarget): void {
    const { host, port } = target;
    const sendError = (message: string, httpStatus = 502): void => {
      this.hooks.onError(target, message);
      try {
        ws.send(buildRdCleanPathError(1, httpStatus));
      } catch {
        // The window may already be gone.
      }
      ws.close();
    };

    ws.once('message', async (data) => {
      let request: ReturnType<typeof parseRdCleanPathRequest>;
      try {
        request = parseRdCleanPathRequest(toBuffer(data));
      } catch (error) {
        sendError((error as Error).message, 400);
        return;
      }
      if (!destinationMatches(request.destination, host, port)) {
        sendError('The session asked for a different server than the one it was opened for.', 403);
        return;
      }

      let result: Handshake;
      try {
        result = await handshake(host, port, request.x224ConnectionRequest);
      } catch (error) {
        sendError((error as Error).message);
        return;
      }

      if (ws.readyState !== ws.OPEN) {
        result.tlsSocket.destroy();
        return;
      }

      const { cert } = result;
      if (!target.expectedFingerprint) {
        this.hooks.onCertificateFirstSeen(target, cert);
      } else if (target.expectedFingerprint !== cert.fingerprint) {
        result.tlsSocket.destroy();
        this.hooks.onCertificateMismatch(target, cert);
        try {
          ws.send(buildRdCleanPathError(1, 403));
        } catch {
          // Ignore, the window shows the certificate prompt either way.
        }
        ws.close();
        return;
      }

      ws.send(buildRdCleanPathResponse(result.address, result.x224Response, result.chain));
      this.relay(ws, result.tlsSocket, target);
      this.hooks.onConnected(target);
    });
  }

  private relay(ws: WebSocket, tlsSocket: TLSSocket, target: RdpProxyTarget): void {
    let closed = false;
    const close = (): void => {
      if (closed) return;
      closed = true;
      tlsSocket.destroy();
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) ws.close();
      const set = this.live.get(target.sessionId);
      set?.delete(close);
      if (set && set.size === 0) this.live.delete(target.sessionId);
    };

    let set = this.live.get(target.sessionId);
    if (!set) {
      set = new Set();
      this.live.set(target.sessionId, set);
    }
    set.add(close);

    tlsSocket.on('data', (chunk: Buffer) => {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(chunk, () => {
        if (tlsSocket.isPaused() && ws.bufferedAmount < HIGH_WATER_BYTES / 2) tlsSocket.resume();
      });
      if (ws.bufferedAmount > HIGH_WATER_BYTES) tlsSocket.pause();
    });
    ws.on('message', (data) => {
      if (tlsSocket.destroyed) return;
      if (!tlsSocket.write(toBuffer(data))) {
        ws.pause();
        tlsSocket.once('drain', () => ws.resume());
      }
    });

    tlsSocket.on('end', close);
    tlsSocket.on('close', close);
    tlsSocket.on('error', close);
    ws.on('close', close);
    ws.on('error', close);
  }
}
