import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Project } from '@agentmat/core';
import type { HubConnection, IStreamResult } from '@microsoft/signalr';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  JobInfo,
  JobStreamItem,
} from '../../shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { ICoreHub } from '../../shared/deploy/protocol/generated/TypedSignalR.Client/AgentMate.ServerCore.Contracts';
import { tempDir } from '../../test/main/fixtures';
import { SshConnectionPool } from '../ssh/pool';
import { CoreSessions } from './auth/coreSessions';
import { localArtifactSource } from './bootstrap/releaseSource';
import { CoreHttpClient } from './connection/coreHttp';
import { coreHub, createCoreHubConnection } from './connection/coreHub';
import { streamLocalTransport } from './connection/transport';
import { DeployService } from './service';
import { buildContextTarball } from './stacks/buildContext';
import { DeployStacks } from './stacks/service';
import { DeployState } from './state';
import {
  startTestServer,
  systemTestsEnabled,
  TEST_LOGINS,
  type TestServer,
} from './testing/testServers';

/**
 * Private registries on a real server (E08 AC1): a registry:2 with htpasswd runs on the test
 * server, an image is pushed to it under a separate pushing user, and an app deploys from it
 * through the same DeployStacks the app uses, with the pulling user's token sent per deploy.
 * After a deploy that succeeded and after one that failed, the whole filesystem (and the core's
 * journal) is searched for the token and for the base64 form docker writes: neither is there.
 * Needs AGENTMATE_SYSTEM_TESTS=1, Docker, network access from the test server for Docker's
 * packages, and `pnpm server-core:publish linux-x64`.
 */

const enabled = systemTestsEnabled();
const REPO = fileURLToPath(new URL('../../../../../', import.meta.url));
const ARTIFACTS = join(REPO, 'apps', 'server-core', 'artifacts', 'release');
const PASSWORD = 'correct horse battery staple';
const TEST_TIMEOUT_MS = 2_400_000;

/** The puller's token is what must never stay behind; the pusher only fills the registry. */
const PULLER = 'puller';
const TOKEN = 'regtoken-e08-pull-7f3a9c41d2b6';
const PUSHER = 'pusher';
const PUSH_PASSWORD = 'regpush-e08-5b1e8d';
/** bcrypt lines (golang.org/x/crypto/bcrypt, cost 5, as registry:2 reads them) for the two users above. */
const HTPASSWD = [
  'puller:$2a$05$Dd4yy7wbltwZ65/oyLlsm.7t0S.MkFew0/1.JX7X/Q61FfmLfcHxW',
  'pusher:$2a$05$7r5reuzkZNfz3B7eH5GUiOmUgxpa8tU7N0EoyQauYYaP/OPK22Swa',
].join('\n');
const REGISTRY = 'localhost:5000';
const IMAGE = `${REGISTRY}/private/web:1`;

const compose = (image: string) => `services:
  web:
    image: ${image}
    command: ["httpd", "-f", "-p", "8080", "-h", "/"]
    restart: unless-stopped
    ports:
      - "8091:8080"
`;

const servers: TestServer[] = [];
const cleanups: Array<() => void> = [];

afterEach((context) => {
  if (context.task.result?.state === 'fail') {
    // biome-ignore lint/suspicious/noConsole: the CI log is all there is to see where a run stopped
    console.log(servers.map((server) => server.diagnose()).join('\n'));
  }
  for (const cleanup of cleanups.splice(0)) cleanup();
  for (const server of servers.splice(0)) server.stop();
});

function containerOf(server: TestServer): string {
  const lines = execFileSync('docker', ['ps', '--format', '{{.ID}} {{.Ports}}'], {
    encoding: 'utf-8',
  });
  const mapping = `:${server.port}->22/tcp`;
  return (
    lines
      .split('\n')
      .find((entry) => entry.includes(mapping))
      ?.split(' ')[0] ?? ''
  );
}

/** A command on the test server; its input (if any) goes through stdin, never argv. */
function onServer(server: TestServer, command: string, input?: string): string {
  return execFileSync('docker', ['exec', '-i', containerOf(server), 'sh', '-c', command], {
    encoding: 'utf-8',
    timeout: 900_000,
    killSignal: 'SIGKILL',
    stdio: 'pipe',
    ...(input === undefined ? {} : { input }),
  }).trim();
}

function loadImage(server: TestServer, image: string): void {
  try {
    execFileSync('docker', ['image', 'inspect', image], { stdio: 'pipe' });
  } catch {
    execFileSync('docker', ['pull', image], { stdio: 'pipe', timeout: 600_000 });
  }
  const archive = execFileSync('docker', ['save', image], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('docker', ['exec', '-i', containerOf(server), 'docker', 'load'], {
    input: archive,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 300_000,
  });
}

function streamUntil<T>(stream: IStreamResult<T>, done: (items: T[]) => boolean, ms: number) {
  return new Promise<T[]>((resolve, reject) => {
    const items: T[] = [];
    const timer = setTimeout(() => {
      subscription.dispose();
      reject(new Error(`The stream did not finish: ${JSON.stringify(items).slice(-3_000)}`));
    }, ms);
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      subscription.dispose();
      if (error) reject(error);
      else resolve(items);
    };
    const subscription = stream.subscribe({
      next: (item) => {
        items.push(item);
        if (done(items)) finish();
      },
      error: (error) => finish(error),
      complete: () => (done(items) ? finish() : finish(new Error('The stream ended early.'))),
    });
  });
}

async function runJob(hub: ICoreHub, job: JobInfo, timeoutMs: number) {
  const items = await streamUntil<JobStreamItem>(
    hub.streamJob(job.id, 0),
    (seen) => seen.some((item) => item.job && item.job.state !== 'running'),
    timeoutMs,
  );
  const final = [...items].reverse().find((item) => item.job)?.job;
  return { final, log: items.flatMap((item) => item.lines.map((line) => line.text)) };
}

async function installAndConnect(server: TestServer) {
  const { username, password } = TEST_LOGINS.root;
  const pool = new SshConnectionPool({
    endpoint: async () => ({
      host: server.host,
      port: server.port,
      username,
      authMethod: 'password',
      password,
    }),
    trustHostKey: async () => undefined,
  });
  let file: unknown = null;
  const state = new DeployState({
    read: async () => file,
    write: async (value) => {
      file = value;
    },
  });
  const seal = async (plaintext: string) => ({
    mode: 'safeStorage' as const,
    ciphertext: Buffer.from(plaintext).toString('base64'),
  });
  const unseal = async (envelope: { ciphertext: string }) =>
    Buffer.from(envelope.ciphertext, 'base64').toString();
  const service = new DeployService({
    servers: async () => [
      {
        id: 'srv',
        nickname: 'Test server',
        host: server.host,
        port: server.port,
        username,
        authMethod: 'password',
        secretEnvelope: 'saved',
      },
    ],
    pool,
    state,
    releases: localArtifactSource(ARTIFACTS),
    seal,
    unseal,
    deviceName: () => 'Registries system test',
    availableVersion: async () => '0.0.0-dev',
    devCorePort: null,
    progress: () => undefined,
  });
  const installed = await service.install({
    serverId: 'srv',
    sudoPassword: null,
    account: { userName: 'maria', password: PASSWORD },
  });
  expect(installed.enrollmentError).toBeUndefined();
  const lease = await pool.acquire('srv');
  const transport = streamLocalTransport(lease.connection);
  const sessions = new CoreSessions({
    state,
    unseal,
    withCore: (_serverId, work) => work(new CoreHttpClient(transport)),
  });
  await sessions.signIn('srv', { password: PASSWORD });
  const connection: HubConnection = createCoreHubConnection(transport, () =>
    sessions.accessToken('srv'),
  );
  await connection.start();
  return {
    hub: coreHub(connection),
    transport,
    sessions,
    stop: () => {
      void connection.stop();
      lease.release();
      pool.closeAll();
    },
  };
}

/** Every file on the server holding the token or its base64 form, and journal lines with it. */
function tokenTraces(server: TestServer): string {
  const base64 = Buffer.from(`${PULLER}:${TOKEN}`).toString('base64');
  // The patterns come in on stdin, so the search itself never has them on a command line.
  const files = onServer(
    server,
    'grep -rlF -f /dev/stdin / --exclude-dir=proc --exclude-dir=sys --exclude-dir=dev 2>/dev/null || true',
    `${TOKEN}\n${base64}\n`,
  );
  const journal = onServer(
    server,
    'journalctl -u agentmate-core --no-pager -o cat | grep -cF -f /dev/stdin || true',
    `${TOKEN}\n${base64}\n`,
  );
  return [files, journal === '0' ? '' : `journal lines: ${journal}`].filter(Boolean).join('\n');
}

describe.skipIf(!enabled)('Private registries through the server core on a real server', () => {
  it(
    'pulls a private image with a per-deploy token and leaves no trace of it, even after a failure',
    async () => {
      const server = await startTestServer('ubuntu-24.04');
      servers.push(server);
      const { hub, transport, sessions, stop } = await installAndConnect(server);
      cleanups.push(stop);

      let docker = await runJob(
        hub,
        await hub.installDocker({ removeConflictingPackages: true }),
        1_200_000,
      );
      for (let attempt = 1; attempt < 3 && docker.final?.state !== 'succeeded'; attempt++) {
        docker = await runJob(
          hub,
          await hub.installDocker({ removeConflictingPackages: true }),
          1_200_000,
        );
      }
      expect(docker.final?.state, docker.log.slice(-40).join('\n')).toBe('succeeded');
      // The sign-in folder lives in the core's runtime directory, which must be a tmpfs.
      expect(onServer(server, 'findmnt -T /run/agentmate-core -no FSTYPE')).toBe('tmpfs');

      // A registry:2 with htpasswd, and the image pushed by the other user from a throwaway config.
      loadImage(server, 'registry:2');
      loadImage(server, 'busybox:1.37');
      onServer(
        server,
        'mkdir -p /srv/registry-auth && cat > /srv/registry-auth/htpasswd',
        `${HTPASSWD}\n`,
      );
      onServer(
        server,
        'docker run -d --name registry --restart unless-stopped -p 127.0.0.1:5000:5000 -v /srv/registry-auth:/auth -e REGISTRY_AUTH=htpasswd -e REGISTRY_AUTH_HTPASSWD_REALM=e2e -e REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd registry:2',
      );
      onServer(
        server,
        'for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:5000/v2/ && break; sleep 1; done',
      );
      onServer(
        server,
        `export DOCKER_CONFIG=$(mktemp -d) && docker login ${REGISTRY} -u ${PUSHER} --password-stdin && docker tag busybox:1.37 ${IMAGE} && docker push ${IMAGE} && rm -rf "$DOCKER_CONFIG" && docker rmi ${IMAGE}`,
        PUSH_PASSWORD,
      );
      // Without a sign-in the registry refuses the pull.
      expect(onServer(server, `docker pull ${IMAGE} 2>&1 || true`)).toMatch(
        /unauthorized|no basic auth/,
      );

      // The search finds a planted copy, so an empty answer later means there is none.
      onServer(server, 'cat > /var/tmp/token-canary', TOKEN);
      expect(tokenTraces(server)).toContain('/var/tmp/token-canary');
      onServer(server, 'rm -f /var/tmp/token-canary');
      expect(tokenTraces(server)).toBe('');

      const folder = tempDir('agentmate-registry-system-');
      const write = (text: string) => {
        mkdirSync(dirname(join(folder, 'compose.yaml')), { recursive: true });
        writeFileSync(join(folder, 'compose.yaml'), text);
      };
      write(compose(IMAGE));
      const sent: string[][] = [];
      const stacks = new DeployStacks({
        links: { call: (_serverId, work) => work(hub) },
        roles: () => ['owner'],
        http: async (_serverId, work) =>
          work(new CoreHttpClient(transport), await sessions.accessToken('srv')),
        source: {
          project: async () => ({ id: 'p1', name: 'Private', folderPath: folder }) as Project,
          index: async (root) => ({ root, files: ['compose.yaml'], truncated: false }),
          environment: async () => ({ id: 'e1', name: 'Production', files: [], entries: [] }),
        },
        pack: buildContextTarball,
        registryAuths: async (_serverId, _stackId, registries) => {
          sent.push(registries);
          return registries.includes(REGISTRY)
            ? [{ registry: REGISTRY, username: PULLER, secret: TOKEN }]
            : [];
        },
      });
      const source = { projectId: 'p1', composePath: 'compose.yaml', environmentId: 'e1' };
      const preview = await stacks.preview(source);
      const first = await stacks.create({
        ...source,
        serverId: 'srv',
        name: 'private',
        proxiedServices: ['web'],
        acknowledgedRisks: preview.requiresAcknowledgment,
      });
      expect(first.revision.state, first.revision.error).toBe('ready');

      const deployed = await runJob(hub, await stacks.deploy('srv', first.stack.id, 1), 900_000);
      expect(deployed.final?.state, deployed.log.slice(-60).join('\n')).toBe('succeeded');
      expect(sent).toEqual([[REGISTRY]]);
      expect(deployed.log.join('\n')).toContain(`Signing in to ${REGISTRY} as ${PULLER}`);
      expect(deployed.log.join('\n')).not.toContain(TOKEN);
      expect(onServer(server, `docker image inspect -f '{{.Id}}' ${IMAGE}`)).toMatch(/^sha256:/);
      expect(onServer(server, 'ls -A /run/agentmate-core/registry-auth 2>/dev/null || true')).toBe(
        '',
      );
      expect(tokenTraces(server)).toBe('');

      // A deploy that fails after signing in (the tag does not exist) leaves nothing either.
      write(compose(`${REGISTRY}/private/web:missing`));
      const second = await stacks.upload({
        ...source,
        serverId: 'srv',
        stackId: first.stack.id,
        proxiedServices: ['web'],
        acknowledgedRisks: preview.requiresAcknowledgment,
      });
      const failed = await runJob(
        hub,
        await stacks.deploy('srv', first.stack.id, second.revision.number),
        900_000,
      );
      expect(failed.final?.state, failed.log.slice(-60).join('\n')).toBe('failed');
      expect(failed.log.join('\n')).toContain(`Signing in to ${REGISTRY}`);
      expect(failed.log.join('\n')).not.toContain(TOKEN);
      expect(onServer(server, 'ls -A /run/agentmate-core/registry-auth 2>/dev/null || true')).toBe(
        '',
      );
      expect(tokenTraces(server)).toBe('');
    },
    TEST_TIMEOUT_MS,
  );
});
