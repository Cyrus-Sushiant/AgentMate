import type { Duplex } from 'node:stream';

/** The socket-only methods `node:http` and `ws` may call on the stream under a connection. */
export interface SocketLike {
  setTimeout(timeout: number, callback?: () => void): this;
  setNoDelay(noDelay?: boolean): this;
  setKeepAlive(enable?: boolean, initialDelay?: number): this;
  ref(): this;
  unref(): this;
}

const DO_NOTHING = ['setNoDelay', 'setKeepAlive', 'ref', 'unref'] as const;

function returnSelf(this: Duplex): Duplex {
  return this;
}

function reportTimeout(this: Duplex, _timeout: number, callback?: () => void): Duplex {
  if (callback) this.once('timeout', callback);
  return this;
}

/**
 * Lets an SSH channel (a plain Duplex) stand in for a TCP socket. The added methods do nothing,
 * which is right for a channel: SSH has its own keepalive, and there is no Nagle to turn off.
 * A real socket keeps its own methods.
 */
export function asSocket<T extends Duplex>(stream: T): T & SocketLike {
  const socket = stream as Duplex & Record<keyof SocketLike, unknown>;
  if (typeof socket.setTimeout !== 'function') socket.setTimeout = reportTimeout;
  for (const name of DO_NOTHING) {
    if (typeof socket[name] !== 'function') socket[name] = returnSelf;
  }
  return stream as T & SocketLike;
}
