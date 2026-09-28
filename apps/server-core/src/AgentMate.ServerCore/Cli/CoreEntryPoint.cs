namespace AgentMate.ServerCore.Cli;

/// <summary>
/// One binary serves the API and answers the installer's admin commands. Only an exact "admin"
/// first argument leaves the web host path: the test factory and other tooling call the entry
/// point with arguments of their own, and those must always reach the host.
/// </summary>
internal static class CoreEntryPoint
{
    public static Task<int> RunAsync(
        string[] args,
        TextWriter output,
        TextWriter error,
        Func<string[], Task<int>> serve)
    {
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(serve);

        return args switch
        {
            ["admin", .. var command] => AdminCli.RunAsync(command, output, error),
            ["serve", .. var hostArgs] => serve(hostArgs),
            _ => serve(args),
        };
    }
}
