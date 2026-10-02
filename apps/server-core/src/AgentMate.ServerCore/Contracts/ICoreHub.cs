using TypedSignalR.Client;

namespace AgentMate.ServerCore.Contracts;

/// <summary>
/// Everything the app can ask the core over the WebSocket. The desktop's typed client is
/// generated from this interface, so a method exists on both sides or on neither.
/// </summary>
[Hub]
public interface ICoreHub
{
    Task<PingResponse> Ping();

    // Account: open to every role, for the signed-in user's own account.

    Task<AccountInfo> GetAccount();

    /// <summary>Ends this session; the connection closes.</summary>
    Task SignOut();

    Task<StepUpResponse> StepUp(StepUpRequest request);

    /// <summary>The caller's devices (an Admin sees everyone's).</summary>
    Task<DeviceInfo[]> ListDevices();

    /// <summary>One's own device, or anyone's for an Admin. Its sessions end with it.</summary>
    Task RevokeDevice(Guid deviceId);

    Task<SessionInfo[]> ListSessions();

    Task RevokeSession(Guid sessionId);

    /// <summary>Ends every session of the caller's but this one. Returns how many ended.</summary>
    Task<int> RevokeOtherSessions();

    /// <summary>Needs a step-up. Two-factor is not on until the first code is confirmed.</summary>
    Task<TotpSetup> BeginTotpSetup();

    Task<RecoveryCodes> ConfirmTotp(string code);

    Task DisableTotp(string code);

    Task<RecoveryCodes> NewRecoveryCodes();

    // Owner.

    /// <summary>A single-use code so another device can enroll. Needs a step-up.</summary>
    Task<EnrollmentCodeInfo> CreateEnrollmentCode(CreateEnrollmentCodeRequest request);

    // Owner: users. Each change needs a step-up, and none may leave the core without an Owner.

    Task<UserInfo[]> ListUsers();

    Task<UserInfo> CreateUser(CreateUserRequest request);

    /// <summary>Takes effect at once: the user's open connections close, so they reconnect with the new role.</summary>
    Task<UserInfo> SetUserRole(Guid userId, string role);

    /// <summary>A disabled user cannot sign in, and every session of theirs ends. Not one's own account.</summary>
    Task<UserInfo> SetUserDisabled(Guid userId, bool disabled);

    /// <summary>Not one's own password. Every session of theirs ends.</summary>
    Task ResetUserPassword(ResetUserPasswordRequest request);

    /// <summary>The user goes, with their devices, sessions and enrollment codes. Not one's own account.</summary>
    Task DeleteUser(Guid userId);

    // Admin.

    Task<AuditPage> QueryAudit(AuditQuery query);

    Task<AuditVerificationInfo> VerifyAudit();

    // The server, read by every role. None of these change anything.

    /// <summary>The Overview's facts. The core gathers them at most every 30 seconds.</summary>
    Task<SystemInfo> GetSystemInfo();

    Task<ServiceInfo[]> ListServices();

    Task<MetricsHistory> GetMetricsHistory(MetricsHistoryRequest request);

    /// <summary>
    /// Live samples, at least the requested interval apart (clamped to 1 to 60 seconds). After a
    /// reconnect, pass the time of the last sample received: the ones buffered since come first.
    /// </summary>
    IAsyncEnumerable<MetricsSample> StreamMetrics(MetricsStreamRequest request, CancellationToken cancellationToken);

    /// <summary>As of the last check. The core checks by itself every hour and after every package job.</summary>
    Task<UpdatesInfo> GetUpdates();

    Task<JobPage> ListJobs(JobQuery query);

    Task<JobInfo> GetJob(Guid jobId);

    /// <summary>
    /// The job's log after line afterSeq (0 for all of it), new lines as they come, then its final
    /// state, and the stream completes. After a reconnect, pass the last Seq received.
    /// </summary>
    IAsyncEnumerable<JobStreamItem> StreamJob(Guid jobId, long afterSeq, CancellationToken cancellationToken);

    Task<AlertInfo[]> ListAlerts(AlertQuery query);

    /// <summary>
    /// Open alerts (or every change after a revision), then changes as they happen. A stream that
    /// ends on its own fell behind: subscribe again with the highest revision received.
    /// </summary>
    IAsyncEnumerable<AlertInfo> StreamAlerts(AlertStreamRequest request, CancellationToken cancellationToken);

    // Operator. The ones that change the server start a job and return it at once; StreamJob follows it.

    /// <summary>Refreshes the package index (apt-get update or dnf makecache), then the list of updates.</summary>
    Task<JobInfo> CheckForUpdates();

    Task<JobInfo> UpgradeSecurityPackages();

    /// <summary>Needs a step-up: it can change what every service runs.</summary>
    Task<JobInfo> UpgradeAllPackages();

    /// <summary>Needs a step-up. The job succeeds, then the server reboots five seconds later.</summary>
    Task<JobInfo> RebootServer();

    /// <summary>Docker or nginx, when installed. nginx restarts only if its configuration passes nginx -t.</summary>
    Task<JobInfo> RestartService(ManagedService service);

    Task CancelJob(Guid jobId);

    Task<AlertInfo> AcknowledgeAlert(long alertId);

    // Admin.

    /// <summary>unattended-upgrades or dnf-automatic, installed when needed. A job.</summary>
    Task<JobInfo> SetAutomaticSecurityUpdates(bool enabled);

    // Firewall (E13). Reads for every role; changes for Admins. Turning the firewall on or off and
    // overriding the SSH lockout guard also need a step-up. A change rolls itself back after
    // ConfirmWithinSeconds unless ConfirmFirewallChanges arrives over a new SSH connection.

    Task<FirewallStatus> GetFirewallStatus();

    /// <summary>Rules for SSH (on the ports sshd really uses), HTTP, HTTPS and common databases.</summary>
    Task<FirewallPreset[]> GetFirewallPresets();

    Task<FirewallChangeSetInfo[]> ListFirewallChangeSets(FirewallChangeSetQuery query);

    /// <summary>Listening sockets and Docker's published ports, public or not, and what the firewall makes of each.</summary>
    Task<ExposureInventory> GetExposure();

    /// <summary>What a change set would do (the exact commands) and the lockout guard's verdict. Changes nothing.</summary>
    Task<FirewallChangePreview> PreviewFirewallChanges(FirewallChangeRequest request);

    /// <summary>
    /// Saves the current rules, arms the rollback timer, then applies, and returns the change set
    /// waiting for confirmation. Needs a step-up to turn the firewall on or off or to override the guard.
    /// </summary>
    Task<FirewallChangeSetInfo> ApplyFirewallChanges(FirewallChangeRequest request);

    /// <summary>Keeps the change. Refused over the SSH connection that applied it: confirm through a new one.</summary>
    Task<FirewallChangeSetInfo> ConfirmFirewallChanges(Guid changeSetId);

    /// <summary>Puts the saved rules back now.</summary>
    Task<FirewallChangeSetInfo> RevertFirewallChanges(Guid changeSetId);

    // Docker. Every role reads; Operators run the containers' lifecycle and pull images; Admins
    // open consoles, remove with volumes, prune and install the engine.

    Task<DockerStatus> GetDockerStatus();

    Task<ContainerList> ListContainers();

    /// <summary>Environment variable names only; RevealContainerEnv has the values.</summary>
    Task<ContainerDetails> InspectContainer(string containerId);

    /// <summary>
    /// Live figures, as `docker stats` computes them, in batches at the requested interval. A
    /// stream that ends on its own lost the engine: open it again.
    /// </summary>
    IAsyncEnumerable<ContainerStatsBatch> StreamContainerStats(ContainerStatsRequest request, CancellationToken cancellationToken);

    /// <summary>Redacted log lines. After a reconnect, pass the last line's Timestamp as AfterTimestamp.</summary>
    IAsyncEnumerable<ContainerLogBatch> StreamContainerLogs(ContainerLogsRequest request, CancellationToken cancellationToken);

    Task<ImageInfo[]> ListImages();

    Task<VolumeInfo[]> ListVolumes();

    Task<NetworkInfo[]> ListNetworks();

    Task<DockerDiskUsage> GetDockerDiskUsage();

    /// <summary>Engine events as they happen. After a reconnect, pass the last event's Cursor.</summary>
    IAsyncEnumerable<DockerEvent> StreamDockerEvents(DockerEventsRequest request, CancellationToken cancellationToken);

    // Docker, Operator.

    Task<ContainerSummary> StartContainer(string containerId);

    /// <summary>The container's own stop timeout unless one is given (0 to 600 seconds).</summary>
    Task<ContainerSummary> StopContainer(string containerId, int? timeoutSeconds);

    Task<ContainerSummary> RestartContainer(string containerId, int? timeoutSeconds);

    Task<ContainerSummary> PauseContainer(string containerId);

    Task<ContainerSummary> UnpauseContainer(string containerId);

    /// <summary>SIGKILL unless another well-known signal is named.</summary>
    Task<ContainerSummary> KillContainer(string containerId, string? signal);

    /// <summary>With RemoveVolumes (its anonymous volumes go too) only for Admins.</summary>
    Task RemoveContainer(ContainerRemoveRequest request);

    /// <summary>A job: StreamJob shows the layers as they arrive.</summary>
    Task<JobInfo> PullImage(ImagePullRequest request);

    Task RemoveImage(ImageRemoveRequest request);

    Task RemoveNetwork(string network);

    // Docker, Admin.

    /// <summary>Needs a step-up: these are the container's secrets.</summary>
    Task<ContainerEnvVariable[]> RevealContainerEnv(string containerId);

    /// <summary>
    /// A terminal in the container (docker exec with a TTY): keystrokes and size changes go in,
    /// the screen comes out. Opening and closing it land in the audit trail; what is typed does not.
    /// </summary>
    IAsyncEnumerable<ConsoleOutput> ContainerConsole(ConsoleRequest request, IAsyncEnumerable<ConsoleInput> input, CancellationToken cancellationToken);

    Task RemoveVolume(string volume, bool force);

    Task<DockerPruneResult> PruneDocker(DockerPruneRequest request);

    /// <summary>
    /// Docker Engine and Compose from download.docker.com, the repository key checked against its
    /// pinned fingerprint. A job. Refused while conflicting packages remain unless the request
    /// says to remove them.
    /// </summary>
    Task<JobInfo> InstallDocker(DockerInstallRequest request);

    // Websites and certificates (E10, E11). Reads are open to every role.

    Task<NginxStatus> GetNginxStatus();

    Task<SiteInfo[]> ListSites();

    Task<StreamProxyInfo[]> ListStreamProxies();

    Task<CertificateInfo[]> ListCertificates();

    /// <summary>A site's access or error log: the last lines, then new ones while Follow is on.</summary>
    IAsyncEnumerable<SiteLogBatch> StreamSiteLog(SiteLogRequest request, CancellationToken cancellationToken);

    // Admin. Saving changes the database only; ApplyNginx puts every saved change live at once.

    /// <summary>Installs nginx from nginx.org (or adopts the one there) and sets it up for AgentMate. A job.</summary>
    Task<JobInfo> InstallNginx();

    /// <summary>Creates or updates a site. Nothing is saved when Problems is not empty.</summary>
    Task<SiteSaveResult> SaveSite(SiteSettings settings);

    Task DeleteSite(string siteId);

    Task<StreamProxySaveResult> SaveStreamProxy(StreamProxySettings settings);

    Task DeleteStreamProxy(string proxyId);

    /// <summary>
    /// Renders every saved site and proxy into a new release, checks it with nginx -t, reloads and
    /// confirms nginx runs it; otherwise nginx keeps what it ran and Problems say why.
    /// </summary>
    Task<NginxApplyResult> ApplyNginx();

    /// <summary>Applies the site if needed, then issues over ACME (HTTP-01) and switches the site to HTTPS. A job.</summary>
    Task<JobInfo> IssueCertificate(CertificateIssueRequest request);

    /// <summary>Renews now instead of waiting for the renewal service. A job.</summary>
    Task<JobInfo> RenewCertificate(string siteId);

    /// <summary>Checks and stores a certificate with its key, then applies.</summary>
    Task<CertificateUploadResult> UploadCertificate(CertificateUploadRequest request);

    /// <summary>Needs a step-up. Takes the certificate off the site (revoking it when asked), then applies.</summary>
    Task<NginxApplyResult> RemoveCertificate(CertificateRemoveRequest request);

    // Compose stacks (E07), the Apps of a server. Every role reads; Operators create, deploy, roll
    // back and run the lifecycle; only Admins delete a stack with its volumes. Files are uploaded
    // over REST first (see StackRevisionUpload). Changes start a job; StreamJob follows it.

    Task<StackInfo[]> ListStacks();

    /// <summary>The stack, its revisions newest first, and its services with their containers.</summary>
    Task<StackDetails> GetStack(Guid stackId);

    /// <summary>The compose file as uploaded and the loopback override. Env values never leave the core.</summary>
    Task<StackRevisionFiles> GetStackRevisionFiles(StackRevisionRef revision);

    Task<StackInfo> CreateStack(CreateStackRequest request);

    /// <summary>Records each acknowledgment in the audit trail, one entry per finding id.</summary>
    Task<StackRevisionInfo> AcknowledgeStackRisks(AcknowledgeStackRisksRequest request);

    /// <summary>Validate, pull, build, up --wait, health. Refused while a finding is unacknowledged.</summary>
    Task<JobInfo> DeployStack(StackRevisionRef revision);

    /// <summary>Copies an earlier revision into a new one and deploys it.</summary>
    Task<JobInfo> RollbackStack(StackRevisionRef revision);

    Task<JobInfo> RunStackAction(StackActionRequest request);

    /// <summary>docker compose down, then the stack's files and records go. Its volumes stay.</summary>
    Task<JobInfo> DeleteStack(Guid stackId);

    /// <summary>As DeleteStack, with docker compose down --volumes: the app's data goes too. Admin.</summary>
    Task<JobInfo> DeleteStackWithVolumes(Guid stackId);

    // Owner.

    /// <summary>A site's custom snippets, checked against the directive allowlist.</summary>
    Task<SiteSaveResult> SetSiteSnippets(SiteSnippets snippets);
}

/// <summary>Everything the core can push to the app without being asked.</summary>
[Receiver]
public interface ICoreHubReceiver;
