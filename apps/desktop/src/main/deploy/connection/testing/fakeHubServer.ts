import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type WebSocket, WebSocketServer } from 'ws';

/**
 * Just enough of the SignalR JSON protocol on loopback for connection tests: the handshake and
 * an answer to Ping. `refuseWith` answers every upgrade with that status instead, and `drop`
 * cuts every open socket, as a core that restarts or a token that runs out would.
 */

const RECORD_SEPARATOR = '\u001e';

export interface FakeHubServer {
  port: number;
  upgrades: IncomingMessage[];
  drop: () => void;
  close: () => Promise<void>;
}

export async function startFakeHubServer(
  options: { refuseWith?: number } = {},
): Promise<FakeHubServer> {
  const upgrades: IncomingMessage[] = [];
  const open = new Set<WebSocket>();
  const http: Server = createServer();
  const sockets = new WebSocketServer({
    server: http,
    verifyClient: (_info, done) =>
      options.refuseWith ? done(false, options.refuseWith) : done(true),
  });
  sockets.on('connection', (socket, request) => {
    upgrades.push(request);
    open.add(socket);
    socket.on('close', () => open.delete(socket));
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
    http.listen(0, '127.0.0.1', () => resolve((http.address() as AddressInfo).port));
  });
  return {
    port,
    upgrades,
    drop: () => {
      for (const socket of open) socket.terminate();
    },
    close: async () => {
      for (const socket of open) socket.terminate();
      sockets.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
