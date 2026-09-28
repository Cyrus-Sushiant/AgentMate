using System.Net;
using System.Net.Sockets;
using System.Runtime.Versioning;
using AgentMate.ServerCore.Hosting;
using Microsoft.AspNetCore.Builder;

namespace AgentMate.ServerCore.Tests;

/// <summary>
/// On a real server the core only exists as a Unix socket that the root user and the agentmate
/// group can open. These tests run the actual Kestrel listener, so they need Linux.
/// </summary>
[SupportedOSPlatform("linux")]
public sealed class UnixSocketListenerTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"agentmate-core-{Guid.NewGuid():N}");

    private string SocketPath => Path.Combine(_directory, "core.sock");

    [Fact]
    public async Task The_socket_serves_health_and_is_limited_to_owner_and_group()
    {
        Assert.SkipUnless(OperatingSystem.IsLinux(), "Unix socket permissions are a Linux concern.");

        await using var app = await StartAsync();

        Assert.Equal(UnixSocketFile.SocketMode, File.GetUnixFileMode(SocketPath));
        Assert.Equal(HttpStatusCode.OK, await GetHealthStatusAsync());
    }

    [Fact]
    public async Task A_socket_left_behind_by_a_crash_is_replaced()
    {
        Assert.SkipUnless(OperatingSystem.IsLinux(), "Unix socket permissions are a Linux concern.");
        Directory.CreateDirectory(_directory);
        StaleUnixSocket.Create(SocketPath);

        Assert.True(File.Exists(SocketPath));

        await using var app = await StartAsync();

        Assert.Equal(UnixSocketFile.SocketMode, File.GetUnixFileMode(SocketPath));
        Assert.Equal(HttpStatusCode.OK, await GetHealthStatusAsync());
    }

    [Fact]
    public async Task A_socket_another_process_is_serving_is_never_taken_over()
    {
        Assert.SkipUnless(OperatingSystem.IsLinux(), "Unix socket permissions are a Linux concern.");
        Directory.CreateDirectory(_directory);
        using var live = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
        live.Bind(new UnixDomainSocketEndPoint(SocketPath));
        live.Listen();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(StartAsync);

        Assert.Contains("already", error.Message, StringComparison.Ordinal);
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, recursive: true);
        }
    }

    private async Task<WebApplication> StartAsync()
    {
        var app = CoreApplication.Build([$"--Core:Listen:SocketPath={SocketPath}", "--environment", "Testing"]);
        try
        {
            await app.StartAsync(TestContext.Current.CancellationToken);
            return app;
        }
        catch
        {
            await app.DisposeAsync();
            throw;
        }
    }

    private async Task<HttpStatusCode> GetHealthStatusAsync()
    {
        using var handler = new SocketsHttpHandler
        {
            ConnectCallback = async (_, cancellationToken) =>
            {
                var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
                await socket.ConnectAsync(new UnixDomainSocketEndPoint(SocketPath), cancellationToken);
                return new NetworkStream(socket, ownsSocket: true);
            },
        };
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://agentmate-core") };
        var response = await client.GetAsync("/api/v1/health", TestContext.Current.CancellationToken);
        return response.StatusCode;
    }
}
