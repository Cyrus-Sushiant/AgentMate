using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace AgentMate.ServerCore.Security;

internal static class CoreAuthentication
{
    /// <summary>
    /// The scheme every protected endpoint challenges with. Until device sign-in lands (E04) its
    /// handler accepts nobody, so the challenge is a plain 401 rather than a server error.
    /// </summary>
    public const string Scheme = "AgentMateDevice";
}

/// <summary>Authenticates nobody. E04 replaces it with device-signed sign-in.</summary>
internal sealed class NoCredentialsAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync() =>
        Task.FromResult(AuthenticateResult.NoResult());
}
