using System.Runtime.InteropServices;
using System.Text.Json;

namespace AgentMate.ServerCore.Cli;

/// <summary>
/// Commands the desktop runs over SSH as root. They print JSON on success so the installer can
/// read them, and never start the web host.
/// </summary>
internal static class AdminCli
{
    private const string Usage = """
        Usage: agentmate-core admin <command>

        Commands:
          version    Print the core version, API version, runtime and architecture as JSON.
        """;

    public static async Task<int> RunAsync(string[] command, TextWriter output, TextWriter error)
    {
        ArgumentNullException.ThrowIfNull(command);
        ArgumentNullException.ThrowIfNull(output);
        ArgumentNullException.ThrowIfNull(error);

        switch (command)
        {
            case ["version"]:
                await output.WriteLineAsync(JsonSerializer.Serialize(CurrentVersion(), CoreJson.Options));
                return 0;
            default:
                await error.WriteLineAsync(Usage);
                return 2;
        }
    }

    private static VersionInfo CurrentVersion() => new(
        CoreVersion.Current,
        CoreVersion.ApiVersion,
        RuntimeInformation.FrameworkDescription,
        RuntimeInformation.OSDescription,
        RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant());

    private sealed record VersionInfo(
        string Version,
        int ApiVersion,
        string Runtime,
        string Os,
        string Architecture);
}
