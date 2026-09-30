import { execFileSync } from 'node:child_process';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

/**
 * Disposable Linux servers for system tests: the images in `apps/server-core/test-servers`, with
 * systemd as PID 1 and sshd, started privileged on a free local port. Each has a root login and a
 * `deployer` whose sudo asks for its password. Only runs with AGENTMATE_SYSTEM_TESTS=1, since a
 * test boots whole machines.
 *
 * On an Ubuntu host with AppArmor (24.04 and later), the host's `unix-chkpwd` profile confines the
 * Rocky server's unix_chkpwd too, and every password login there fails. CI unloads that profile
 * first (see the "Let the Rocky test server check passwords" step in test.yml); do the same there
 * before running these tests on such a machine.
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
  /** What the machine looked like when a test failed: boot state, sshd, and the journal's tail. */
  diagnose: () => string;
  stop: () => void;
}

const IMAGES_DIR = fileURLToPath(
  new URL('../../../../../server-core/test-servers/', import.meta.url),
);

/**
 * SIGKILL on timeout: execFileSync waits for its child to exit and has no fallback, so a docker
 * CLI that shrugs off SIGTERM would otherwise block the whole test run.
 */
function docker(args: string[], timeout = 60_000): string {
  return execFileSync('docker', args, {
    encoding: 'utf-8',
    timeout,
    killSignal: 'SIGKILL',
    stdio: 'pipe',
  }).trim();
}

const BOOT_TIMEOUT_MS = 120_000;

/**
 * Waits for systemd to finish booting, asking again every second rather than with `--wait`,
 * whose wait has no end if a unit never settles. A boot that never finishes is reported, not
 * waited on: sshd may well be up anyway.
 */
async function waitForBoot(run: (command: string) => string): Promise<string> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let state = 'unknown';
  while (Date.now() < deadline) {
    try {
      state = run('systemctl is-system-running 2>/dev/null || true') || 'unknown';
    } catch (error) {
      state = `unknown (${String(error)})`;
    }
    if (state === 'running' || state === 'degraded') return state;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return `still ${state} after ${BOOT_TIMEOUT_MS / 1000} seconds`;
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
  // A private cgroup namespace, the setup systemd supports on cgroup v2 hosts. The host's own
  // namespace, with its cgroup tree mounted in, lets the container's systemd collide with the
  // host's where the host runs systemd too (GitHub's runners): boots that never finish there, and
  // sshd turning passwords down.
  docker([
    'run',
    '-d',
    '--rm',
    '--name',
    name,
    '--privileged',
    '--cgroupns=private',
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
  let boot = 'not checked';
  const diagnose = () => {
    const look = (command: string) => {
      try {
        return run(command);
      } catch (error) {
        return `(${String(error)})`;
      }
    };
    return [
      `Boot: ${boot}; now ${look('systemctl is-system-running 2>&1 || true')}`,
      `Failed units: ${look('systemctl --failed --no-legend --plain 2>&1 || true') || 'none'}`,
      `PID 1 cgroup: ${look('cat /proc/1/cgroup')}`,
      `sshd: ${look("pid=$(pgrep -o sshd); grep -E '^(Uid|CapEff|CapBnd)' /proc/$pid/status | tr '\\n' ' '")}`,
      `Shadow: ${look('ls -l /etc/shadow')}`,
      `SELinux: ${look('(getenforce 2>&1 || echo no getenforce); grep -c selinuxfs /proc/mounts || true')}`,
      `Journal:\n${look('journalctl --no-pager -n 150 2>&1 | tail -150')}`,
    ].join('\n');
  };
  try {
    const mapping = docker(['port', name, '22/tcp']).split('\n')[0] ?? '';
    const port = Number(mapping.slice(mapping.lastIndexOf(':') + 1));
    // "degraded" is fine for a container (some units have nothing to do there).
    boot = await waitForBoot(run);
    if (options.streamLocal === false) {
      run(
        "sed -i '/^AllowStreamLocalForwarding/d' /etc/ssh/sshd_config && echo 'AllowStreamLocalForwarding no' >> /etc/ssh/sshd_config && (systemctl restart ssh 2>/dev/null || systemctl restart sshd)",
      );
    }
    await waitForBanner('127.0.0.1', port, Date.now() + 120_000);
    return { host: '127.0.0.1', port, run, diagnose, stop };
  } catch (error) {
    const details = diagnose();
    stop();
    throw new Error(`The ${image} test server did not come up: ${String(error)}\n${details}`);
  }
}
