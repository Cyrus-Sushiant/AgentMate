import { execFileSync } from 'node:child_process';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

/**
 * Disposable Linux servers for system tests: the images in `apps/server-core/test-servers`, with
 * systemd as PID 1 and sshd, started privileged on a free local port. Each has a root login and a
 * `deployer` whose sudo asks for its password. Only runs with AGENTMATE_SYSTEM_TESTS=1, since a
 * test boots whole machines.
 */

export type TestServerImage = 'ubuntu-24.04' | 'debian-13' | 'rocky-9';

export const TEST_LOGINS = {
  root: { username: 'root', password: 'root-test-pw' },
  deployer: { username: 'deployer', password: 'deployer-test-pw' },
} as const;

export interface TestServer {
  host: string;
  port: number;
  /** Runs a shell command inside the server as root, outside SSH, to look at or change state. */
  run: (command: string) => string;
  stop: () => void;
}

const IMAGES_DIR = fileURLToPath(
  new URL('../../../../../server-core/test-servers/', import.meta.url),
);

function docker(args: string[], timeout = 60_000): string {
  return execFileSync('docker', args, { encoding: 'utf-8', timeout, stdio: 'pipe' }).trim();
}

export function systemTestsEnabled(): boolean {
  if (process.env.AGENTMATE_SYSTEM_TESTS !== '1') return false;
  try {
    return docker(['info', '--format', '{{.OSType}}'], 15_000).toLowerCase() === 'linux';
  } catch {
    return false;
  }
}

function waitForBanner(host: string, port: number, deadline: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect({ host, port });
      socket.setTimeout(2_000);
      const retry = () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`sshd on ${host}:${port} never became ready`));
        else setTimeout(attempt, 300);
      };
      socket.once('data', (chunk) => {
        socket.destroy();
        if (chunk.toString().startsWith('SSH-')) resolve();
        else retry();
      });
      socket.once('error', retry);
      socket.once('timeout', retry);
    };
    attempt();
  });
}

export async function startTestServer(
  image: TestServerImage,
  options: { streamLocal?: boolean } = {},
): Promise<TestServer> {
  const tag = `agentmate-test-server:${image}`;
  try {
    docker(['image', 'inspect', tag]);
  } catch {
    docker(['build', '-q', '-t', tag, `${IMAGES_DIR}${image}`], 1_800_000);
  }
  const name = `agentmate-test-${image}-${process.pid}-${Date.now()}`;
  docker([
    'run',
    '-d',
    '--rm',
    '--name',
    name,
    '--privileged',
    '--cgroupns=host',
    '-v',
    '/sys/fs/cgroup:/sys/fs/cgroup:rw',
    '--tmpfs',
    '/run',
    '--tmpfs',
    '/run/lock',
    '-p',
    '127.0.0.1::22',
    tag,
  ]);
  const stop = () => {
    try {
      docker(['rm', '-f', name]);
    } catch {
      // Already gone.
    }
  };
  const run = (command: string) => docker(['exec', name, 'sh', '-c', command], 120_000);
  try {
    const mapping = docker(['port', name, '22/tcp']).split('\n')[0] ?? '';
    const port = Number(mapping.slice(mapping.lastIndexOf(':') + 1));
    // "degraded" is fine for a container (some units have nothing to do there).
    run('systemctl is-system-running --wait >/dev/null 2>&1 || true');
    if (options.streamLocal === false) {
      run(
        "sed -i '/^AllowStreamLocalForwarding/d' /etc/ssh/sshd_config && echo 'AllowStreamLocalForwarding no' >> /etc/ssh/sshd_config && (systemctl restart ssh 2>/dev/null || systemctl restart sshd)",
      );
    }
    await waitForBanner('127.0.0.1', port, Date.now() + 120_000);
    return { host: '127.0.0.1', port, run, stop };
  } catch (error) {
    stop();
    throw error;
  }
}
