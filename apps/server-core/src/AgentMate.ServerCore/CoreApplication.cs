using System.Net;
using AgentMate.ServerCore.Endpoints;
using AgentMate.ServerCore.Hosting;
using AgentMate.ServerCore.Hubs;
using AgentMate.ServerCore.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.HostFiltering;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace AgentMate.ServerCore;

/// <summary>
/// Builds the web host. Building has no side effects (tools and the test factory build it without
/// running it); anything that touches the machine happens when the server starts.
/// </summary>
internal static class CoreApplication
{
    /// <summary>Written by the installer; command-line arguments still override it.</summary>
    public const string ConfigFile = "/etc/agentmate-core/core.json";

    /// <summary>
    /// The only Host headers the core answers to. The app always sends "agentmate-core"; the
    /// loopback names cover development. Anything else is a rebinding attempt or a mistake.
    /// </summary>
    public static readonly string[] AllowedHosts = ["agentmate-core", "localhost", "127.0.0.1", "[::1]"];

    private const int MaxMessageBytes = 64 * 1024;

    public static WebApplication Build(string[] args)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args });
        builder.Configuration.AddJsonFile(ConfigFile, optional: true, reloadOnChange: false);
        builder.Configuration.AddCommandLine(args);

        var listen = CoreListenOptions.From(builder.Configuration, OperatingSystem.IsLinux());
        builder.WebHost.ConfigureKestrel(kestrel => ConfigureKestrel(kestrel, listen));

        builder.Services.Configure<HostFilteringOptions>(options =>
        {
            options.AllowedHosts = AllowedHosts;
            options.AllowEmptyHosts = false;
            options.IncludeFailureMessage = false;
        });
        builder.Services.ConfigureHttpJsonOptions(options => CoreJson.Configure(options.SerializerOptions));
        builder.Services.AddSingleton(TimeProvider.System);

        builder.Services
            .AddAuthentication(CoreAuthentication.Scheme)
            .AddScheme<AuthenticationSchemeOptions, NoCredentialsAuthenticationHandler>(
                CoreAuthentication.Scheme,
                configureOptions: null);
        builder.Services.AddAuthorizationBuilder()
            .SetDefaultPolicy(CorePolicies.RequireSignedIn)
            .SetFallbackPolicy(CorePolicies.RequireSignedIn)
            .AddPolicy(CorePolicies.SignedIn, CorePolicies.RequireSignedIn);

        builder.Services
            .AddSignalR(options =>
            {
                options.EnableDetailedErrors = false;
                options.MaximumReceiveMessageSize = MaxMessageBytes;
                options.MaximumParallelInvocationsPerClient = 4;
                options.StreamBufferCapacity = 32;
            })
            .AddJsonProtocol(options => CoreJson.Configure(options.PayloadSerializerOptions));

        var app = builder.Build();

        // Host filtering already ran (the host adds it first). Origin checks come next, then
        // authentication, so a browser request is refused without ever being authenticated.
        app.UseMiddleware<OriginRejectionMiddleware>();
        app.UseRouting();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapHealthEndpoints();
        app.MapHub<CoreHub>(CoreHub.Path, options =>
            {
                options.Transports = HttpTransportType.WebSockets;
                options.CloseOnAuthenticationExpiration = true;
                options.ApplicationMaxBufferSize = MaxMessageBytes;
                options.TransportMaxBufferSize = MaxMessageBytes;
            })
            .RequireAuthorization(CorePolicies.SignedIn);

        app.Lifetime.ApplicationStarted.Register(() => RestrictSocketPermissions(app.Services));
        return app;
    }

    private static void ConfigureKestrel(KestrelServerOptions kestrel, CoreListenOptions listen)
    {
        kestrel.AddServerHeader = false;
        var limits = kestrel.Limits;
        limits.MaxRequestBodySize = 10 * 1024 * 1024;
        limits.MaxRequestHeadersTotalSize = 32 * 1024;
        limits.MaxRequestHeaderCount = 64;
        limits.MaxRequestLineSize = 8 * 1024;
        limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
        limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
        limits.MaxConcurrentConnections = 64;
        limits.MaxConcurrentUpgradedConnections = 32;

        if (listen.TcpPort is int port)
        {
            kestrel.Listen(IPAddress.Loopback, port);
        }
        else if (listen.SocketPath is string path)
        {
            UnixSocketFile.PrepareForBind(path);
            kestrel.ListenUnixSocket(path);
        }
    }

    /// <summary>Only what Kestrel actually bound is touched, so the test server leaves files alone.</summary>
    private static void RestrictSocketPermissions(IServiceProvider services)
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        var addresses = services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()?.Addresses ?? [];
        foreach (var address in addresses)
        {
            if (UnixSocketFile.PathFromServerAddress(address) is { } path)
            {
                UnixSocketFile.RestrictPermissions(path);
            }
        }
    }
}
