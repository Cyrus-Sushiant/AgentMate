/**
 * A throwaway WordPress site in Docker with AgentMate Connector installed from the built zip.
 * Reusable from other tests:
 *
 *   import { startWordPressFixture } from '.../apps/wordpress-connector/tests/smoke/fixture.mjs';
 *   const site = await startWordPressFixture({ port: 18990 });  // { multisite: true } for a network
 *   const key = site.keyFor('write');          // a fresh connection key
 *   site.wp(['plugin', 'activate', 'hello']);  // WP-CLI (returns stdout; { allowFail: true } to not throw)
 *   site.exec('cat /var/www/html/wp-content/themes/x/style.css');
 *   site.writeFile('/var/www/html/wp-content/mu-plugins/x.php', '<?php ...');
 *   site.stop();
 *
 * MariaDB, WordPress (Apache on the same port as the host mapping, so loopback works) and one-off
 * WP-CLI containers share a network. WP_DEBUG logs to wp-content/debug.log, never to the page. The
 * admin user is admin / admin. Everything is named agentmate-wpc-<port>-* and removed by stop(),
 * volumes included. Plain Node only: no packages, no build of the rest of the repo.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = resolve(pluginRoot, '..', '..');
const DB_ENV = [
  '-e',
  'WORDPRESS_DB_HOST=db',
  '-e',
  'WORDPRESS_DB_USER=wp',
  '-e',
  'WORDPRESS_DB_PASSWORD=wp',
  '-e',
  'WORDPRESS_DB_NAME=wp',
];

function docker(args, { allowFail = false, input } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`docker could not run: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) {
    throw new Error(
      `docker ${args.slice(0, 3).join(' ')} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return result;
}

/** WordPress's rewrite rules for a subdirectory network. */
const MULTISITE_HTACCESS = [
  '# BEGIN WordPress Multisite',
  'RewriteEngine On',
  'RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]',
  'RewriteBase /',
  'RewriteRule ^index\\.php$ - [L]',
  'RewriteRule ^([_0-9a-zA-Z-]+/)?wp-admin$ $1wp-admin/ [R=301,L]',
  'RewriteCond %{REQUEST_FILENAME} -f [OR]',
  'RewriteCond %{REQUEST_FILENAME} -d',
  'RewriteRule ^ - [L]',
  'RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) $2 [L]',
  'RewriteRule ^([_0-9a-zA-Z-]+/)?(.*\\.php)$ $2 [L]',
  'RewriteRule . index.php [L]',
  '# END WordPress Multisite',
  '',
].join('\n');

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

/** Builds dist/agentmate-connector.zip when it is not there yet. */
export function connectorZip() {
  const zip = join(pluginRoot, 'dist', 'agentmate-connector.zip');
  if (!existsSync(zip)) {
    const result = spawnSync(
      process.execPath,
      [join(repoRoot, 'scripts', 'wordpress-connector.mjs'), 'build'],
      {
        stdio: 'inherit',
      },
    );
    if (result.status !== 0) throw new Error('Building the connector zip failed.');
  }
  return zip;
}

/**
 * @param {{ port?: number, multisite?: boolean, image?: string, cliImage?: string, dbImage?: string, zip?: string }} [options]
 */
export async function startWordPressFixture(options = {}) {
  const port = options.port ?? 18990;
  const image = options.image ?? 'wordpress:php8.3-apache';
  const cliImage = options.cliImage ?? 'wordpress:cli-php8.3';
  const dbImage = options.dbImage ?? 'mariadb:11';
  const zip = options.zip ?? connectorZip();
  const name = `agentmate-wpc-${port}`;
  const network = `${name}-net`;
  const url = `http://localhost:${port}`;
  const startScript = readFileSync(
    join(pluginRoot, 'tests', 'docker', 'start-apache.sh'),
    'utf8',
  ).replace(/\r\n/g, '\n');

  const stop = () => {
    docker(['rm', '-f', '-v', `${name}-wp`, `${name}-db`], { allowFail: true });
    docker(['network', 'rm', network], { allowFail: true });
  };
  stop();

  try {
    docker(['network', 'create', network]);
    docker([
      'run',
      '-d',
      '--name',
      `${name}-db`,
      '--network',
      network,
      '--network-alias',
      'db',
      '-e',
      'MARIADB_ROOT_PASSWORD=root',
      '-e',
      'MARIADB_DATABASE=wp',
      '-e',
      'MARIADB_USER=wp',
      '-e',
      'MARIADB_PASSWORD=wp',
      dbImage,
    ]);
    docker([
      'run',
      '-d',
      '--name',
      `${name}-wp`,
      '--network',
      network,
      '-p',
      `127.0.0.1:${port}:${port}`,
      '-e',
      `AGENTMATE_PORT=${port}`,
      ...DB_ENV,
      '--mount',
      `type=bind,source=${dirname(zip)},target=/agentmate-dist,readonly`,
      image,
      'sh',
      '-c',
      startScript,
    ]);

    const wp = (args, { allowFail = false } = {}) =>
      docker(
        [
          'run',
          '--rm',
          '--name',
          `${name}-cli-${randomBytes(4).toString('hex')}`,
          '--network',
          network,
          '--volumes-from',
          `${name}-wp`,
          '--user',
          '33:33',
          ...DB_ENV,
          cliImage,
          'wp',
          ...args,
        ],
        { allowFail },
      ).stdout.trim();
    const exec = (command, { allowFail = false } = {}) =>
      docker(['exec', `${name}-wp`, 'sh', '-c', command], { allowFail }).stdout;

    // The image copies WordPress in on first start; then the database has to come up.
    for (let attempt = 0; ; attempt++) {
      if (
        docker(['exec', `${name}-wp`, 'test', '-f', '/var/www/html/wp-config.php'], {
          allowFail: true,
        }).status === 0
      )
        break;
      if (attempt > 120) throw new Error('WordPress did not start.');
      await sleep(1000);
    }
    for (let attempt = 0; ; attempt++) {
      const install = docker(
        [
          'run',
          '--rm',
          '--name',
          `${name}-cli-install`,
          '--network',
          network,
          '--volumes-from',
          `${name}-wp`,
          '--user',
          '33:33',
          ...DB_ENV,
          cliImage,
          'wp',
          'core',
          'install',
          `--url=${url}`,
          '--title=AgentMate Fixture',
          '--admin_user=admin',
          '--admin_password=admin',
          '--admin_email=admin@example.test',
          '--skip-email',
        ],
        { allowFail: true },
      );
      if (install.status === 0) break;
      if (attempt > 60) throw new Error(`WordPress could not be installed: ${install.stderr}`);
      await sleep(2000);
    }
    const writeFile = (path, content) =>
      docker(['exec', '-i', '-u', '33:33', `${name}-wp`, 'sh', '-c', `cat > '${path}'`], {
        input: content,
      });

    wp(['rewrite', 'structure', '/%postname%/', '--hard']);
    // Log every notice, but never print one into a reply.
    wp(['config', 'set', 'WP_DEBUG', 'true', '--raw']);
    wp(['config', 'set', 'WP_DEBUG_LOG', 'true', '--raw']);
    wp(['config', 'set', 'WP_DEBUG_DISPLAY', 'false', '--raw']);
    const zipInContainer = `/agentmate-dist/${zip.split(/[\\/]/).pop()}`;
    if (options.multisite) {
      // A subdirectory network; the connector can only be network-activated.
      wp(['core', 'multisite-convert', '--title=AgentMate Network']);
      writeFile('/var/www/html/.htaccess', MULTISITE_HTACCESS);
      wp(['plugin', 'install', zipInContainer]);
      wp(['plugin', 'activate', 'agentmate-connector', '--network']);
    } else {
      wp(['plugin', 'install', zipInContainer, '--activate']);
    }

    return {
      url,
      port,
      name,
      multisite: options.multisite === true,
      wp,
      exec,
      writeFile,
      /** A new one-time connection key from `wp agentmate key create`. */
      keyFor(scope, { label, expiresIn } = {}) {
        const args = ['agentmate', 'key', 'create', `--scope=${scope}`, '--porcelain'];
        if (label) args.push(`--label=${label}`);
        if (expiresIn) args.push(`--expires-in=${expiresIn}`);
        return wp(args);
      },
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}
