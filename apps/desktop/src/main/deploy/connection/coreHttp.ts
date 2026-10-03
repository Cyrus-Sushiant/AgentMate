import { Agent, type ClientRequest, type ClientRequestArgs, request } from 'node:http';
import type { Duplex, Readable, Writable } from 'node:stream';
import type { HealthResponse } from '../../../shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { CoreTransport } from './transport';

/**
 * REST calls to the server core. Everything else goes through the hub; REST is only for health,
 * sign-in and large uploads. Each request gets its own stream from the transport, so an SSH
 * channel never outlives the request it carried.
 */

/** The Host header the core accepts; it never answers to anything else. */
export const CORE_HOST = 'agentmate-core';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Hands every HTTP connection to the transport instead of dialing TCP. */
class TransportAgent extends Agent {
  constructor(private readonly transport: CoreTransport) {
    super({ keepAlive: false });
  }

  override createConnection(
    _options: ClientRequestArgs,
    callback?: (error: Error | null, stream: Duplex) => void,
  ): Duplex | null | undefined {
    this.transport.openStream().then(
      (stream) => callback?.(null, stream),
      (error: Error) => callback?.(error, undefined as unknown as Duplex),
    );
    return undefined;
  }
}

export interface CoreRequestOptions {
  token?: string;
  timeoutMs?: number;
}

/** A streamed request body: a stack's build context (E07). */
export interface CoreStreamOptions extends CoreRequestOptions {
  contentType: string;
  contentLength: number;
  headers?: Record<string, string>;
  /** Bytes handed to the transport so far. */
  onProgress?: (sentBytes: number) => void;
}

/** A streamed response body: a backup (E15). */
export interface CoreDownloadOptions extends CoreRequestOptions {
  /** Bytes received so far. */
  onProgress?: (receivedBytes: number) => void;
}

/** A refusal from the core, with its status and (when it sent JSON) the body. */
export class CoreHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'CoreHttpError';
  }
}

export class CoreHttpClient {
  private readonly agent: Agent;

  constructor(readonly transport: CoreTransport) {
    this.agent = new TransportAgent(transport);
  }

  health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/api/v1/health', { timeoutMs: 15_000 });
  }

  get<T>(path: string, options: CoreRequestOptions = {}): Promise<T> {
    return this.send<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body: unknown, options: CoreRequestOptions = {}): Promise<T> {
    return this.send<T>('POST', path, body, options);
  }

  /** Streams the body as it reads it, so a large upload is never held in memory. */
  putStream<T>(path: string, body: Readable, options: CoreStreamOptions): Promise<T> {
    const headers: Record<string, string> = {
      ...options.headers,
      host: CORE_HOST,
      accept: 'application/json',
      'content-type': options.contentType,
      'content-length': String(options.contentLength),
    };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    return this.exchange<T>('PUT', path, headers, options.timeoutMs, (outgoing) => {
      let sent = 0;
      body.on('data', (chunk: Buffer) => {
        sent += chunk.length;
        options.onProgress?.(sent);
      });
      body.on('error', (error) => outgoing.destroy(error));
      body.pipe(outgoing);
    });
  }

  /**
   * Streams a GET's body into `destination` (a backup, E15), never holding it in memory, and
   * resolves with the number of bytes written once the destination has them all. A refusal
   * rejects with a CoreHttpError as the other calls do.
   */
  download(
    path: string,
    destination: Writable,
    options: CoreDownloadOptions = {},
  ): Promise<number> {
    const headers: Record<string, string> = {
      host: CORE_HOST,
      accept: 'application/octet-stream',
    };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    return new Promise<number>((resolve, reject) => {
      let settled = false;
      const finish = (error: Error | null, bytes = 0) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(bytes);
      };
      const outgoing = request(
        { agent: this.agent, host: CORE_HOST, path, method: 'GET', headers },
        (response) => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            response.resume();
            finish(
              new CoreHttpError(`The server core refused GET ${path} (${status}).`, status, null),
            );
            return;
          }
          let received = 0;
          response.on('data', (chunk: Buffer) => {
            received += chunk.length;
            options.onProgress?.(received);
          });
          response.on('error', (error) => finish(error));
          destination.on('error', (error) => {
            outgoing.destroy(error);
            finish(error);
          });
          destination.on('finish', () => finish(null, received));
          response.pipe(destination);
        },
      );
      const deadline = setTimeout(() => {
        const error = new Error(`The server core did not finish sending ${path} in time.`);
        outgoing.destroy(error);
        finish(error);
      }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      outgoing.on('error', (error) => finish(error));
      outgoing.end();
    });
  }

  private send<T>(
    method: string,
    path: string,
    body: unknown,
    options: CoreRequestOptions,
  ): Promise<T> {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8');
    const headers: Record<string, string> = { host: CORE_HOST, accept: 'application/json' };
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(payload.length);
    }
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    return this.exchange<T>(method, path, headers, options.timeoutMs, (outgoing) =>
      outgoing.end(payload),
    );
  }

  private exchange<T>(
    method: string,
    path: string,
    headers: Record<string, string>,
    timeoutMs: number | undefined,
    write: (outgoing: ClientRequest) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const outgoing = request(
        { agent: this.agent, host: CORE_HOST, path, method, headers },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_RESPONSE_BYTES) {
              outgoing.destroy(
                new Error(`The server core's answer to ${method} ${path} is too large.`),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () => {
            const status = response.statusCode ?? 0;
            const text = Buffer.concat(chunks).toString('utf8');
            if (status < 200 || status >= 300) {
              let body: unknown = null;
              try {
                body = text ? JSON.parse(text) : null;
              } catch {
                // Not JSON: the status alone says what happened.
              }
              reject(
                new CoreHttpError(
                  `The server core refused ${method} ${path} (${status}).`,
                  status,
                  body,
                ),
              );
              return;
            }
            try {
              resolve((text ? JSON.parse(text) : undefined) as T);
            } catch {
              reject(new Error(`The server core sent an unreadable answer to ${method} ${path}.`));
            }
          });
          response.on('error', reject);
        },
      );
      // A deadline of its own rather than a socket timeout: an SSH channel never fires one, and
      // the tunnel opening is part of what may hang.
      const deadline = setTimeout(() => {
        const error = new Error(`The server core did not answer ${method} ${path} in time.`);
        outgoing.destroy(error);
        // A request still waiting for its tunnel has no socket to report the error through.
        reject(error);
      }, timeoutMs ?? DEFAULT_TIMEOUT_MS);
      outgoing.on('close', () => clearTimeout(deadline));
      outgoing.on('error', (error) => {
        clearTimeout(deadline);
        reject(error);
      });
      write(outgoing);
    });
  }
}
