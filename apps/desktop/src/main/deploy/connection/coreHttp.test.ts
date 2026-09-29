import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreHttpClient, CoreHttpError } from './coreHttp';
import { devTcpTransport } from './transport';

/**
 * The few REST calls the app makes (health, and sign-in from E04), carried over whatever
 * transport reaches the core. Every request names the core's own host and carries no Origin, so
 * the core's request guards accept it.
 */

let server: Server | null = null;
const seen: IncomingMessage[] = [];

afterEach(async () => {
  seen.length = 0;
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

async function serve(
  handler: (
    request: IncomingMessage,
    body: string,
  ) => { status: number; body?: unknown; delayMs?: number },
): Promise<CoreHttpClient> {
  const listening = createServer((request, response) => {
    seen.push(request);
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const answer = handler(request, body);
      setTimeout(() => {
        response.writeHead(answer.status, { 'content-type': 'application/json' });
        response.end(answer.body === undefined ? '' : JSON.stringify(answer.body));
      }, answer.delayMs ?? 0);
    });
  });
  server = listening;
  const port = await new Promise<number>((resolve) => {
    listening.listen(0, '127.0.0.1', () => resolve((listening.address() as AddressInfo).port));
  });
  return new CoreHttpClient(devTcpTransport(port));
}

describe('CoreHttpClient', () => {
  it('reads the health answer', async () => {
    const client = await serve(() => ({
      status: 200,
      body: { status: 'ok', version: '1.53.0', apiVersion: 1, startedAtUnixMs: 42 },
    }));

    await expect(client.health()).resolves.toEqual({
      status: 'ok',
      version: '1.53.0',
      apiVersion: 1,
      startedAtUnixMs: 42,
    });
  });

  it('names the core host and never sends an Origin', async () => {
    const client = await serve(() => ({ status: 200, body: {} }));

    await client.get('/api/v1/health');

    expect(seen[0].headers.host).toBe('agentmate-core');
    expect(seen[0].headers.origin).toBeUndefined();
  });

  it('sends JSON bodies and a bearer token when there is one', async () => {
    const bodies: string[] = [];
    const client = await serve((_request, body) => {
      bodies.push(body);
      return { status: 200, body: { ok: true } };
    });

    await client.post('/api/v1/auth/login', { user: 'owner' }, { token: 'abc' });

    expect(bodies).toEqual(['{"user":"owner"}']);
    expect(seen[0].headers['content-type']).toBe('application/json');
    expect(seen[0].headers.authorization).toBe('Bearer abc');
  });

  it('turns an error status into a readable error', async () => {
    const client = await serve(() => ({ status: 401 }));

    await expect(client.get('/api/v1/session')).rejects.toThrow(
      'The server core refused GET /api/v1/session (401).',
    );
  });

  it('keeps the status and the JSON body of a refusal, for callers that act on its code', async () => {
    const client = await serve(() => ({
      status: 401,
      body: { code: 'deviceRevoked', message: 'This device was revoked.' },
    }));

    const failure = await client.post('/api/v1/auth/login', {}).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CoreHttpError);
    expect((failure as CoreHttpError).status).toBe(401);
    expect((failure as CoreHttpError).body).toEqual({
      code: 'deviceRevoked',
      message: 'This device was revoked.',
    });
    expect((failure as Error).message).toBe(
      'The server core refused POST /api/v1/auth/login (401).',
    );
  });

  it('gives up on an answer that takes too long', async () => {
    const client = await serve(() => ({ status: 200, body: {}, delayMs: 2000 }));

    await expect(client.get('/api/v1/health', { timeoutMs: 100 })).rejects.toThrow(
      /did not answer/,
    );
  });

  it('opens a new stream for every request', async () => {
    const client = await serve(() => ({ status: 200, body: {} }));
    const open = vi.spyOn(client.transport, 'openStream');

    await client.get('/api/v1/health');
    await client.get('/api/v1/health');

    expect(open).toHaveBeenCalledTimes(2);
  });

  it('explains a transport that cannot connect', async () => {
    const client = new CoreHttpClient(devTcpTransport(1));

    await expect(client.health()).rejects.toThrow(/DevHost/);
  });
});
