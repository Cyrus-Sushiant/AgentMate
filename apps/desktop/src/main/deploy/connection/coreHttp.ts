import { Agent, type ClientRequestArgs, request } from 'node:http';
import type { Duplex } from 'node:stream';
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
            if (status < 200 || status >= 300) {
              reject(new Error(`The server core refused ${method} ${path} (${status}).`));
              return;
            }
            const text = Buffer.concat(chunks).toString('utf8');
            try {
              resolve((text ? JSON.parse(text) : undefined) as T);
            } catch {
              reject(new Error(`The server core sent an unreadable answer to ${method} ${path}.`));
            }
          });
          response.on('error', reject);
        },
      );
      outgoing.setTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, () => {
        outgoing.destroy(new Error(`The server core did not answer ${method} ${path} in time.`));
      });
      outgoing.on('error', reject);
      outgoing.end(payload);
    });
  }
}
