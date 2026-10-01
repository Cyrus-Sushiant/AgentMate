import type { CatalogFact, CatalogHealthcheck, CatalogServiceSpec } from '../types.js';

/** Pieces several templates share: their bundled databases, health checks and facts. */

export const fact = (id: string, label: string, value: string, sensitive = false): CatalogFact => ({
  id,
  label,
  value,
  sensitive,
});

/** Where the app answers: its domain when it has one, else its port on the server's loopback. */
export const appUrl = (publicUrl: string | null, port: number) =>
  publicUrl ?? `http://127.0.0.1:${port}`;

/** The host part of an app URL, such as example.com or 127.0.0.1. */
export const urlHost = (url: string) => new URL(url).hostname;

/** A health check through Node's own fetch, for images that ship neither curl nor wget. */
export function nodeHttpCheck(url: string, startPeriod = '1m'): CatalogHealthcheck {
  return {
    test: [
      'CMD',
      'node',
      '-e',
      `fetch('${url}', { redirect: 'manual' }).then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))`,
    ],
    startPeriod,
  };
}

export function curlCheck(url: string, startPeriod = '1m'): CatalogHealthcheck {
  return { test: ['CMD', 'curl', '-fsS', '-o', '/dev/null', url], startPeriod };
}

/** `mysqladmin ping` exits 0 once the server answers on TCP, which it only does after setup. */
export const MYSQL_HEALTHCHECK: CatalogHealthcheck = {
  test: ['CMD-SHELL', 'mysqladmin ping -h 127.0.0.1 --silent'],
  startPeriod: '1m',
};

/** The image's own script, with the healthcheck user it creates on first start. */
export const MARIADB_HEALTHCHECK: CatalogHealthcheck = {
  test: ['CMD', 'healthcheck.sh', '--connect', '--innodb_initialized'],
  startPeriod: '1m',
};

/** MySQL and MariaDB create root themselves and refuse an app user of that name. */
export const notRootUser = (name: string) => name.toLowerCase() !== 'root';
export const NOT_ROOT_MESSAGE = 'root is the administrator account. Pick another name.';

/** The MySQL server an app bundles, reachable only by the app's own containers. */
export function bundledMysql(options: {
  database: string;
  user: string;
  passwordSecret: string;
  rootSecret: string;
}): CatalogServiceSpec {
  return {
    image: 'db',
    environment: {
      MYSQL_ROOT_PASSWORD: { secret: options.rootSecret },
      MYSQL_DATABASE: options.database,
      MYSQL_USER: options.user,
      MYSQL_PASSWORD: { secret: options.passwordSecret },
    },
    volumes: [{ volume: 'db', target: '/var/lib/mysql' }],
    healthcheck: MYSQL_HEALTHCHECK,
  };
}

/** The MariaDB server an app bundles, reachable only by the app's own containers. */
export function bundledMariadb(options: {
  database: string;
  user: string;
  passwordSecret: string;
  rootSecret: string;
  command?: readonly string[];
}): CatalogServiceSpec {
  return {
    image: 'db',
    ...(options.command ? { command: options.command } : {}),
    environment: {
      MARIADB_ROOT_PASSWORD: { secret: options.rootSecret },
      MARIADB_DATABASE: options.database,
      MARIADB_USER: options.user,
      MARIADB_PASSWORD: { secret: options.passwordSecret },
      MARIADB_AUTO_UPGRADE: '1',
    },
    volumes: [{ volume: 'db', target: '/var/lib/mysql' }],
    healthcheck: MARIADB_HEALTHCHECK,
  };
}
