import { SshConnectionPool } from './pool';
import { savedServerPoolSource } from './savedServers';

/**
 * The one pool of non-interactive connections to saved servers. Deploy and the remote AI
 * history both lease from it, so looking at a server's conversations reuses the connection
 * Deploy already holds instead of logging in a second time.
 */

let pool: SshConnectionPool | null = null;

export function getSshPool(): SshConnectionPool {
  pool ??= new SshConnectionPool(savedServerPoolSource);
  return pool;
}
