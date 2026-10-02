using AgentMate.ServerCore.Cloudflare;
using AgentMate.ServerCore.DevHost.Fakes;
using AgentMate.ServerCore.Docker;
using AgentMate.ServerCore.Firewall;
using AgentMate.ServerCore.Nginx;
using AgentMate.ServerCore.Platform;
using AgentMate.ServerCore.Stacks;
using AgentMate.ServerCore.Tests.Cloudflare;
using AgentMate.ServerCore.Tests.Docker;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace AgentMate.ServerCore.Tests;

/// <summary>
/// Boots the real web host through its entry point, with an in-memory server in place of Kestrel,
/// so every test exercises the same pipeline production runs. The machine underneath is fake: no
/// test reads the real /proc or starts apt, and every call that would change the server is logged
/// (<see cref="MutationLog"/>).
/// </summary>
public sealed class CoreFactory : WebApplicationFactory<Program>
{
    /// <summary>Each factory gets its own data folder, so no test touches /var/lib or a real key ring.</summary>
    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), $"core-tests-{Guid.NewGuid():N}");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Testing");
        builder.UseSetting("Core:DataDirectory", _dataDirectory);
        // Registry sign-ins (E08) go to a plain folder here: test machines have no tmpfs to spare.
        builder.UseSetting("Core:RuntimeDirectory", Path.Combine(_dataDirectory, "run"));
        builder.UseSetting("Core:RegistryAuthOnDisk", "allow");
        builder.ConfigureServices(services =>
        {
            services.AddSingleton<MutationLog>();
            services.AddSingleton<FakeSystemProbe>();
            services.AddSingleton<ISystemProbe>(provider => provider.GetRequiredService<FakeSystemProbe>());
            services.AddSingleton<FakePackageManager>();
            services.AddSingleton<IPackageManager>(provider => provider.GetRequiredService<FakePackageManager>());
            services.AddSingleton<FakeServiceManager>();
            services.AddSingleton<IServiceManager>(provider => provider.GetRequiredService<FakeServiceManager>());
            services.AddSingleton<IPowerControl, FakePowerControl>();
            services.AddSingleton<ISystemInfoSource, FakeSystemInfoSource>();
            services.AddSingleton<FakeFirewallBackend>();
            services.AddSingleton<IFirewallBackendSource>(provider => provider.GetRequiredService<FakeFirewallBackend>());
            services.AddSingleton<IFirewallTimer, FakeFirewallTimer>();
            services.AddSingleton<ISshdSettings, FakeSshd>();
            services.AddSingleton<FakeCallerConnections>();
            services.AddSingleton<ICallerConnections>(provider => provider.GetRequiredService<FakeCallerConnections>());
            services.AddSingleton<IExposureSource, FakeExposure>();

            // Docker: the pretend engine (shared with the DevHost) and an installer that only records.
            services.AddSingleton(provider => new InMemoryDockerEngine(provider.GetRequiredService<TimeProvider>()) { Tick = TimeSpan.FromMilliseconds(50) });
            services.AddSingleton<IDockerEngine>(provider => provider.GetRequiredService<InMemoryDockerEngine>());
            services.AddSingleton<FakeDockerSetup>();
            services.AddSingleton<IDockerSetup>(provider => provider.GetRequiredService<FakeDockerSetup>());

            // docker compose, simulated on the pretend engine without delays.
            services.AddSingleton(provider => new SimulatedCompose(
                provider.GetRequiredService<InMemoryDockerEngine>(),
                provider.GetRequiredService<TimeProvider>())
            { LineDelay = TimeSpan.Zero });
            services.AddSingleton<IComposeRunner>(provider => provider.GetRequiredService<SimulatedCompose>());

            // nginx on a simulated server, installed and running but not set up for AgentMate.
            services.AddSingleton(_ => new SimulatedNginxMachine(installed: true));
            services.AddSingleton<INginxMachine>(provider => provider.GetRequiredService<SimulatedNginxMachine>());

            // Cloudflare (E14): never the real API, and no refresh unless a test asks for one.
            services.AddSingleton<FakeCloudflareApi>();
            services.AddSingleton<ICloudflareRangeSource>(provider => provider.GetRequiredService<FakeCloudflareApi>());
            services.AddSingleton<ICloudflareDnsApi>(provider => provider.GetRequiredService<FakeCloudflareApi>());
            services.AddSingleton(OriginLockOptions.Default with { RunInBackground = false });
            services.AddSingleton(new CloudflareDns01Options(TimeSpan.Zero));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            TestFolders.Delete(_dataDirectory);
        }
    }
}
