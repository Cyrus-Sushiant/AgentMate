using System.Collections.Concurrent;
using System.Text;
using AgentMate.ServerCore.Certificates.Acme;
using AgentMate.ServerCore.Execution;
using AgentMate.ServerCore.Nginx;

namespace AgentMate.ServerCore.Certificates;

/// <summary>
/// Answers HTTP-01 from the nginx webroot every site serves at /.well-known/acme-challenge/. The
/// answer is world-readable (nginx's workers serve it) and holds nothing secret: the token and the
/// account key's thumbprint. Where SELinux is on, the file gets the webroot's label.
/// </summary>
internal sealed class WebrootChallengePublisher(INginxMachine machine, NginxLayout layout) : IHttp01ChallengePublisher
{
    private const UnixFileMode Readable = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead;

    public async Task PublishAsync(string domain, string token, string keyAuthorization, CancellationToken cancellationToken)
    {
        var path = PathOf(token);
        await machine.WriteAsync(path, Encoding.ASCII.GetBytes(keyAuthorization), Readable, cancellationToken);
        if (await machine.ExistsAsync("/sys/fs/selinux/enforce", cancellationToken))
        {
            try
            {
                await machine.RunAsync(new ProcessSpec { Program = "restorecon", Arguments = [path], Timeout = TimeSpan.FromSeconds(30) }, cancellationToken);
            }
            catch (ProcessStartException)
            {
                // Files inherit the folder's label anyway; restorecon is the safety net.
            }
        }
    }

    public Task RemoveAsync(string domain, string token, CancellationToken cancellationToken) =>
        machine.DeleteAsync(PathOf(token), cancellationToken);

    /// <summary>Tokens are base64url (RFC 8555 section 8.1), so they can never name another folder.</summary>
    private string PathOf(string token)
    {
        if (token is not { Length: > 0 and <= 256 } || !token.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
        {
            throw new AcmeException("The CA sent a challenge token that is not base64url.");
        }

        return $"{layout.AcmeChallengeDirectory}/{token}";
    }
}

/// <summary>The HTTP client ACME requests go through; tests put a fake CA behind it.</summary>
internal interface IAcmeHttp
{
    HttpClient Client { get; }
}

internal sealed class AcmeHttp : IAcmeHttp, IDisposable
{
    public HttpClient Client { get; } = new(AcmeTransport.CreateHandler()) { Timeout = Timeout.InfiniteTimeSpan };

    public void Dispose() => Client.Dispose();
}

/// <summary>Which ACME directories "production" and "staging" mean. Configurable for tests against Pebble.</summary>
internal sealed record AcmeDirectoryChoice(Uri Production, Uri Staging)
{
    public static AcmeDirectoryChoice From(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        return new AcmeDirectoryChoice(
            Configured(configuration["Core:Acme:ProductionDirectory"]) ?? AcmeDirectories.LetsEncryptProduction,
            Configured(configuration["Core:Acme:StagingDirectory"]) ?? AcmeDirectories.LetsEncryptStaging);
    }

    private static Uri? Configured(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps ? uri : null;
}

/// <summary>One CA directory as the certificate service uses it.</summary>
internal interface ICertificateAuthority
{
    /// <summary>Registers the account on first use (which needs the terms accepted) and stores it.</summary>
    Task EnsureAccountAsync(AcmeAccountSettings settings, CancellationToken cancellationToken);

    Task<AcmeCertificateRecord> IssueAsync(AcmeIssueRequest request, IProgress<AcmeIssueProgress>? progress, CancellationToken cancellationToken);

    Task<AcmeCertificateRecord> RenewAsync(string name, IProgress<AcmeIssueProgress>? progress, CancellationToken cancellationToken);

    Task<AcmeRenewalInfo> GetRenewalInfoAsync(string name, CancellationToken cancellationToken);

    Task RevokeAsync(string name, AcmeRevocationReason reason, CancellationToken cancellationToken);
}

/// <summary>The CAs certificates come from: ACME on a real server, a simulation in the DevHost.</summary>
internal interface ICertificateAuthorities
{
    /// <summary>Whether wildcards and DNS-01 can be answered (E14 adds a hook).</summary>
    bool CanAnswerDns01 { get; }

    ICertificateAuthority For(Uri directory);
}

/// <summary>One ACME issuer per CA directory, sharing the stores, the challenge handlers and the client.</summary>
internal sealed class AcmeIssuers(
    IAcmeHttp http,
    IAcmeAccountStore accounts,
    IAcmeCertificateStore certificates,
    IHttp01ChallengePublisher http01,
    IEnumerable<IDns01ChallengeHook> dns01,
    TimeProvider time,
    ILoggerFactory loggers) : ICertificateAuthorities
{
    private readonly ConcurrentDictionary<string, Authority> _issuers = new(StringComparer.Ordinal);

    public bool CanAnswerDns01 => dns01.Any();

    public ICertificateAuthority For(Uri directory)
    {
        ArgumentNullException.ThrowIfNull(directory);
        return _issuers.GetOrAdd(directory.AbsoluteUri, _ => new Authority(new AcmeIssuer(
            new AcmeClient(http.Client, new AcmeClientOptions { DirectoryUrl = directory }, time, loggers.CreateLogger<AcmeClient>()),
            accounts,
            certificates,
            http01,
            dns01.FirstOrDefault(),
            time,
            loggers.CreateLogger<AcmeIssuer>())));
    }

    private sealed class Authority(AcmeIssuer issuer) : ICertificateAuthority
    {
        public async Task EnsureAccountAsync(AcmeAccountSettings settings, CancellationToken cancellationToken) =>
            (await issuer.EnsureAccountAsync(settings, cancellationToken)).Dispose();

        public Task<AcmeCertificateRecord> IssueAsync(AcmeIssueRequest request, IProgress<AcmeIssueProgress>? progress, CancellationToken cancellationToken) =>
            issuer.IssueAsync(request, progress, cancellationToken);

        public Task<AcmeCertificateRecord> RenewAsync(string name, IProgress<AcmeIssueProgress>? progress, CancellationToken cancellationToken) =>
            issuer.RenewAsync(name, progress, cancellationToken);

        public Task<AcmeRenewalInfo> GetRenewalInfoAsync(string name, CancellationToken cancellationToken) =>
            issuer.GetRenewalInfoAsync(name, cancellationToken);

        public Task RevokeAsync(string name, AcmeRevocationReason reason, CancellationToken cancellationToken) =>
            issuer.RevokeAsync(name, reason, cancellationToken);
    }
}
