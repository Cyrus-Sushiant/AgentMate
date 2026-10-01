using AgentMate.ServerCore.Contracts;
using AgentMate.ServerCore.Execution;
using AgentMate.ServerCore.Platform;

namespace AgentMate.ServerCore.Docker;

/// <summary>
/// Docker in the core: the engine over /var/run/docker.sock (Core:Docker:Endpoint for another
/// socket), the installer for this distribution, and the operations the hub calls. The DevHost
/// and the tests replace the engine and the installer with their fakes.
/// </summary>
internal static class DockerServices
{
    public static IServiceCollection AddCoreDocker(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddSingleton<IDockerEngine>(provider => new DockerEngine(
            new Uri(provider.GetRequiredService<IConfiguration>()["Core:Docker:Endpoint"] ?? DockerEngine.DefaultEndpoint),
            provider.GetRequiredService<ILogger<DockerEngine>>()));
        services.AddSingleton<IRepositoryKeys, HttpRepositoryKeys>();
        services.AddSingleton<IDockerSetup>(provider => new LinuxDockerSetup(
            provider.GetRequiredService<IProcessRunner>(),
            provider.GetRequiredService<SystemdRunner>(),
            provider.GetRequiredService<ISystemFiles>(),
            provider.GetRequiredService<OsInfo>(),
            provider.GetRequiredService<IRepositoryKeys>(),
            provider.GetRequiredService<IDockerEngine>(),
            provider.GetRequiredService<TimeProvider>()));
        services.AddSingleton<DockerOperations>();
        return services;
    }
}
