import { connect } from 'node:net';
import type { Duplex } from 'node:stream';
import { quoteForShell } from '@agentmat/core';
import type { SshConnection } from '../../ssh/connection';
import { asSocket, type SocketLike } from './socketShim';

/** Where the installer puts the core on every server. */
export const CORE_SOCKET_PATH = '/run/agentmate-core/core.sock';
export const CORE_BINARY_PATH = '/opt/agentmate-core/current/agentmate-core';

export type CoreTransportKind = 'streamlocal' | 'bridge' | 'dev-tcp';

/** A way to open a fresh byte stream to the core's HTTP listener. */
export interface CoreTransport {
  kind: CoreTransportKind;
  openStream: () => Promise<Duplex & SocketLike>;
}

/** The part of an SSH connection the transports need, so tests can hand in a fake. */
export type TunnelSource = Pick<SshConnection, 'openStream' | 'openExecStream'>;

/** A stream-local tunnel through sshd straight to the core's Unix socket. */
export function streamLocalTransport(
  source: TunnelSource,
  socketPath = CORE_SOCKET_PATH,
): CoreTransport {
  return {
    kind: 'streamlocal',
    openStream: async () => asSocket(await source.openStream({ socketPath })),
  };
}

/**
 * The core's own stdio bridge over an exec channel, for servers whose sshd forbids stream-local
 * forwarding. The bridge runs as the SSH user, who reaches the socket through the agentmate group.
 */
export function bridgeTransport(
  source: TunnelSource,
  socketPath = CORE_SOCKET_PATH,
): CoreTransport {
  const command = `${CORE_BINARY_PATH} bridge --socket ${quoteForShell(socketPath, 'posix')}`;
  return {
    kind: 'bridge',
    openStream: async () => asSocket(await source.openExecStream(command)),
  };
}

/** Loopback TCP to the DevHost. Only development builds offer it (see `devCore.ts`). */
export function devTcpTransport(port: number, host = '127.0.0.1'): CoreTransport {
  return {
    kind: 'dev-tcp',
    openStream: () =>
      new Promise((resolve, reject) => {
        const socket = connect({ host, port });
        socket.once('connect', () => resolve(socket));
        socket.once('error', (error) =>
          reject(new Error(`Could not reach the DevHost on ${host}:${port}: ${error.message}`)),
        );
      }),
  };
}
