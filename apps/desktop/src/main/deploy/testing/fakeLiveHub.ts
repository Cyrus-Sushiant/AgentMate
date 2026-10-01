import { type FakeCore, FakeCoreDown } from '../../../shared/deploy/testing/fakeCore';
import type { FakeCoreConnection } from '../../../shared/deploy/testing/fakeCoreConnection';
import { HubStartError, type LiveHubSession } from '../connection/liveHub';

/**
 * Lasting hub sessions on a `FakeCore`, shaped like `startLiveHub`'s: a core that is down turns
 * the upgrade away with a 503, and each session's token runs out `lifetimeMs` after it opened.
 * `failNext` makes the next opens fail with what a test hands it (a coded sign-in refusal, a
 * locked vault) before the core is ever asked.
 */
export function fakeLiveHubs(core: FakeCore, options: { lifetimeMs?: number } = {}) {
  const connections: FakeCoreConnection[] = [];
  const failures: unknown[] = [];
  let opens = 0;

  const open = async (): Promise<LiveHubSession> => {
    opens += 1;
    const failure = failures.shift();
    if (failure !== undefined) throw failure;
    let connection: FakeCoreConnection;
    try {
      connection = core.connect();
    } catch (error) {
      if (error instanceof FakeCoreDown) {
        throw new HubStartError('WebSocket failed to connect.', error.status);
      }
      throw error;
    }
    connections.push(connection);
    let markClosed: () => void = () => undefined;
    const closed = new Promise<void>((resolve) => {
      markClosed = resolve;
    });
    connection.onClose(() => markClosed());
    return {
      hub: connection,
      closed,
      stop: () => connection.stop(),
      expiresAt: options.lifetimeMs === undefined ? null : core.now() + options.lifetimeMs,
    };
  };

  return {
    open,
    connections,
    /** The connection opened last. */
    latest: () => connections.at(-1),
    opens: () => opens,
    failNext: (...errors: unknown[]) => {
      failures.push(...errors);
    },
  };
}
