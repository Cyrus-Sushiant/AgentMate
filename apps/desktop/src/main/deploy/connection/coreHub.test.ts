import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { coreHub, createCoreHubConnection } from './coreHub';
import { devTcpTransport } from './transport';

/**
 * The hub connection rides the same transport as REST: the WebSocket upgrade goes through the
 * tunnel, names the core's host and carries the access token as a header, and the typed client
 * generated from the C# contract talks to it.
 */

const RECORD_SEPARATOR = '\u001e';

let http: Server | null = null;
let sockets: WebSocketServer | null = null;

afterEach(async () => {
  sockets?.close();
  await new Promise<void>((resolve) => (http ? http.close(() => resolve()) : resolve()));
  http = null;
  sockets = null;
});

/** Just enough of the SignalR JSON protocol: the handshake, and an answer to Ping. */
async function fakeHub(): Promise<{ port: number; upgrades: IncomingMessage[] }> {
  const upgrades: IncomingMessage[] = [];
  const listening = createServer();
  http = listening;
  sockets = new WebSocketServer({ server: listening });
  sockets.on('connection', (socket, request) => {
    upgrades.push(request);
    socket.on('message', (data) => {
      for (const frame of String(data).split(RECORD_SEPARATOR).filter(Boolean)) {
        const message = JSON.parse(frame);
        if ('protocol' in message) {
          socket.send(`{}${RECORD_SEPARATOR}`);
        } else if (message.type === 1 && message.target === 'Ping') {
          socket.send(
            `${JSON.stringify({ type: 3, invocationId: message.invocationId, result: { serverTimeUnixMs: 123 } })}${RECORD_SEPARATOR}`,
          );
        }
      }
    });
  });
  const port = await new Promise<number>((resolve) => {
    listening.listen(0, '127.0.0.1', () => resolve((listening.address() as AddressInfo).port));
  });
  return { port, upgrades };
}

describe('createCoreHubConnection', () => {
  it('reaches the hub through the transport and calls it through the generated client', async () => {
    const { port, upgrades } = await fakeHub();
    const connection = createCoreHubConnection(devTcpTransport(port), () => 't0k');

    try {
      await connection.start();
      const pong = await coreHub(connection).ping();

      expect(pong).toEqual({ serverTimeUnixMs: 123 });
      expect(upgrades[0].url).toBe('/hubs/core');
      expect(upgrades[0].headers.host).toBe('agentmate-core');
      expect(upgrades[0].headers.authorization).toBe('Bearer t0k');
      expect(upgrades[0].headers.origin).toBeUndefined();
    } finally {
      await connection.stop();
    }
  });

  it('fails to start when the transport cannot connect', async () => {
    const connection = createCoreHubConnection(devTcpTransport(1), () => 't0k');

    await expect(connection.start()).rejects.toThrow();
  });
});
