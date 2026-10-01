import type { IStreamResult } from '@microsoft/signalr';
import type {
  AccountInfo,
  AlertInfo,
  AlertQuery,
  AlertStreamRequest,
  JobInfo,
  JobLogLine,
  JobPage,
  JobQuery,
  JobStreamItem,
  ManagedService,
  MetricsHistory,
  MetricsHistoryRequest,
  MetricsSample,
  MetricsStreamRequest,
  StepUpRequest,
} from '../protocol/generated/AgentMate.ServerCore.Contracts';
import type { ICoreHub } from '../protocol/generated/TypedSignalR.Client/AgentMate.ServerCore.Contracts';
import type { FakeCore } from './fakeCore';
import {
  connectionClosedError,
  FakeStream,
  invocationError,
  streamError,
  unauthorizedError,
} from './fakeStream';

/**
 * One hub connection to a `FakeCore`, with the core's rules: Viewer reads, Operator jobs, step-up
 * for upgrading everything and rebooting, Admin for automatic updates, and the per-connection
 * stream limits (metrics 2, jobs 4, alerts 2, 8 in all). Calls the fake has no use for say so.
 */

const LIMITS = { metrics: 2, job: 4, alerts: 2 } as const;
const PER_CONNECTION = 8;
const OPERATORS = new Set(['owner', 'admin', 'operator']);
const ADMINS = new Set(['owner', 'admin']);

type Kind = keyof typeof LIMITS;

interface OpenStream {
  kind: Kind;
  stream: FakeStream<unknown>;
  /** For a job stream, the job it follows. */
  jobId?: string;
}

export class FakeCoreConnection implements ICoreHub {
  closed = false;
  /** Every stream this connection was asked for, open or not, for tests to look at. */
  readonly requested: Array<{ kind: Kind; args: unknown[] }> = [];
  private readonly streams = new Set<OpenStream>();
  private readonly closeListeners: Array<(error?: Error) => void> = [];

  constructor(private readonly core: FakeCore) {}

  /** Streams open right now, by kind. */
  openStreams(kind?: Kind): number {
    return [...this.streams].filter((open) => kind === undefined || open.kind === kind).length;
  }

  onClose(listener: (error?: Error) => void): void {
    this.closeListeners.push(listener);
  }

  /** The connection goes away: its streams fail first, then it reports the close. */
  drop(error: Error = connectionClosedError()): void {
    if (this.closed) return;
    this.closed = true;
    for (const open of [...this.streams]) open.stream.fail(error);
    for (const listener of this.closeListeners) listener(error);
  }

  async stop(): Promise<void> {
    this.drop(connectionClosedError());
  }

  deliverSample(sample: MetricsSample): void {
    for (const open of this.of('metrics')) open.stream.push(sample);
  }

  deliverJobLine(jobId: string, line: JobLogLine): void {
    for (const open of this.of('job')) {
      if (open.jobId === jobId) open.stream.push({ lines: [line] } satisfies JobStreamItem);
    }
  }

  deliverJobEnd(jobId: string, job: JobInfo): void {
    for (const open of this.of('job')) {
      if (open.jobId !== jobId) continue;
      open.stream.push({ lines: [], job: { ...job } } satisfies JobStreamItem);
      open.stream.complete();
    }
  }

  deliverAlert(alert: AlertInfo): void {
    for (const open of this.of('alerts')) open.stream.push({ ...alert });
  }

  endAlertStreams(): void {
    for (const open of this.of('alerts')) open.stream.complete();
  }

  // Account calls: only what the Overview's tests lean on.

  ping = async () => this.answer({ serverTimeUnixMs: this.core.now() });

  getAccount = async (): Promise<AccountInfo> =>
    this.answer({
      userId: 'u1',
      userName: this.core.userName,
      roles: [...this.core.roles],
      twoFactorEnabled: false,
      recoveryCodesLeft: 0,
      sessionId: 'session-1',
      deviceId: 'device-1',
      ...(this.core.stepUpUntil > this.core.now()
        ? { stepUpUntilUnixMs: this.core.stepUpUntil }
        : {}),
    });

  stepUp = async (request: StepUpRequest) => {
    this.assertOpen();
    if (request.password !== this.core.password) {
      throw invocationError('StepUp', 'That password is not right.');
    }
    this.core.stepUpUntil = this.core.now() + 10 * 60_000;
    return { stepUpUntilUnixMs: this.core.stepUpUntil };
  };

  signOut = async () => {
    this.assertOpen();
    queueMicrotask(() => this.drop());
  };

  listDevices = () => this.unused('ListDevices');
  revokeDevice = () => this.unused('RevokeDevice');
  listSessions = () => this.unused('ListSessions');
  revokeSession = () => this.unused('RevokeSession');
  revokeOtherSessions = () => this.unused('RevokeOtherSessions');
  beginTotpSetup = () => this.unused('BeginTotpSetup');
  confirmTotp = () => this.unused('ConfirmTotp');
  disableTotp = () => this.unused('DisableTotp');
  newRecoveryCodes = () => this.unused('NewRecoveryCodes');
  createEnrollmentCode = () => this.unused('CreateEnrollmentCode');
  listUsers = () => this.unused('ListUsers');
  createUser = () => this.unused('CreateUser');
  setUserRole = () => this.unused('SetUserRole');
  setUserDisabled = () => this.unused('SetUserDisabled');
  resetUserPassword = () => this.unused('ResetUserPassword');
  deleteUser = () => this.unused('DeleteUser');
  queryAudit = () => this.unused('QueryAudit');
  verifyAudit = () => this.unused('VerifyAudit');

  // Reading the server.

  getSystemInfo = async () => this.answer({ ...this.core.system });

  listServices = async () => this.answer(this.core.services.map((service) => ({ ...service })));

  getMetricsHistory = async (request: MetricsHistoryRequest): Promise<MetricsHistory> => {
    const samples = this.core.samples.filter(
      (sample) =>
        (request.fromUnixMs === undefined || sample.atUnixMs >= request.fromUnixMs) &&
        (request.toUnixMs === undefined || sample.atUnixMs < request.toUnixMs),
    );
    return this.answer({ resolution: request.resolution, intervalSeconds: 1, samples });
  };

  getUpdates = async () => this.answer({ ...this.core.updates });

  listJobs = async (query: JobQuery): Promise<JobPage> => {
    const jobs = [...this.core.jobs.values()]
      .map((job) => ({ ...job.info }))
      .filter((job) => !query.activeOnly || job.state === 'running')
      .filter(
        (job) =>
          query.beforeCreatedAtUnixMs === undefined ||
          job.createdAtUnixMs < query.beforeCreatedAtUnixMs,
      )
      .sort((a, b) => b.createdAtUnixMs - a.createdAtUnixMs);
    return this.answer({ jobs: jobs.slice(0, query.limit ?? 50) });
  };

  getJob = async (jobId: string): Promise<JobInfo> => {
    this.assertOpen();
    const job = this.core.jobs.get(jobId);
    if (!job) throw invocationError('GetJob', 'There is no such job.');
    return { ...job.info };
  };

  listAlerts = async (query: AlertQuery): Promise<AlertInfo[]> =>
    this.answer(
      [...this.core.alerts.values()]
        .filter((alert) => query.includeResolved || !alert.resolvedAtUnixMs)
        .sort((a, b) => b.revision - a.revision)
        .slice(0, query.limit ?? 100)
        .map((alert) => ({ ...alert })),
    );

  streamMetrics = (request: MetricsStreamRequest): IStreamResult<MetricsSample> =>
    this.open<MetricsSample>('metrics', [request], (stream) => {
      if (request.sinceUnixMs === undefined) return;
      const since = request.sinceUnixMs;
      for (const sample of this.core.samples) {
        if (sample.atUnixMs > since) stream.push(sample);
      }
    });

  streamJob = (jobId: string, afterSeq: number): IStreamResult<JobStreamItem> =>
    this.open<JobStreamItem>(
      'job',
      [jobId, afterSeq],
      (stream) => {
        const job = this.core.jobs.get(jobId);
        if (!job) {
          stream.fail(streamError('There is no such job.'));
          return;
        }
        // As the core does: the first item carries the job, the last one its final state.
        const lines = job.lines.filter((line) => line.seq > afterSeq);
        const finished = job.info.state !== 'running';
        if (lines.length > 0 || !finished) stream.push({ lines, job: { ...job.info } });
        if (finished) {
          stream.push({ lines: [], job: { ...job.info } });
          stream.complete();
        }
      },
      jobId,
    );

  streamAlerts = (request: AlertStreamRequest): IStreamResult<AlertInfo> =>
    this.open<AlertInfo>('alerts', [request], (stream) => {
      for (const alert of this.core.changesAfter(request.afterRevision)) stream.push({ ...alert });
    });

  // Changing the server: each starts a job and returns it.

  checkForUpdates = async () => this.job('CheckForUpdates', 'packagesRefresh', 'Check for updates');

  upgradeSecurityPackages = async () =>
    this.job('UpgradeSecurityPackages', 'packagesUpgradeSecurity', 'Install security updates');

  upgradeAllPackages = async () =>
    this.job('UpgradeAllPackages', 'packagesUpgrade', 'Upgrade all packages', { stepUp: true });

  rebootServer = async () => {
    const job = this.job('RebootServer', 'reboot', 'Reboot the server', {
      stepUp: true,
      cancellable: false,
    });
    this.core.rebootRequested = true;
    return job;
  };

  restartService = async (service: ManagedService) =>
    this.job(
      'RestartService',
      'serviceRestart',
      service === 'docker' ? 'Restart Docker' : 'Restart nginx',
      { resource: service },
    );

  setAutomaticSecurityUpdates = async (enabled: boolean) =>
    this.job(
      'SetAutomaticSecurityUpdates',
      'automaticUpdates',
      enabled ? 'Turn on automatic security updates' : 'Turn off automatic security updates',
      { admin: true },
    );

  cancelJob = async (jobId: string): Promise<void> => {
    this.assertOpen();
    this.assertRole('CancelJob', OPERATORS);
    const job = this.core.jobs.get(jobId);
    if (!job) throw invocationError('CancelJob', 'There is no such job.');
    if (job.info.state !== 'running') {
      throw invocationError('CancelJob', 'This job has already finished.');
    }
    if (!job.info.cancellable) {
      throw invocationError('CancelJob', 'This job cannot be stopped once it has started.');
    }
    this.core.finishJob(jobId, 'cancelled');
  };

  acknowledgeAlert = async (alertId: number): Promise<AlertInfo> => {
    this.assertOpen();
    this.assertRole('AcknowledgeAlert', OPERATORS);
    if (!this.core.alerts.has(alertId)) {
      throw invocationError('AcknowledgeAlert', 'There is no such alert.');
    }
    return this.core.acknowledge(alertId);
  };

  private job(
    method: string,
    kind: JobInfo['kind'],
    title: string,
    options: { stepUp?: boolean; admin?: boolean; cancellable?: boolean; resource?: string } = {},
  ): JobInfo {
    this.assertOpen();
    this.assertRole(method, options.admin ? ADMINS : OPERATORS);
    if (options.stepUp && this.core.stepUpUntil <= this.core.now()) {
      throw unauthorizedError(method);
    }
    try {
      return this.core.startJob(kind, title, options);
    } catch (error) {
      throw invocationError(method, (error as Error).message);
    }
  }

  private open<T>(
    kind: Kind,
    args: unknown[],
    replay: (stream: FakeStream<T>) => void,
    jobId?: string,
  ): IStreamResult<T> {
    this.requested.push({ kind, args });
    const entry: OpenStream = { kind, stream: null as unknown as FakeStream<unknown>, jobId };
    const stream = new FakeStream<T>(
      (started) => {
        if (this.closed) {
          started.fail(connectionClosedError());
          return;
        }
        if (this.openStreams(kind) >= LIMITS[kind]) {
          started.fail(
            streamError(
              `This connection already has ${LIMITS[kind]} ${kind} streams open. Close one before opening another.`,
            ),
          );
          return;
        }
        if (this.openStreams() >= PER_CONNECTION) {
          started.fail(streamError(`This connection already has ${PER_CONNECTION} streams open.`));
          return;
        }
        this.streams.add(entry);
        replay(started);
      },
      () => this.streams.delete(entry),
    );
    entry.stream = stream as FakeStream<unknown>;
    return stream;
  }

  private of(kind: Kind): OpenStream[] {
    return [...this.streams].filter((open) => open.kind === kind);
  }

  private answer<T>(value: T): T {
    this.assertOpen();
    return value;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Cannot send data if the connection is not in the 'Connected' State.");
    }
  }

  private assertRole(method: string, allowed: ReadonlySet<string>): void {
    if (!this.core.roles.some((role) => allowed.has(role))) throw unauthorizedError(method);
  }

  private async unused(method: string): Promise<never> {
    throw invocationError(method, 'The fake core does not answer this call.');
  }
}
