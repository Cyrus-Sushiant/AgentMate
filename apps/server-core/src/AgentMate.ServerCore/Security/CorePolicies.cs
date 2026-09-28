using Microsoft.AspNetCore.Authorization;

namespace AgentMate.ServerCore.Security;

/// <summary>
/// Named policies. Every endpoint and hub method names one of these (or is explicitly anonymous),
/// and anything left unmarked falls back to requiring a signed-in caller.
/// </summary>
internal static class CorePolicies
{
    public const string SignedIn = "signed-in";

    public static AuthorizationPolicy RequireSignedIn { get; } =
        new AuthorizationPolicyBuilder(CoreAuthentication.Scheme).RequireAuthenticatedUser().Build();
}
