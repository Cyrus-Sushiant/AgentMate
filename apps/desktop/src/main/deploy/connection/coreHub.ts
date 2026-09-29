import {
  HttpTransportType,
  type HubConnection,
  HubConnectionBuilder,
  type IHttpConnectionOptions,
  type ILogger,
} from '@microsoft/signalr';
import WebSocket, { type ClientOptions } from 'ws';
import { getHubProxyFactory } from '../../../shared/deploy/protocol/generated/TypedSignalR.Client';
import type { ICoreHub } from '../../../shared/deploy/protocol/generated/TypedSignalR.Client/AgentMate.ServerCore.Contracts';
import { CORE_HOST } from './coreHttp';
import type { CoreTransport } from './transport';

/**
 * The SignalR connection to a server core, over the same transport as REST. WebSockets only,
 * with no negotiate round trip: the core allows nothing else. In Node, SignalR sends the access
 * token as a header, so it never lands in a URL or a log.
 */

const RECONNECT_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000];

/** SignalR's own logging goes nowhere by default; failures surface through the connection. */
const quietLogger: ILogger = { log: () => undefined };

export function createCoreHubConnection(
  transport: CoreTransport,
  accessToken: () => string | Promise<string>,
  logger: ILogger = quietLogger,
): HubConnection {
  // `ws` hands `createConnection` to node:http, which accepts a callback for sockets that are
  // made asynchronously, like a tunnel opened through SSH.
  const createConnection = ((
    _options: unknown,
    callback: (error: Error | null, socket?: unknown) => void,
  ) => {
    transport.openStream().then(
      (stream) => callback(null, stream),
      (error: Error) => callback(error),
    );
    return undefined;
  }) as unknown as ClientOptions['createConnection'];

  class TunnelWebSocket extends WebSocket {
    constructor(address: string | URL, protocols?: string | string[], options?: ClientOptions) {
      super(address, protocols, { ...options, createConnection });
    }
  }

  // SignalR 10 still reads `WebSocket` from these options (see its HttpConnection), but no
  // longer lists it in the public type. The hub test fails if the tunnel class is ever ignored.
  const options: IHttpConnectionOptions & { WebSocket: unknown } = {
    transport: HttpTransportType.WebSockets,
    skipNegotiation: true,
    WebSocket: TunnelWebSocket,
    accessTokenFactory: accessToken,
    logMessageContent: false,
  };

  return new HubConnectionBuilder()
    .withUrl(`http://${CORE_HOST}/hubs/core`, options)
    .withAutomaticReconnect(RECONNECT_DELAYS_MS)
    .configureLogging(logger)
    .build();
}

/** The typed client generated from the core's `ICoreHub`. */
export function coreHub(connection: HubConnection): ICoreHub {
  return getHubProxyFactory('ICoreHub').createHubProxy(connection);
}
