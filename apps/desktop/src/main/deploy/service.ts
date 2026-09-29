import { hostname } from 'node:os';
import QRCode from 'qrcode';
import type { SecretEnvelope, StoredSshServer } from '../../shared/apiTypes';
import { coreErrorCode, coreErrorMessage } from '../../shared/coreErrors';
import type {
  AccountInfo,
  HealthResponse,
  RecoveryCodes,
  SignedInUser,
  StepUpResponse,
} from '../../shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { ICoreHub } from '../../shared/deploy/protocol/generated/TypedSignalR.Client/AgentMate.ServerCore.Contracts';
import type {
  DeployAccess,
  DeployAccountInput,
  DeployEnrollInput,
  DeployHealth,
  DeployInstallInput,
  DeployInstallResult,
  DeployPreflight,
  DeployServer,
  DeploySetupProgress,
  DeploySetupProgressEvent,
  DeploySignInInput,
  DeployStepUpInput,
  DeployTotpSetup,
  DeployUninstallInput,
} from '../../shared/deployTypes';
import { TunnelRefusedError } from '../ssh/connection';
import { openRootShell } from '../ssh/sudo';
import { type CoreRest, CoreSessions } from './auth/coreSessions';
import { createDeviceKey } from './auth/deviceKey';
import { enrollOverSsh } from './bootstrap/enrollment';
import { type InstallerConnection, installCore, uninstallCore } from './bootstrap/installer';
import { runPreflight } from './bootstrap/preflight';
import type { ReleaseSource } from './bootstrap/releaseSource';
import { CoreHttpClient } from './connection/coreHttp';
import { coreHub, createCoreHubConnection } from './connection/coreHub';
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
 * install found works. This computer enrolls on a core over SSH (with the install or later), signs
 * in with its device key, and manages its account through the hub. Development builds can add the
 * DevHost, reached over loopback TCP, which enrolls a device by itself since it has no SSH.
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

/** A started hub connection and a way to stop it. */
export interface CoreHubSession {
  hub: ICoreHub;
  stop: () => Promise<void>;
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
  /** Seals a device's private key with the Servers vault, and opens it again. */
  seal: (plaintext: string) => Promise<SecretEnvelope>;
  unseal: (envelope: SecretEnvelope) => Promise<string>;
  /** How this computer is named on a core; the host name. */
  deviceName?: () => string;
  /** The core's REST API over a transport; tests pass a fake. */
  rest?: (transport: CoreTransport) => CoreRest;
  /** A started hub connection over a transport; tests pass a fake. */
  hub?: (transport: CoreTransport, accessToken: () => Promise<string>) => Promise<CoreHubSession>;
  now?: () => number;
}

async function startHub(
  transport: CoreTransport,
  accessToken: () => Promise<string>,
): Promise<CoreHubSession> {
  const connection = createCoreHubConnection(transport, accessToken);
  await connection.start();
  return { hub: coreHub(connection), stop: () => connection.stop() };
}

/** The human part of a hub error: SignalR puts what the core said after "HubException: ". */
function hubMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const marker = message.indexOf('HubException: ');
  return marker < 0 ? message : message.slice(marker + 'HubException: '.length);
}

function summary(user: SignedInUser): NonNullable<DeployAccess['user']> {
  return { userName: user.userName, roles: user.roles, twoFactorEnabled: user.twoFactorEnabled };
}

const NO_CORE = 'This build of AgentMate has no server core to install.';

export class DeployService {
  private readonly busy = new Set<string>();
  private readonly healthOf: (transport: CoreTransport) => Promise<HealthResponse>;
  private readonly rest: (transport: CoreTransport) => CoreRest;
  private readonly hubOf: (
    transport: CoreTransport,
    accessToken: () => Promise<string>,
  ) => Promise<CoreHubSession>;
  private readonly sessions: CoreSessions;
  private readonly now: () => number;

  constructor(private readonly deps: DeployServiceDeps) {
    this.healthOf = deps.healthOf ?? ((transport) => new CoreHttpClient(transport).health());
    this.rest = deps.rest ?? ((transport) => new CoreHttpClient(transport));
    this.hubOf = deps.hub ?? startHub;
    this.now = deps.now ?? Date.now;
    this.sessions = new CoreSessions({
      state: deps.state,
      unseal: deps.unseal,
      withCore: (serverId, work) =>
        this.withTransport(serverId, (transport) => work(this.rest(transport))),
      now: this.now,
    });
  }

  async listServers(): Promise<DeployServer[]> {
    const [saved, cores, enrolled] = await Promise.all([
      this.deps.servers(),
      this.deps.state.all(),
      this.deps.state.enrolledServers(),
    ]);
    const servers: DeployServer[] = saved.map((server) => ({
      id: server.id,
      nickname: server.nickname,
      host: server.host,
      port: server.port,
      username: server.username,
      core: cores[server.id] ?? null,
      enrolled: enrolled.has(server.id),
    }));
    const devHost = this.devHost(enrolled.has(DEV_SERVER_ID));
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
      // The core runs from here on, whatever happens to the account setup: that part can be
      // retried from the server's card without installing again.
      let enrollmentError: string | undefined;
      if (input.account) {
        try {
          await this.setUpAccess(input.serverId, input.sudoPassword, input.account);
        } catch (error) {
          enrollmentError = coreErrorMessage(error);
        }
      }
      return {
        version: installed.version,
        release: installed.release,
        transport: installed.transport,
        previousVersion: installed.previousVersion,
        ...(enrollmentError === undefined ? {} : { enrollmentError }),
      };
    });
  }

  /** Enrolls this computer over SSH as a user the core has; a new device key replaces an old one. */
  async enroll(input: DeployEnrollInput): Promise<DeployAccess> {
    this.refuseDevHost(input.serverId);
    await this.exclusive(input.serverId, () =>
      this.setUpAccess(input.serverId, input.sudoPassword, input.account),
    );
    return this.access(input.serverId);
  }

  /** Whether this computer can act on the core right now, renewing its session if it has to. */
  async access(serverId: string): Promise<DeployAccess> {
    if (this.isDevHost(serverId)) await this.ensureDevDevice();
    if (!(await this.deps.state.device(serverId))) return { state: 'not-enrolled' };
    try {
      await this.sessions.accessToken(serverId);
    } catch (error) {
      switch (coreErrorCode(error)) {
        case 'sessionExpired':
        case 'sessionRevoked':
          return { state: 'needs-sign-in' };
        case 'lockedOut':
          return { state: 'needs-sign-in', message: coreErrorMessage(error) };
        case 'deviceRevoked':
        case 'deviceUnknown':
          return { state: 'needs-re-enroll' };
        case 'notEnrolled':
          return { state: 'not-enrolled' };
        default:
          return { state: 'unreachable', message: coreErrorMessage(error) };
      }
    }
    const user = this.sessions.user(serverId);
    return user ? { state: 'signed-in', user: summary(user) } : { state: 'signed-in' };
  }

  async signIn(input: DeploySignInInput): Promise<DeployAccess> {
    const user = await this.sessions.signIn(input.serverId, {
      password: input.password,
      ...(input.totpCode ? { totpCode: input.totpCode } : {}),
      ...(input.recoveryCode ? { recoveryCode: input.recoveryCode } : {}),
    });
    return { state: 'signed-in', user: summary(user) };
  }

  /** Ends the session on the core (when it can be reached) and here. The device stays enrolled. */
  async signOut(serverId: string): Promise<void> {
    try {
      await this.withHub(serverId, (hub) => hub.signOut());
    } catch {
      // Unreachable or already over: the session is dropped here either way.
    }
    this.sessions.forget(serverId);
    const device = await this.deps.state.device(serverId);
    if (device?.sessionId) {
      const { sessionId: _ended, ...rest } = device;
      await this.deps.state.setDevice(serverId, rest);
    }
  }

  /** Drops this run's access tokens for a server, as when the vault locks. */
  forgetTokens(serverId: string): void {
    this.sessions.forget(serverId);
  }

  account(serverId: string): Promise<AccountInfo> {
    return this.withHub(serverId, (hub) => hub.getAccount());
  }

  stepUp(input: DeployStepUpInput): Promise<StepUpResponse> {
    return this.withHub(input.serverId, (hub) =>
      hub.stepUp({
        ...(input.password ? { password: input.password } : {}),
        ...(input.totpCode ? { totpCode: input.totpCode } : {}),
      }),
    );
  }

  async beginTotp(serverId: string): Promise<DeployTotpSetup> {
    const setup = await this.withHub(serverId, (hub) => hub.beginTotpSetup());
    const qrDataUrl = await QRCode.toDataURL(setup.authenticatorUri, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: 'M',
    });
    return { sharedKey: setup.sharedKey, authenticatorUri: setup.authenticatorUri, qrDataUrl };
  }

  async confirmTotp(serverId: string, code: string): Promise<RecoveryCodes> {
    const codes = await this.withHub(serverId, (hub) => hub.confirmTotp(code));
    this.sessions.patchUser(serverId, { twoFactorEnabled: true });
    return codes;
  }

  async disableTotp(serverId: string, code: string): Promise<void> {
    await this.withHub(serverId, (hub) => hub.disableTotp(code));
    this.sessions.patchUser(serverId, { twoFactorEnabled: false });
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
      this.sessions.forget(input.serverId);
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

  /**
   * Creates the owner (on a new core), enrolls a fresh device key over SSH as root, seals the
   * private half and signs in with it. Reports its steps the way an install does.
   */
  private async setUpAccess(
    serverId: string,
    sudoPassword: string | null,
    account: DeployAccountInput,
  ): Promise<void> {
    const emit = (progress: DeploySetupProgress) => this.deps.progress({ serverId, progress });
    const deviceName = (this.deps.deviceName ?? hostname)().slice(0, 100);
    const enrollment = await this.withLease(serverId, async (lease) => {
      const shell = await openRootShell(
        lease.connection,
        sudoPassword ?? lease.connection.endpoint.password ?? null,
      );
      return enrollOverSsh(shell, { ...account, deviceName }, emit);
    });
    await this.deps.state.setDevice(serverId, {
      deviceId: enrollment.deviceId,
      userName: enrollment.userName,
      privateKey: await this.deps.seal(enrollment.privateKeyPem),
    });
    this.sessions.forget(serverId);

    const title = 'Sign in';
    emit({ phase: 'sign-in', title, status: 'running' });
    try {
      await this.sessions.signIn(serverId, { password: account.password });
      emit({ phase: 'sign-in', title, status: 'done' });
    } catch (error) {
      if (coreErrorCode(error) === 'totpRequired') {
        emit({
          phase: 'sign-in',
          title,
          status: 'done',
          detail:
            'Enter a code from your authenticator app on the server card to finish signing in.',
        });
        return;
      }
      emit({ phase: 'sign-in', title, status: 'failed', detail: coreErrorMessage(error) });
      throw error;
    }
  }

  /** The DevHost has no SSH, so a development build enrolls with it through its loopback endpoint. */
  private async ensureDevDevice(): Promise<void> {
    const port = this.deps.devCorePort;
    if (port === null || (await this.deps.state.device(DEV_SERVER_ID))) return;
    const key = createDeviceKey();
    const enrolled = await this.rest(devTcpTransport(port)).post<{
      deviceId: string;
      userName: string;
    }>('/dev/enroll', {
      publicKey: key.publicKey,
      deviceName: (this.deps.deviceName ?? hostname)().slice(0, 100),
    });
    await this.deps.state.setDevice(DEV_SERVER_ID, {
      deviceId: enrolled.deviceId,
      userName: enrolled.userName,
      privateKey: await this.deps.seal(key.privateKeyPem),
    });
  }

  /** The transport the core is reached through, for the length of `work`. */
  private async withTransport<T>(
    serverId: string,
    work: (transport: CoreTransport) => Promise<T>,
  ): Promise<T> {
    if (this.isDevHost(serverId) && this.deps.devCorePort !== null) {
      return work(devTcpTransport(this.deps.devCorePort));
    }
    const record = await this.deps.state.get(serverId);
    if (!record) throw new Error('The server core is not installed on this server yet.');
    return this.withLease(serverId, (lease) =>
      work(
        record.transport === 'bridge'
          ? bridgeTransport(lease.connection)
          : streamLocalTransport(lease.connection),
      ),
    );
  }

  /** A short-lived hub connection, signed in with this computer's session. */
  private withHub<T>(serverId: string, work: (hub: ICoreHub) => Promise<T>): Promise<T> {
    return this.withTransport(serverId, async (transport) => {
      const session = await this.openHub(serverId, transport);
      try {
        return await work(session.hub);
      } catch (error) {
        throw new Error(hubMessage(error));
      } finally {
        await session.stop().catch(() => undefined);
      }
    });
  }

  /**
   * A refused connection usually means the token outlived its session or device (revoked on the
   * core), which SignalR does not say. Renewing once does: a revoked device or ended session then
   * fails with its code, so the Deploy page can offer the way back.
   */
  private async openHub(serverId: string, transport: CoreTransport): Promise<CoreHubSession> {
    const token = () => this.sessions.accessToken(serverId);
    try {
      return await this.hubOf(transport, token);
    } catch (refused) {
      this.sessions.forget(serverId);
      await token();
      try {
        return await this.hubOf(transport, token);
      } catch {
        throw new Error(hubMessage(refused));
      }
    }
  }

  private isDevHost(serverId: string): boolean {
    return serverId === DEV_SERVER_ID && this.deps.devCorePort !== null;
  }

  private devHost(enrolled: boolean): DeployServer | null {
    const port = this.deps.devCorePort;
    if (port === null) return null;
    return {
      id: DEV_SERVER_ID,
      nickname: 'DevHost',
      host: '127.0.0.1',
      port,
      username: 'dev',
      enrolled,
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
