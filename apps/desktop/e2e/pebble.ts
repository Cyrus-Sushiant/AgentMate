import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Let's Encrypt's Pebble and pebble-challtestsrv for the full-stack run: the server core's own
 * Pebble harness (PebbleFixture.cs in the system tests) with the same images and configuration,
 * HTTP-01 on port 80 as in PebbleOnPort80Fixture, so Pebble checks a domain against the nginx the
 * core runs. Both sit on a Docker network of their own, which a test server joins; challtestsrv is
 * the test DNS Pebble asks for every name, and `mapDomain` points a name at the test server.
 *
 * The test server reaches Pebble's API as `https://pebble:14000/dir` (Pebble's own certificate
 * names `pebble`), and trusts Pebble's test CA once `trustOn` has added it to the system store.
 * Everything here is created with a random suffix and removed by `stop`.
 */

const PEBBLE_IMAGE = 'ghcr.io/letsencrypt/pebble:2.10.1';
const CHALLTESTSRV_IMAGE = 'ghcr.io/letsencrypt/pebble-challtestsrv:2.10.1';
const MANAGEMENT_PORT = 8055;

/** Pebble's test configuration with Retry-After cut to a second and one 90-day profile. */
const CONFIGURATION = JSON.stringify({
  pebble: {
    listenAddress: '0.0.0.0:14000',
    managementListenAddress: '0.0.0.0:15000',
    certificate: 'test/certs/localhost/cert.pem',
    privateKey: 'test/certs/localhost/key.pem',
    httpPort: 80,
    tlsPort: 5001,
    ocspResponderURL: '',
    externalAccountBindingRequired: false,
    domainBlocklist: ['blocked-domain.example'],
    retryAfter: { authz: 1, order: 1 },
    keyAlgorithm: 'ecdsa',
    profiles: { default: { description: 'Ninety days', validityPeriod: 7_776_000 } },
  },
});

/** The directory URL a test server uses, through the `pebble` name `trustOn` writes to /etc/hosts. */
export const PEBBLE_DIRECTORY = 'https://pebble:14000/dir';

export interface Pebble {
  /** The Docker network Pebble, challtestsrv and the test server share. */
  network: string;
  /** Joins a test server to Pebble's network, and returns its address there. */
  connect: (container: string) => string;
  /** Points `domain` at `address` in the test DNS, as a real A record would. */
  mapDomain: (domain: string, address: string) => Promise<void>;
  /** Pebble's test CA, PEM, for the test server's trust store. */
  rootPem: string;
  /** Pebble's own address on its network, for the test server's /etc/hosts. */
  address: string;
  stop: () => void;
}

function docker(args: string[], timeout = 60_000): string {
  return execFileSync('docker', args, {
    encoding: 'utf-8',
    timeout,
    killSignal: 'SIGKILL',
    stdio: 'pipe',
  }).trim();
}

/** Registry pulls fail now and then on a slow network; three tries before giving up. */
function ensureImage(image: string): void {
  try {
    docker(['image', 'inspect', '--format', '{{.Id}}', image]);
    return;
  } catch {
    // Not here yet.
  }
  for (let attempt = 1; ; attempt++) {
    try {
      docker(['pull', '--quiet', image], 600_000);
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

function addressOn(container: string, network: string): string {
  return docker([
    'inspect',
    '--format',
    `{{(index .NetworkSettings.Networks "${network}").IPAddress}}`,
    container,
  ]);
}

function post(port: number, path: string, body: unknown): Promise<number> {
  return new Promise((resolve, reject) => {
    const call = request(
      { host: '127.0.0.1', port, path: `/${path}`, method: 'POST' },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    call.once('error', reject);
    call.setTimeout(5_000, () => call.destroy(new Error(`challtestsrv did not answer ${path}`)));
    call.end(JSON.stringify(body));
  });
}

async function postChecked(port: number, path: string, body: unknown): Promise<void> {
  const status = await post(port, path, body);
  if (status !== 200) throw new Error(`challtestsrv answered ${path} with ${status}`);
}

export async function startPebble(): Promise<Pebble> {
  ensureImage(PEBBLE_IMAGE);
  ensureImage(CHALLTESTSRV_IMAGE);
  const suffix = randomBytes(5).toString('hex');
  const network = `agentmate-acme-${suffix}`;
  const pebble = `agentmate-pebble-${suffix}`;
  const challenges = `agentmate-challtestsrv-${suffix}`;
  const created: string[] = [];
  const joined: string[] = [];
  let networkCreated = false;
  const stop = () => {
    for (const container of joined.splice(0)) {
      try {
        docker(['network', 'disconnect', '--force', network, container]);
      } catch {
        // The test server is gone already.
      }
    }
    for (const container of created.splice(0)) {
      try {
        docker(['rm', '--force', container]);
      } catch {
        // Already gone.
      }
    }
    if (networkCreated) {
      try {
        docker(['network', 'rm', network]);
      } catch {
        // Left behind only if something still holds it.
      }
      networkCreated = false;
    }
  };

  try {
    docker(['network', 'create', network]);
    networkCreated = true;

    // challtestsrv: DNS on 8053 and HTTP-01 on 5002 for every name, no AAAA answers (so Pebble
    // never tries IPv6), and the HTTPS, TLS-ALPN and DoH servers off.
    created.push(challenges);
    docker([
      'run',
      '--detach',
      '--name',
      challenges,
      '--network',
      network,
      '--publish',
      `127.0.0.1::${MANAGEMENT_PORT}`,
      CHALLTESTSRV_IMAGE,
      '-defaultIPv6',
      '',
      '-https01',
      '',
      '-tlsalpn01',
      '',
      '-doh',
      '',
    ]);
    const challengeAddress = addressOn(challenges, network);
    const mapping = docker(['port', challenges, `${MANAGEMENT_PORT}/tcp`]).split('\n')[0] ?? '';
    const managementPort = Number(mapping.slice(mapping.lastIndexOf(':') + 1));
    const deadline = Date.now() + 30_000;
    for (;;) {
      try {
        await postChecked(managementPort, 'set-default-ipv4', { ip: challengeAddress });
        break;
      } catch (error) {
        if (Date.now() > deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    // Pebble: strict, no artificial validation delays, DNS from challtestsrv. Created first so
    // the configuration can be copied in before it starts.
    created.push(pebble);
    docker([
      'create',
      '--name',
      pebble,
      '--network',
      network,
      '--env',
      'PEBBLE_VA_NOSLEEP=1',
      PEBBLE_IMAGE,
      '-config',
      '/test/config/agentmate.json',
      '-strict',
      '-dnsserver',
      `${challengeAddress}:8053`,
    ]);
    const folder = mkdtempSync(join(tmpdir(), 'agentmate-pebble-'));
    let rootPem: string;
    try {
      writeFileSync(join(folder, 'agentmate.json'), CONFIGURATION);
      docker(['cp', join(folder, 'agentmate.json'), `${pebble}:/test/config/agentmate.json`]);
      docker(['cp', `${pebble}:/test/certs/pebble.minica.pem`, join(folder, 'minica.pem')]);
      rootPem = readFileSync(join(folder, 'minica.pem'), 'utf-8');
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
    docker(['start', pebble]);
    const address = addressOn(pebble, network);

    return {
      connect: (container) => {
        docker(['network', 'connect', network, container]);
        joined.push(container);
        return addressOn(container, network);
      },
      mapDomain: (domain, target) =>
        postChecked(managementPort, 'add-a', { host: `${domain}.`, addresses: [target] }),
      network,
      rootPem,
      address,
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}
