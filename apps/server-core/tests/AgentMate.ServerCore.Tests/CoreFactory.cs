using AgentMate.ServerCore.Platform;
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
