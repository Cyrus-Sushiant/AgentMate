import type { StoredSshServer } from '../../shared/apiTypes';
import type { HealthResponse } from '../../shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type {
  DeployHealth,
  DeployInstallInput,
  DeployInstallResult,
  DeployPreflight,
  DeployServer,
  DeploySetupProgressEvent,
  DeployUninstallInput,
} from '../../shared/deployTypes';
import { TunnelRefusedError } from '../ssh/connection';
import { type InstallerConnection, installCore, uninstallCore } from './bootstrap/installer';
import { runPreflight } from './bootstrap/preflight';
import type { ReleaseSource } from './bootstrap/releaseSource';
import { CoreHttpClient } from './connection/coreHttp';
import {
  bridgeTransport,
  type CoreTransport,
  devTcpTransport,
  streamLocalTransport,
} from './connection/transport';
import type { DeployState } from './state';

/**
 * The Deploy section's main-process side: saved servers with the core each one runs, a preflight,
 * one install or removal at a time per server, and health checks through whichever channel the
 * install found works. Development builds can add the DevHost, reached over loopback TCP.
 */

export const DEV_SERVER_ID = 'devhost';

type SavedServer = Pick<
  StoredSshServer,
  'id' | 'nickname' | 'host' | 'port' | 'username' | 'authMethod'
> & { secretEnvelope?: unknown };

export interface DeployLease {
  connection: InstallerConnection;
  release: () => void;
}

export interface DeployServiceDeps {
  /** The Remote section's saved SSH servers. */
  servers: () => Promise<SavedServer[]>;
  pool: {
    acquire: (serverId: string) => Promise<DeployLease>;
    /** Drops the server's connection, so the next acquire logs in again. */
    reset: (serverId: string) => void;
  };
  state: DeployState;
  releases: ReleaseSource;
  /** The core version this build installs, or null when it has none to offer. */
  availableVersion: () => Promise<string | null>;
  /** What to tell the user when `availableVersion` has nothing, such as how to build one. */
  unavailableReason?: string;
  /** The DevHost's loopback port in a development build, null everywhere else. */
  devCorePort: number | null;
  progress: (event: DeploySetupProgressEvent) => void;
  /** Asks a core for its health; tests pass a fake. */
  healthOf?: (transport: CoreTransport) => Promise<HealthResponse>;
  now?: () => number;
}

const NO_CORE = 'This build of AgentMate has no server core to install.';

export class DeployService {
  private readonly busy = new Set<string>();
  private readonly healthOf: (transport: CoreTransport) => Promise<HealthResponse>;
  private readonly now: () => number;

  constructor(private readonly deps: DeployServiceDeps) {
    this.healthOf = deps.healthOf ?? ((transport) => new CoreHttpClient(transport).health());
    this.now = deps.now ?? Date.now;
  }

  async listServers(): Promise<DeployServer[]> {
    const [saved, cores] = await Promise.all([this.deps.servers(), this.deps.state.all()]);
    const servers: DeployServer[] = saved.map((server) => ({
      id: server.id,
      nickname: server.nickname,
      host: server.host,
      port: server.port,
      username: server.username,
      core: cores[server.id] ?? null,
    }));
    const devHost = this.devHost();
    return devHost ? [devHost, ...servers] : servers;
  }

  async preflight(serverId: string): Promise<DeployPreflight> {
    this.refuseDevHost(serverId);
    const server = await this.saved(serverId);
    const [report, available] = await Promise.all([
      this.withLease(serverId, (lease) => runPreflight(lease.connection)),
      this.deps.availableVersion(),
    ]);
    return {
      os: report.os.name,
      supported: report.os.supported,
      architecture: report.architecture.machine,
      architectureSupported: report.architecture.rid !== null,
      systemd: report.systemd,
      sudo: report.sudo,
      loginUser: report.loginUser,
      hasSavedPassword: server.authMethod === 'password' && Boolean(server.secretEnvelope),
      transport: report.streamLocal === 'prohibited' ? 'bridge' : 'streamlocal',
      selinux: report.selinux,
      freeDiskMb: report.freeDiskMb,
      installed: report.installed ? { version: report.installed.version } : null,
      available,
      problems: available
        ? report.problems
        : [...report.problems, this.deps.unavailableReason ?? NO_CORE],
    };
  }

  async install(input: DeployInstallInput): Promise<DeployInstallResult> {
    this.refuseDevHost(input.serverId);
    return this.exclusive(input.serverId, async () => {
      const installed = await installCore(
        {
          connect: (serverId, options) => {
            if (options?.fresh) this.deps.pool.reset(serverId);
            return this.deps.pool.acquire(serverId);
          },
          releases: this.deps.releases,
          health: (connection, kind) =>
            this.healthOf(
              kind === 'bridge' ? bridgeTransport(connection) : streamLocalTransport(connection),
            ),
        },
        {
          serverId: input.serverId,
          sudoPassword: input.sudoPassword,
          onProgress: (progress) => this.deps.progress({ serverId: input.serverId, progress }),
        },
      );
      await this.deps.state.set(input.serverId, {
        version: installed.version,
        release: installed.release,
        transport: installed.transport,
        installedAt: this.now(),
        os: installed.os,
        architecture: installed.architecture,
      });
      return {
        version: installed.version,
        release: installed.release,
        transport: installed.transport,
        previousVersion: installed.previousVersion,
      };
    });
  }

  async uninstall(input: DeployUninstallInput): Promise<void> {
    this.refuseDevHost(input.serverId);
    return this.exclusive(input.serverId, async () => {
      await uninstallCore(
        { connect: (serverId) => this.deps.pool.acquire(serverId) },
        {
          serverId: input.serverId,
          sudoPassword: input.sudoPassword,
          keepData: input.keepData,
          onProgress: (progress) => this.deps.progress({ serverId: input.serverId, progress }),
        },
      );
      await this.deps.state.remove(input.serverId);
    });
  }

  async health(serverId: string): Promise<DeployHealth> {
    let answer: HealthResponse;
    if (serverId === DEV_SERVER_ID && this.deps.devCorePort !== null) {
      answer = await this.healthOf(devTcpTransport(this.deps.devCorePort));
    } else {
      const record = await this.deps.state.get(serverId);
      if (!record) throw new Error('The server core is not installed on this server yet.');
      answer = await this.withLease(serverId, async (lease) => {
        if (record.transport === 'bridge') return this.healthOf(bridgeTransport(lease.connection));
        try {
          return await this.healthOf(streamLocalTransport(lease.connection));
        } catch (error) {
          // sshd stopped allowing the tunnel since the install; the bridge still gets in.
          if (!(error instanceof TunnelRefusedError)) throw error;
          const bridged = await this.healthOf(bridgeTransport(lease.connection));
          await this.deps.state.set(serverId, { ...record, transport: 'bridge' });
          return bridged;
        }
      });
    }
    return {
      version: answer.version,
      apiVersion: answer.apiVersion,
      startedAtUnixMs: answer.startedAtUnixMs,
      checkedAt: this.now(),
    };
  }

  private devHost(): DeployServer | null {
    const port = this.deps.devCorePort;
    if (port === null) return null;
    return {
      id: DEV_SERVER_ID,
      nickname: 'DevHost',
      host: '127.0.0.1',
      port,
      username: 'dev',
      dev: true,
      core: {
        version: 'dev',
        release: '',
        transport: 'dev-tcp',
        installedAt: 0,
        os: 'DevHost',
        architecture: process.arch,
      },
    };
  }

  private refuseDevHost(serverId: string): void {
    if (serverId === DEV_SERVER_ID && this.deps.devCorePort !== null) {
      throw new Error(
        'The DevHost runs from your checkout, so there is nothing to install or remove.',
      );
    }
  }

  private async saved(serverId: string): Promise<SavedServer> {
    const server = (await this.deps.servers()).find((candidate) => candidate.id === serverId);
    if (!server) throw new Error('This saved server no longer exists.');
    return server;
  }

  private async withLease<T>(
    serverId: string,
    work: (lease: DeployLease) => Promise<T>,
  ): Promise<T> {
    const lease = await this.deps.pool.acquire(serverId);
    try {
      return await work(lease);
    } finally {
      lease.release();
    }
  }

  private async exclusive<T>(serverId: string, work: () => Promise<T>): Promise<T> {
    if (this.busy.has(serverId)) {
      throw new Error(
        'The server core on this server is already being changed. Wait for that to finish.',
      );
    }
    this.busy.add(serverId);
    try {
      return await work();
    } finally {
      this.busy.delete(serverId);
    }
  }
}
