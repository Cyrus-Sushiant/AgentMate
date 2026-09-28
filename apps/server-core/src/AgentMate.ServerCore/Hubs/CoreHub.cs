using AgentMate.ServerCore.Contracts;
using AgentMate.ServerCore.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AgentMate.ServerCore.Hubs;

/// <summary>
/// The one hub the app talks to. Each method carries its own policy, so tightening a role later
/// never depends on remembering the class-level default.
/// </summary>
[Authorize(Policy = CorePolicies.SignedIn)]
internal sealed class CoreHub(TimeProvider time) : Hub<ICoreHubReceiver>, ICoreHub
{
    public const string Path = "/hubs/core";

    [Authorize(Policy = CorePolicies.SignedIn)]
    public Task<PingResponse> Ping() =>
        Task.FromResult(new PingResponse(time.GetUtcNow().ToUnixTimeMilliseconds()));
}
