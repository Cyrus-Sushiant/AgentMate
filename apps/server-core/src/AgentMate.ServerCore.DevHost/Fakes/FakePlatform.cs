using AgentMate.ServerCore.Firewall;
using AgentMate.ServerCore.Platform;

namespace AgentMate.ServerCore.DevHost.Fakes;

/// <summary>
/// Puts the pretend machine in place of the Linux platform layer. Only the DevHost calls this,
/// and the DevHost is never published, so none of it can reach a real server.
/// </summary>
internal static class FakePlatform
{
    public static void Add(IServiceCollection services)
    {
        services.AddSingleton<FakeServer>();
        services.AddSingleton<FakeProbe>();
        services.AddSingleton<ISystemProbe>(provider => provider.GetRequiredService<FakeProbe>());
        services.AddSingleton<IPackageManager, FakePackages>();
        services.AddSingleton<IServiceManager, FakeServices>();
        services.AddSingleton<ISystemInfoSource, FakeSystemInfo>();
        services.AddSingleton<IPowerControl, FakePower>();
        services.AddSingleton<IStartupFilter, RebootingFilter>();

        services.AddSingleton<FakeFirewall>();
        services.AddSingleton<IFirewallBackendSource>(provider => provider.GetRequiredService<FakeFirewall>());
        services.AddSingleton<IFirewallTimer, FakeFirewallTimer>();
        services.AddSingleton<ISshdSettings, FakeSshd>();
        services.AddSingleton<ICallerConnections, FakeCallerConnections>();
        services.AddSingleton<IExposureSource, FakeExposure>();
    }

    /// <summary>While the pretend server reboots, nothing answers but 503, as nothing would answer at all.</summary>
    private sealed class RebootingFilter(FakeServer server) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, following) =>
            {
                if (server.Rebooting)
                {
                    context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                    return;
                }

                await following(context);
            });
            next(app);
        };
    }
}
