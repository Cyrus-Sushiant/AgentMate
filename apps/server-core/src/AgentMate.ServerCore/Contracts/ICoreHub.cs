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
}

/// <summary>Everything the core can push to the app without being asked.</summary>
[Receiver]
public interface ICoreHubReceiver;
