using System.Globalization;

namespace AgentMate.ServerCore.Nginx;

/// <summary>
/// Where AgentMate's nginx files live on a server. The configuration nginx loads is one directory we
/// own, <c>/etc/nginx/agentmate/current</c>, a symlink to a numbered release under
/// <c>releases/</c>. nginx.conf includes it in two places, since nginx allows only one http block
/// and one stream block: <see cref="HttpInclude"/> inside <c>http { }</c> and
/// <see cref="StreamInclude"/> inside a <c>stream { }</c> block at the top level.
/// </summary>
internal sealed record NginxLayout
{
    public const string DebianTrustedCertificates = "/etc/ssl/certs/ca-certificates.crt";
    public const string RhelTrustedCertificates = "/etc/pki/tls/certs/ca-bundle.crt";

    public static NginxLayout Debian { get; } = new();

    public static NginxLayout Rhel { get; } = new() { TrustedCertificates = RhelTrustedCertificates };

    public string ConfigRoot { get; init; } = "/etc/nginx/agentmate";

    /// <summary>
    /// Challenge files for ACME HTTP-01 go to <c>{AcmeWebroot}/.well-known/acme-challenge/</c>.
    /// Outside the core's own state folder, which nginx's workers cannot read.
    /// </summary>
    public string AcmeWebroot { get; init; } = "/var/www/agentmate/acme";

    /// <summary>Each site's folder is <c>{SitesRoot}/{id}</c>, the only place snippets may serve files from.</summary>
    public string SitesRoot { get; init; } = "/var/www/agentmate/sites";

    /// <summary>
    /// Proxy caches go directly in here, one folder per site, because nginx creates only the last
    /// folder of a cache path. The nginx.org packages create /var/cache/nginx.
    /// </summary>
    public string CacheRoot { get; init; } = "/var/cache/nginx";

    /// <summary>The system CA bundle https:// upstreams are verified against.</summary>
    public string TrustedCertificates { get; init; } = DebianTrustedCertificates;

    /// <summary>Also listen on IPv6. Off for hosts without IPv6, where nginx would fail to bind [::].</summary>
    public bool ListenIPv6 { get; init; } = true;

    public string CurrentLink => ConfigRoot + "/current";

    public string ReleasesDirectory => ConfigRoot + "/releases";

    /// <summary>The line inside nginx.conf's http block that loads the sites.</summary>
    public string HttpInclude => $"include {CurrentLink}/{NginxRenderer.HttpFile};";

    /// <summary>The line inside a top-level stream block that loads the TCP and UDP proxies.</summary>
    public string StreamInclude => $"include {CurrentLink}/{NginxRenderer.StreamFile};";

    public string ReleaseDirectory(int release) =>
        ReleasesDirectory + "/" + release.ToString(CultureInfo.InvariantCulture);

    public string SiteFolder(string siteId) => SitesRoot + "/" + siteId;

    public string CacheDirectory(string siteId) => CacheRoot + "/agentmate-" + siteId;
}
