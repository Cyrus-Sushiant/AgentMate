using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace AgentMate.ServerCore.Hubs;

/// <summary>
/// Open hub connections by session and device, so revoking one ends its live connections too, not
/// just its next sign-in. The connection that asked for the revocation closes a moment later, once
/// its answer has gone out.
/// </summary>
internal sealed class HubConnections
{
    private static readonly TimeSpan _callerGrace = TimeSpan.FromMilliseconds(250);

    private readonly ConcurrentDictionary<string, (Guid Session, Guid Device, HubCallerContext Context)> _open = new();

    public void Add(HubCallerContext context, Guid sessionId, Guid deviceId)
    {
        ArgumentNullException.ThrowIfNull(context);
        _open[context.ConnectionId] = (sessionId, deviceId, context);
    }

    public void Remove(string connectionId) => _open.TryRemove(connectionId, out _);

    public void CloseSession(Guid sessionId, string callerConnectionId) =>
        Close(entry => entry.Session == sessionId, callerConnectionId);

    public void CloseDevice(Guid deviceId, string callerConnectionId) =>
        Close(entry => entry.Device == deviceId, callerConnectionId);

    private void Close(Func<(Guid Session, Guid Device), bool> matches, string callerConnectionId)
    {
        foreach (var (connectionId, entry) in _open)
        {
            if (!matches((entry.Session, entry.Device)))
            {
                continue;
            }

            if (connectionId == callerConnectionId)
            {
                _ = CloseSoonAsync(entry.Context);
            }
            else
            {
                entry.Context.Abort();
            }
        }
    }

    private static async Task CloseSoonAsync(HubCallerContext context)
    {
        await Task.Delay(_callerGrace);
        context.Abort();
    }
}
