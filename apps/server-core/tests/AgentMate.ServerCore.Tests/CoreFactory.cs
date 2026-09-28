using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AgentMate.ServerCore.Tests;

/// <summary>
/// Boots the real web host through its entry point, with an in-memory server in place of Kestrel,
/// so every test exercises the same pipeline production runs.
/// </summary>
public sealed class CoreFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Testing");
    }
}
