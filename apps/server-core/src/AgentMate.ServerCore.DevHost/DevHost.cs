using AgentMate.ServerCore;

namespace AgentMate.ServerCore.DevHost;

/// <summary>
/// Starts the core on 127.0.0.1 (port 7810 unless AGENTMATE_DEV_CORE_PORT says otherwise) with a
/// throwaway data folder. Only development builds of the desktop app connect to it, and only when
/// AGENTMATE_DEPLOY_DEV_CORE names it.
/// </summary>
internal static class DevHost
{
    public const int DefaultPort = 7810;

    public static async Task<int> RunAsync(string[] args)
    {
        var port = int.TryParse(Environment.GetEnvironmentVariable("AGENTMATE_DEV_CORE_PORT"), out var chosen)
            ? chosen
            : DefaultPort;
        var data = Path.Combine(Path.GetTempPath(), "agentmate-core-devhost");

        await using var app = CoreApplication.Build(
        [
            $"--Core:Listen:TcpPort={port}",
            $"--Core:DataDirectory={data}",
            "--environment",
            "Development",
            .. args,
        ]);
        await app.RunAsync();
        return 0;
    }
}
