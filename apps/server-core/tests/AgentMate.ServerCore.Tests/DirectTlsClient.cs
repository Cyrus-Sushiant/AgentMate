using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using AgentMate.ServerCore.DirectTls;

namespace AgentMate.ServerCore.Tests;

/// <summary>
/// The test side of a direct TLS connection: a client certificate self-signed with a device key (as
/// the desktop makes one) and an HttpClient that checks the server's key against a pin.
/// </summary>
internal static class DirectTlsClient
{
    /// <summary>A self-signed client certificate for a key, usable by SslStream on every OS.</summary>
    public static X509Certificate2 CertificateFor(ECDsa key)
    {
        var request = new CertificateRequest("CN=agentmate-device", key, HashAlgorithmName.SHA256);
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension([new Oid("1.3.6.1.5.5.7.3.2")], false));
        using var created = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(1));
        return X509CertificateLoader.LoadPkcs12(created.Export(X509ContentType.Pkcs12), password: null);
    }

    /// <summary>
    /// Requests to https://127.0.0.1:port with the Host header the app sends. The handler refuses a
    /// server whose key does not hash to the pin; `seenPin` reports the server's actual pin. Without
    /// keepAlive every request opens a new connection.
    /// </summary>
    public static HttpClient Create(int port, string pin, X509Certificate2? clientCertificate, Action<string>? seenPin = null, bool keepAlive = false)
    {
        var handler = new SocketsHttpHandler
        {
            PooledConnectionLifetime = keepAlive ? Timeout.InfiniteTimeSpan : TimeSpan.Zero,
            SslOptions = new SslClientAuthenticationOptions
            {
                TargetHost = "agentmate-core",
                EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls13,
                ClientCertificates = clientCertificate is null ? null : new X509CertificateCollection { clientCertificate },
                LocalCertificateSelectionCallback = (_, _, _, _, _) => clientCertificate!,
                RemoteCertificateValidationCallback = (_, certificate, _, _) =>
                {
                    if (certificate is null)
                    {
                        return false;
                    }

                    using var server = X509CertificateLoader.LoadCertificate(certificate.GetRawCertData());
                    var actual = DirectTlsCertificate.PinOf(server);
                    seenPin?.Invoke(actual);
                    return actual == pin;
                },
            },
        };
        return new HttpClient(handler, disposeHandler: true)
        {
            BaseAddress = new Uri($"https://127.0.0.1:{port}"),
            DefaultRequestHeaders = { Host = "agentmate-core" },
            Timeout = TimeSpan.FromSeconds(15),
        };
    }

    public static int FreePort()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return ((IPEndPoint)listener.LocalEndpoint).Port;
    }

    public static bool Accepts(int port)
    {
        using var client = new TcpClient();
        try
        {
            client.Connect(IPAddress.Loopback, port);
            return true;
        }
        catch (SocketException)
        {
            return false;
        }
    }
}
