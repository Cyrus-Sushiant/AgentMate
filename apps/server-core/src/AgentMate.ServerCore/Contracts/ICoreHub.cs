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
}

/// <summary>Everything the core can push to the app without being asked.</summary>
[Receiver]
public interface ICoreHubReceiver;
