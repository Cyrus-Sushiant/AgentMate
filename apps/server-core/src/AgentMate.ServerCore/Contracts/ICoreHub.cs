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

    /// <summary>Needs a step-up. Two-factor is not on until the first code is confirmed.</summary>
    Task<TotpSetup> BeginTotpSetup();

    Task<RecoveryCodes> ConfirmTotp(string code);

    Task DisableTotp(string code);

    Task<RecoveryCodes> NewRecoveryCodes();

    // Owner.

    /// <summary>A single-use code so another device can enroll. Needs a step-up.</summary>
    Task<EnrollmentCodeInfo> CreateEnrollmentCode(CreateEnrollmentCodeRequest request);

    // Admin.

    Task<AuditPage> QueryAudit(AuditQuery query);

    Task<AuditVerificationInfo> VerifyAudit();
}

/// <summary>Everything the core can push to the app without being asked.</summary>
[Receiver]
public interface ICoreHubReceiver;
