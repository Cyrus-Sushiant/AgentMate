using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AgentMate.ServerCore.Tests;

/// <summary>
/// Boots the real web host through its entry point, with an in-memory server in place of Kestrel,
/// so every test exercises the same pipeline production runs.
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
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && Directory.Exists(_dataDirectory))
        {
            Directory.Delete(_dataDirectory, recursive: true);
        }
    }
}
