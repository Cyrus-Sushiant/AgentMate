namespace AgentMate.ServerCore.Cli;

/// <summary>
/// One binary serves the API, answers the installer's admin commands and bridges stdio to the
/// socket. Only an exact "admin" or "bridge" first argument leaves the web host path: the test
/// factory and other tooling call the entry point with arguments of their own, and those must
/// always reach the host.
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
            ["bridge", .. var bridgeArgs] => BridgeCommand.RunAsync(
                bridgeArgs,
                Console.OpenStandardInput(),
                Console.OpenStandardOutput(),
                error,
                CancellationToken.None),
            ["serve", .. var hostArgs] => serve(hostArgs),
            _ => serve(args),
        };
    }
}
