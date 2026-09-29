namespace AgentMate.ServerCore.Hosting;

/// <summary>Where the core keeps its state on disk.</summary>
internal static class CorePaths
{
    /// <summary>systemd's StateDirectory: created for root only (0700) before the core starts.</summary>
    public const string LinuxDataDirectory = "/var/lib/agentmate-core";

    public static string DataDirectory(IConfiguration configuration, bool isLinux)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var configured = configuration["Core:DataDirectory"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        return isLinux
            ? LinuxDataDirectory
            : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AgentMate",
                "ServerCore");
    }
}
