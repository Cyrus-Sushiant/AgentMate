using AgentMate.ServerCore.Contracts;

namespace AgentMate.ServerCore.Endpoints;

internal static class HealthEndpoints
{
    public const string Path = "/api/v1/health";

    /// <summary>
    /// The only anonymous route: the installer and the app's first connection check need to know
    /// which core is running before anyone has signed in.
    /// </summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints
            .MapGet(Path, () => TypedResults.Ok(
                new HealthResponse("ok", CoreVersion.Current, CoreVersion.ApiVersion)))
            .AllowAnonymous();
        return endpoints;
    }
}
