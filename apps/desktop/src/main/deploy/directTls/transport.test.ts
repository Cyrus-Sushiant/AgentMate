import { X509Certificate } from 'node:crypto';
import { type AddressInfo, createServer as createTcpServer } from 'node:net';
import { createServer, type Server, type TLSSocket } from 'node:tls';
import { afterEach, describe, expect, it } from 'vitest';
import { coreErrorCode } from '../../../shared/coreErrors';
import { createDeviceKey } from '../auth/deviceKey';
import { clientCertificate } from './clientCertificate';
import {
  DirectTlsUnreachableError,
  directTlsTransport,
  PinMismatchError,
  spkiPin,
} from './transport';

/** A loopback TLS server with a self-signed P-256 certificate, standing in for the core. */
async function startServer(): Promise<{
  server: Server;
  port: number;
  pin: string;
  peers: string[];
  received: string[];
}> {
  const serverKey = createDeviceKey();
  const made = clientCertificate(serverKey.privateKeyPem);
  const peers: string[] = [];
  const received: string[] = [];
  const server = createServer(
    { key: made.key, cert: made.certificate, requestCert: true, rejectUnauthorized: false },
    (socket: TLSSocket) => {
      const peer = socket.getPeerX509Certificate();
      peers.push(
        peer ? peer.publicKey.export({ format: 'der', type: 'spki' }).toString('base64') : '',
      );
      socket.on('data', (chunk) => received.push(chunk.toString('utf8')));
      socket.on('error', () => undefined);
      socket.write('hello');
    },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, port, pin: spkiPin(new X509Certificate(made.certificate)), peers, received };
}

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('directTlsTransport', () => {
  it('connects with the device key as client certificate when the pin matches', async () => {
    const core = await startServer();
    servers.push(core.server);
    const device = createDeviceKey();
    const transport = directTlsTransport(
      { host: '127.0.0.1', port: core.port, pin: core.pin },
      async () => clientCertificate(device.privateKeyPem),
    );

    const stream = await transport.openStream();
    const greeting = await new Promise<string>((resolve) =>
      stream.once('data', (chunk: Buffer) => resolve(chunk.toString('utf8'))),
    );
    stream.destroy();

    expect(transport.kind).toBe('direct-tls');
    expect(greeting).toBe('hello');
    expect(core.peers).toEqual([device.publicKey]);
  });

  it('refuses a server whose key is not the pinned one, before writing anything', async () => {
    const core = await startServer();
    servers.push(core.server);
    const device = createDeviceKey();
    const transport = directTlsTransport(
      { host: '127.0.0.1', port: core.port, pin: Buffer.alloc(32).toString('base64') },
      async () => clientCertificate(device.privateKeyPem),
    );

    const error = await transport.openStream().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PinMismatchError);
    expect(coreErrorCode(error)).toBe('tlsPinMismatch');
    expect((error as PinMismatchError).actual).toBe(core.pin);
    expect((error as Error).message).toMatch(/pinned over SSH/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(core.received).toEqual([]);
  });

  it('says the port is unreachable when nothing listens', async () => {
    const core = await startServer();
    const port = core.port;
    await new Promise<void>((resolve) => core.server.close(() => resolve()));
    const device = createDeviceKey();
    const transport = directTlsTransport({ host: '127.0.0.1', port, pin: core.pin }, async () =>
      clientCertificate(device.privateKeyPem),
    );

    const error = await transport.openStream().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DirectTlsUnreachableError);
    expect(error).not.toBeInstanceOf(PinMismatchError);
  });

  it('gives up on a port that accepts but never shakes hands', async () => {
    const silent = createTcpServer(() => undefined);
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const port = (silent.address() as AddressInfo).port;
    const device = createDeviceKey();
    const transport = directTlsTransport(
      { host: '127.0.0.1', port, pin: 'x' },
      async () => clientCertificate(device.privateKeyPem),
      undefined,
      100,
    );

    const error = await transport.openStream().catch((caught: unknown) => caught);
    silent.close();

    expect(error).toBeInstanceOf(DirectTlsUnreachableError);
    expect((error as Error).message).toMatch(/did not answer in time/);
  });

  it('passes on a failure to unseal the key as it is', async () => {
    const transport = directTlsTransport({ host: '127.0.0.1', port: 1, pin: 'x' }, async () => {
      throw new Error('vault locked');
    });

    await expect(transport.openStream()).rejects.toThrow('vault locked');
  });
});
