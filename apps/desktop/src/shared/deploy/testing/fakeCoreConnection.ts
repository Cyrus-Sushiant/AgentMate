import type { IStreamResult, Subject } from '@microsoft/signalr';
import type {
  AccountInfo,
  AlertInfo,
  AlertQuery,
  AlertStreamRequest,
  CertificateIssueRequest,
  CertificateRemoveRequest,
  CertificateUploadRequest,
  ConsoleInput,
  ConsoleOutput,
  ConsoleRequest,
  ContainerDetails,
  ContainerEnvVariable,
  ContainerList,
  ContainerLogBatch,
  ContainerLogLine,
  ContainerLogsRequest,
  ContainerRemoveRequest,
  ContainerStatsBatch,
  ContainerStatsRequest,
  ContainerSummary,
  DockerDiskUsage,
  DockerEvent,
  DockerEventsRequest,
  DockerInstallRequest,
  DockerPruneRequest,
  DockerPruneResult,
  DockerStatus,
  FirewallChangeRequest,
  FirewallChangeSetQuery,
  ImageInfo,
  ImagePullRequest,
  ImageRemoveRequest,
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
  NetworkInfo,
  SiteLogBatch,
  SiteLogKind,
  SiteLogRequest,
  SiteSettings,
  SiteSnippets,
  StepUpRequest,
  StreamProxySettings,
  VolumeInfo,
} from '../protocol/generated/AgentMate.ServerCore.Contracts';
import type { ICoreHub } from '../protocol/generated/TypedSignalR.Client/AgentMate.ServerCore.Contracts';
import type { FakeCore } from './fakeCore';
import type { FakeConsoleSession } from './fakeDocker';
import type { FakeFirewall, FakeFirewallCaller } from './fakeFirewall';
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
 * stream limits (metrics 2, jobs 4, alerts 2, container stats 2, container logs 4, Docker events 2,
 * consoles 2, site logs 2, 8 in all). Calls the fake has no use for say so.
 */

const LIMITS = {
  metrics: 2,
  job: 4,
  alerts: 2,
  'container-stats': 2,
  'container-logs': 4,
  'docker-events': 2,
  console: 2,
  siteLog: 2,
} as const;
const PER_CONNECTION = 8;
const OPERATORS = new Set(['owner', 'admin', 'operator']);
const ADMINS = new Set(['owner', 'admin']);
const VIEWERS = new Set(['owner', 'admin', 'operator', 'viewer']);
const OWNERS = new Set(['owner']);

export type FakeStreamKind = keyof typeof LIMITS;
type Kind = FakeStreamKind;

interface OpenStream {
  kind: Kind;
  stream: FakeStream<unknown>;
  /** For a job stream, the job it follows; for a site log, `siteId:kind`. */
  jobId?: string;
  /** For a log stream, the container whose log it follows (until the end, or for good). */
  containerId?: string;
  follow?: boolean;
  /** For a stats stream, the containers it asked for (every running one when left out). */
  containerIds?: string[];
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

  deliverSiteLog(siteId: string, kind: SiteLogKind, lines: string[], reset: boolean): void {
    for (const open of this.of('siteLog')) {
      if (open.jobId === `${siteId}:${kind}`) {
        open.stream.push({ lines: [...lines], reset } satisfies SiteLogBatch);
      }
    }
  }

  endAlertStreams(): void {
    for (const open of this.of('alerts')) open.stream.complete();
  }

  deliverContainerStats(batch: ContainerStatsBatch): void {
    for (const open of this.of('container-stats')) {
      const wanted = open.containerIds;
      const samples = wanted
        ? batch.samples.filter((sample) => wanted.includes(sample.containerId))
        : batch.samples;
      open.stream.push({ ...batch, samples });
    }
  }

  deliverContainerLog(containerId: string, line: ContainerLogLine): void {
    for (const open of this.of('container-logs')) {
      if (open.containerId === containerId && open.follow) {
        open.stream.push({ lines: [line] } satisfies ContainerLogBatch);
      }
    }
  }

  /** Ends every log stream of a container, as the engine does when it stops. */
  endContainerLogs(containerId: string): void {
    for (const open of this.of('container-logs')) {
      if (open.containerId === containerId) open.stream.complete();
    }
  }

  deliverDockerEvent(event: DockerEvent): void {
    for (const open of this.of('docker-events')) open.stream.push({ ...event });
  }

  /** Ends every stream of a kind from the core's side, as when it lost the engine. */
  endStreams(kind: Kind): void {
    for (const open of this.of(kind)) open.stream.complete();
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

  // The firewall (E13): every role reads it, Admins change it.

  getFirewallStatus = async () => this.firewall('GetFirewallStatus', false, (fw) => fw.status());
  getFirewallPresets = async () => this.firewall('GetFirewallPresets', false, (fw) => fw.presets());
  listFirewallChangeSets = async (query: FirewallChangeSetQuery) =>
    this.firewall('ListFirewallChangeSets', false, (fw) => fw.history(query.limit));
  getExposure = async () => this.firewall('GetExposure', false, (fw) => fw.exposure());
  previewFirewallChanges = async (request: FirewallChangeRequest) =>
    this.firewall('PreviewFirewallChanges', true, (fw) => fw.preview(request));
  applyFirewallChanges = async (request: FirewallChangeRequest) =>
    this.firewall('ApplyFirewallChanges', true, (fw, caller) => fw.apply(request, caller));
  confirmFirewallChanges = async (changeSetId: string) =>
    this.firewall('ConfirmFirewallChanges', true, (fw, caller) => fw.confirm(changeSetId, caller));
  revertFirewallChanges = async (changeSetId: string) =>
    this.firewall('RevertFirewallChanges', true, (fw) => fw.revert(changeSetId));

  // Websites and certificates: Viewers read, Admins change, Owners write snippets, and taking a
  // certificate off needs a step-up as well.

  getNginxStatus = async () => this.answer({ ...this.core.nginx.status });
  listSites = async () =>
    this.answer([...this.core.nginx.sites.values()].map((site) => ({ ...site })));
  listStreamProxies = async () =>
    this.answer([...this.core.nginx.streams.values()].map((proxy) => ({ ...proxy })));
  listCertificates = async () => this.answer(this.core.nginx.certificates());
  streamSiteLog = (request: SiteLogRequest): IStreamResult<SiteLogBatch> =>
    this.open<SiteLogBatch>(
      'siteLog',
      [request],
      (stream) => {
        if (!this.core.nginx.sites.has(request.siteId)) {
          stream.fail(streamError('There is no such site.'));
          return;
        }
        const lines = this.core.nginx.tail(request.siteId, request.kind, request.tailLines);
        stream.push({ lines, reset: false });
        if (!request.follow) stream.complete();
      },
      `${request.siteId}:${request.kind}`,
    );
  installNginx = async () => this.web('InstallNginx', ADMINS, (nginx) => nginx.install());
  saveSite = async (settings: SiteSettings) =>
    this.web('SaveSite', ADMINS, (nginx) => nginx.saveSite(settings));
  deleteSite = async (siteId: string) =>
    this.web('DeleteSite', ADMINS, (nginx) => nginx.deleteSite(siteId));
  saveStreamProxy = async (settings: StreamProxySettings) =>
    this.web('SaveStreamProxy', ADMINS, (nginx) => nginx.saveStream(settings));
  deleteStreamProxy = async (proxyId: string) =>
    this.web('DeleteStreamProxy', ADMINS, (nginx) => nginx.deleteStream(proxyId));
  applyNginx = async () => this.web('ApplyNginx', ADMINS, (nginx) => nginx.apply());
  issueCertificate = async (request: CertificateIssueRequest) =>
    this.web('IssueCertificate', ADMINS, (nginx) => nginx.issue(request));
  renewCertificate = async (siteId: string) =>
    this.web('RenewCertificate', ADMINS, (nginx) => nginx.renew(siteId));
  uploadCertificate = async (request: CertificateUploadRequest) =>
    this.web('UploadCertificate', ADMINS, (nginx) => nginx.upload(request));
  removeCertificate = async (request: CertificateRemoveRequest) =>
    this.web('RemoveCertificate', ADMINS, (nginx) => nginx.removeCertificate(request), {
      stepUp: true,
    });
  setSiteSnippets = async (snippets: SiteSnippets) =>
    this.web('SetSiteSnippets', OWNERS, (nginx) => nginx.setSnippets(snippets));

  // Compose stacks (E07): the desktop does not call these through the fake yet.

  listStacks = () => this.unused('ListStacks');
  getStack = () => this.unused('GetStack');
  getStackRevisionFiles = () => this.unused('GetStackRevisionFiles');
  createStack = () => this.unused('CreateStack');
  acknowledgeStackRisks = () => this.unused('AcknowledgeStackRisks');
  deployStack = () => this.unused('DeployStack');
  rollbackStack = () => this.unused('RollbackStack');
  runStackAction = () => this.unused('RunStackAction');
  reviseStack = () => this.unused('ReviseStack');
  revealStackEnv = () => this.unused('RevealStackEnv');
  deleteStack = () => this.unused('DeleteStack');
  deleteStackWithVolumes = () => this.unused('DeleteStackWithVolumes');

  // Private registries (E08): the desktop's tests use their own hub doubles for these.

  deployStackWithRegistries = () => this.unused('DeployStackWithRegistries');
  rollbackStackWithRegistries = () => this.unused('RollbackStackWithRegistries');
  listRegistryCredentials = () => this.unused('ListRegistryCredentials');
  saveRegistryCredential = () => this.unused('SaveRegistryCredential');
  deleteRegistryCredential = () => this.unused('DeleteRegistryCredential');

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

  // Docker (E06): Viewer reads, Operator runs the lifecycle and pulls, Admin opens consoles,
  // removes volumes, prunes and installs, and revealing environment values takes a step-up too.

  getDockerStatus = async (): Promise<DockerStatus> =>
    this.answer({
      ...this.docker.status,
      conflictingPackages: [...this.docker.status.conflictingPackages],
    });

  listContainers = async (): Promise<ContainerList> => this.answer(this.docker.list());

  inspectContainer = async (containerId: string): Promise<ContainerDetails> =>
    this.docker.details(this.container('InspectContainer', containerId));

  revealContainerEnv = async (containerId: string): Promise<ContainerEnvVariable[]> => {
    this.assertOpen();
    this.assertRole('RevealContainerEnv', ADMINS);
    if (this.core.stepUpUntil <= this.core.now()) throw unauthorizedError('RevealContainerEnv');
    return this.docker.env(this.container('RevealContainerEnv', containerId));
  };

  startContainer = async (containerId: string) =>
    this.lifecycle('StartContainer', containerId, 'running', 'start');

  stopContainer = async (containerId: string, _timeoutSeconds?: number) =>
    this.lifecycle('StopContainer', containerId, 'exited', 'die');

  restartContainer = async (containerId: string, _timeoutSeconds?: number) =>
    this.lifecycle('RestartContainer', containerId, 'running', 'restart');

  pauseContainer = async (containerId: string) =>
    this.lifecycle('PauseContainer', containerId, 'paused', 'pause');

  unpauseContainer = async (containerId: string) =>
    this.lifecycle('UnpauseContainer', containerId, 'running', 'unpause');

  killContainer = async (containerId: string, _signal?: string) =>
    this.lifecycle('KillContainer', containerId, 'exited', 'kill');

  removeContainer = async (request: ContainerRemoveRequest): Promise<void> => {
    this.assertOpen();
    this.assertRole('RemoveContainer', OPERATORS);
    if (request.removeVolumes && !this.core.roles.some((role) => ADMINS.has(role))) {
      throw invocationError(
        'RemoveContainer',
        'Removing a container with its volumes is for Admins.',
      );
    }
    this.container('RemoveContainer', request.containerId);
    try {
      this.docker.remove(request);
    } catch (error) {
      throw invocationError('RemoveContainer', (error as Error).message);
    }
  };

  listImages = async (): Promise<ImageInfo[]> =>
    this.answer(this.docker.images.map((image) => ({ ...image })));

  pullImage = async (request: ImagePullRequest): Promise<JobInfo> =>
    this.job('PullImage', 'imagePull', `Pull ${request.reference}`, {
      resource: request.reference,
    });

  removeImage = async (request: ImageRemoveRequest): Promise<void> => {
    this.assertOpen();
    this.assertRole('RemoveImage', OPERATORS);
    const image = this.docker.images.find(
      (one) => one.id === request.image || one.tags.includes(request.image),
    );
    if (!image) throw invocationError('RemoveImage', `No such image: ${request.image}`);
    if (image.containers > 0 && !request.force) {
      throw invocationError('RemoveImage', 'A container still uses this image.');
    }
    this.docker.images = this.docker.images.filter((one) => one !== image);
  };

  listVolumes = async (): Promise<VolumeInfo[]> =>
    this.answer(this.docker.volumes.map((volume) => ({ ...volume })));

  removeVolume = async (volume: string, _force: boolean): Promise<void> => {
    this.assertOpen();
    this.assertRole('RemoveVolume', ADMINS);
    if (!this.docker.volumes.some((one) => one.name === volume)) {
      throw invocationError('RemoveVolume', `No such volume: ${volume}`);
    }
    this.docker.volumes = this.docker.volumes.filter((one) => one.name !== volume);
  };

  listNetworks = async (): Promise<NetworkInfo[]> =>
    this.answer(this.docker.networks.map((network) => ({ ...network })));

  removeNetwork = async (network: string): Promise<void> => {
    this.assertOpen();
    this.assertRole('RemoveNetwork', OPERATORS);
    const found = this.docker.networks.find((one) => one.name === network || one.id === network);
    if (!found) throw invocationError('RemoveNetwork', `No such network: ${network}`);
    if (found.builtIn) throw invocationError('RemoveNetwork', `${found.name} is built in.`);
    this.docker.networks = this.docker.networks.filter((one) => one !== found);
  };

  getDockerDiskUsage = async (): Promise<DockerDiskUsage> =>
    this.answer(structuredClone(this.docker.diskUsage));

  pruneDocker = async (request: DockerPruneRequest): Promise<DockerPruneResult> => {
    this.assertOpen();
    this.assertRole('PruneDocker', ADMINS);
    this.docker.pruned.push({ ...request });
    return { removed: 2, reclaimedBytes: 124_000_000 };
  };

  installDocker = async (request: DockerInstallRequest): Promise<JobInfo> => {
    const job = this.job('InstallDocker', 'dockerInstall', 'Install Docker', {
      admin: true,
      resource: 'docker',
    });
    const conflicts = this.docker.status.conflictingPackages;
    if (conflicts.length > 0 && !request.removeConflictingPackages) {
      this.core.log(job.id, `Remove ${conflicts.join(', ')} first, or agree to it.`, 'err');
      return this.core.finishJob(job.id, 'failed', 1);
    }
    return job;
  };

  streamContainerStats = (request: ContainerStatsRequest): IStreamResult<ContainerStatsBatch> => {
    const ids = request.containerIds?.map((id) => this.docker.find(id)?.summary.id ?? id);
    return this.open<ContainerStatsBatch>(
      'container-stats',
      [request],
      (stream) => {
        if (!this.docker.status.running) {
          stream.fail(streamError('Docker is not running on this server.'));
        }
      },
      ids ? { containerIds: ids } : {},
    );
  };

  streamContainerLogs = (request: ContainerLogsRequest): IStreamResult<ContainerLogBatch> => {
    const container = this.docker.find(request.containerId);
    return this.open<ContainerLogBatch>(
      'container-logs',
      [request],
      (stream) => {
        if (!container) {
          stream.fail(streamError(`No such container: ${request.containerId}`));
          return;
        }
        const after = request.afterTimestamp;
        const since = request.sinceUnixMs;
        const lines = after
          ? container.logs.filter((line) => line.timestamp > after)
          : container.logs
              .filter((line) => since === undefined || line.atUnixMs >= since)
              .slice(-(request.tail ?? 200));
        if (lines.length > 0) stream.push({ lines });
        if (!request.follow || container.summary.state !== 'running') stream.complete();
      },
      { containerId: container?.summary.id ?? request.containerId, follow: request.follow },
    );
  };

  streamDockerEvents = (request: DockerEventsRequest): IStreamResult<DockerEvent> =>
    this.open<DockerEvent>('docker-events', [request], (stream) => {
      for (const event of this.docker.eventsAfter(request.afterCursor)) stream.push({ ...event });
    });

  /** A shell that echoes, answers each line with "ran <line>", and ends on "exit". */
  containerConsole = (
    request: ConsoleRequest,
    input: Subject<ConsoleInput>,
  ): IStreamResult<ConsoleOutput> => {
    const session: FakeConsoleSession = {
      containerId: request.containerId,
      typed: [],
      sizes: [{ columns: request.columns, rows: request.rows }],
      open: true,
    };
    let typing: { dispose(): void } | null = null;
    return this.open<ConsoleOutput>(
      'console',
      [request],
      (stream) => {
        if (!this.core.roles.some((role) => ADMINS.has(role))) {
          stream.fail(unauthorizedError('ContainerConsole'));
          return;
        }
        const container = this.docker.find(request.containerId);
        if (!container || container.summary.state !== 'running') {
          stream.fail(streamError(`Container ${request.containerId} is not running.`));
          return;
        }
        this.docker.consoles.push(session);
        const prompt = `root@${container.summary.name}:/# `;
        let line = '';
        stream.push({ data: prompt, ended: false });
        typing = input.subscribe({
          next: (item) => {
            if (item.columns && item.rows) {
              session.sizes.push({ columns: item.columns, rows: item.rows });
            }
            if (!item.data) return;
            session.typed.push(item.data);
            for (const character of item.data) {
              if (character !== '\r') {
                line += character;
                stream.push({ data: character, ended: false });
                continue;
              }
              const command = line.trim();
              line = '';
              if (command === 'exit') {
                stream.push({ data: '\r\nexit\r\n', ended: false });
                stream.push({ ended: true, exitCode: 0 });
                stream.complete();
                return;
              }
              const answer = command ? `ran ${command}\r\n` : '';
              stream.push({ data: `\r\n${answer}${prompt}`, ended: false });
            }
          },
          complete: () => undefined,
          error: () => undefined,
        });
      },
      {},
      () => {
        session.open = false;
        typing?.dispose();
      },
    );
  };

  private get docker() {
    return this.core.docker;
  }

  private container(method: string, idOrName: string) {
    this.assertOpen();
    const container = this.docker.find(idOrName);
    if (!container) throw invocationError(method, `No such container: ${idOrName}`);
    return container;
  }

  private lifecycle(
    method: string,
    containerId: string,
    state: ContainerSummary['state'],
    action: string,
  ): ContainerSummary {
    this.assertOpen();
    this.assertRole(method, OPERATORS);
    const id = this.container(method, containerId).summary.id;
    const summary = this.docker.setState(id, state, action);
    if (state !== 'running') {
      for (const connection of this.core.openConnections) connection.endContainerLogs(id);
    }
    return summary;
  }

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

  private firewall<T>(
    method: string,
    admin: boolean,
    work: (firewall: FakeFirewall, caller: FakeFirewallCaller) => T,
  ): T {
    this.assertOpen();
    this.assertRole(method, admin ? ADMINS : VIEWERS);
    try {
      return work(this.core.firewall, {
        connection: this,
        steppedUp: this.core.stepUpUntil > this.core.now(),
      });
    } catch (error) {
      throw invocationError(method, (error as Error).message);
    }
  }

  private web<T>(
    method: string,
    allowed: ReadonlySet<string>,
    work: (nginx: FakeCore['nginx']) => T,
    options: { stepUp?: boolean } = {},
  ): T {
    this.assertOpen();
    this.assertRole(method, allowed);
    if (options.stepUp && this.core.stepUpUntil <= this.core.now()) {
      throw unauthorizedError(method);
    }
    try {
      return work(this.core.nginx);
    } catch (error) {
      throw invocationError(method, (error as Error).message);
    }
  }

  private open<T>(
    kind: Kind,
    args: unknown[],
    replay: (stream: FakeStream<T>) => void,
    target?: string | Pick<OpenStream, 'containerId' | 'follow' | 'containerIds'>,
    stopped?: () => void,
  ): IStreamResult<T> {
    this.requested.push({ kind, args });
    const entry: OpenStream = {
      kind,
      stream: null as unknown as FakeStream<unknown>,
      ...(typeof target === 'string' ? { jobId: target } : target),
    };
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
      () => {
        this.streams.delete(entry);
        stopped?.();
      },
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
