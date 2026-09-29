import { Socket } from 'node:net';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { asSocket } from './socketShim';

/**
 * An SSH channel is a plain Duplex, but `node:http` and `ws` treat the stream under a connection
 * as a socket and call a few socket-only methods on it. The shim makes those harmless.
 */
describe('asSocket', () => {
  it('adds the socket methods http and ws call, each returning the stream', () => {
    const stream = new PassThrough();

    const socket = asSocket(stream);

    expect(socket.setTimeout(0)).toBe(socket);
    expect(socket.setNoDelay(true)).toBe(socket);
    expect(socket.setKeepAlive(true, 1000)).toBe(socket);
    expect(socket.ref()).toBe(socket);
    expect(socket.unref()).toBe(socket);
  });

  it('still carries data both ways', async () => {
    const socket = asSocket(new PassThrough());
    const received = new Promise<string>((resolve) =>
      socket.once('data', (chunk) => resolve(String(chunk))),
    );

    socket.write('ping');

    expect(await received).toBe('ping');
  });

  it('runs a timeout callback when a timeout is reported', () => {
    const socket = asSocket(new PassThrough());
    const onTimeout = vi.fn();

    socket.setTimeout(5000, onTimeout);
    socket.emit('timeout');

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('leaves a real socket alone', () => {
    const real = new Socket();
    const setNoDelay = real.setNoDelay;

    expect(asSocket(real).setNoDelay).toBe(setNoDelay);
    real.destroy();
  });
});
