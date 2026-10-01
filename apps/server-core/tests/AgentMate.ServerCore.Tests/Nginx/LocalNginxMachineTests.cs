using System.Text;
using AgentMate.ServerCore.Certificates;
using AgentMate.ServerCore.Certificates.Acme;
using AgentMate.ServerCore.Nginx;

namespace AgentMate.ServerCore.Tests.Nginx;

/// <summary>The real file operations, in a temporary root. Symlinks and modes need Linux (the container run covers them).</summary>
public sealed class LocalNginxMachineTests : IDisposable
{
    private readonly TestRoot _root = new();

    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    private LocalNginxMachine Machine() => new(new FakeProcessRunner(), Units.Runner(new FakeProcessRunner()), _root.Path);

    [Fact]
    public async Task The_current_link_moves_in_one_step_and_reads_through()
    {
        Assert.SkipWhen(OperatingSystem.IsWindows(), "Symlinks need Linux here.");
        var machine = Machine();
        await machine.WriteAsync("/etc/nginx/agentmate/releases/1/http.conf", "one"u8.ToArray(), UnixFileMode.UserRead | UnixFileMode.UserWrite, Cancel);
        await machine.WriteAsync("/etc/nginx/agentmate/releases/2/http.conf", "two"u8.ToArray(), UnixFileMode.UserRead | UnixFileMode.UserWrite, Cancel);

        await machine.ReplaceLinkAsync("/etc/nginx/agentmate/current", "releases/1", Cancel);
        var first = await machine.ReadTextAsync("/etc/nginx/agentmate/current/http.conf", Cancel);
        await machine.ReplaceLinkAsync("/etc/nginx/agentmate/current", "releases/2", Cancel);

        Assert.Equal(("one", "two"), (first, await machine.ReadTextAsync("/etc/nginx/agentmate/current/http.conf", Cancel)));
        Assert.Equal("releases/2", await machine.ReadLinkAsync("/etc/nginx/agentmate/current", Cancel));
        Assert.Equal(["1", "2"], (await machine.ListAsync("/etc/nginx/agentmate/releases", Cancel)).Order(StringComparer.Ordinal));
        Assert.Contains("current", await machine.ListAsync("/etc/nginx/agentmate", Cancel));
        if (!OperatingSystem.IsWindows())
        {
            Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, File.GetUnixFileMode(_root.Resolve("/etc/nginx/agentmate/releases/2/http.conf")));
        }
    }

    [Fact]
    public async Task Files_are_replaced_whole_and_ranges_read_back()
    {
        var machine = Machine();
        await machine.WriteAsync("/var/log/nginx/error.log", Encoding.UTF8.GetBytes("0123456789"), UnixFileMode.UserRead | UnixFileMode.UserWrite, Cancel);

        Assert.Equal(10, await machine.LengthAsync("/var/log/nginx/error.log", Cancel));
        Assert.Equal("4567", Encoding.UTF8.GetString(await machine.ReadRangeAsync("/var/log/nginx/error.log", 4, 4, Cancel)));
        Assert.Empty(await machine.ReadRangeAsync("/var/log/nginx/error.log", 20, 4, Cancel));
        Assert.Null(await machine.ReadTextAsync("/var/log/nginx/missing.log", Cancel));
        await machine.DeleteAsync("/var/log/nginx", Cancel);
        Assert.False(await machine.ExistsAsync("/var/log/nginx/error.log", Cancel));
        await Assert.ThrowsAsync<ArgumentException>(() => machine.ReadTextAsync("/etc/../root/.ssh/id_rsa", Cancel));
    }

    [Fact]
    public async Task Challenge_answers_land_world_readable_in_the_webroot_and_odd_tokens_are_refused()
    {
        var machine = new SimulatedNginxMachine();
        var publisher = new WebrootChallengePublisher(machine, NginxLayout.Debian);

        await publisher.PublishAsync("blog.example.com", "tok-EN_123", "tok-EN_123.thumb", Cancel);

        var path = "/var/www/agentmate/acme/.well-known/acme-challenge/tok-EN_123";
        Assert.Equal("tok-EN_123.thumb", machine.Text(path));
        Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead, machine.ModeOf(path));
        await publisher.RemoveAsync("blog.example.com", "tok-EN_123", Cancel);
        Assert.False(machine.Exists(path));
        await Assert.ThrowsAsync<AcmeException>(() => publisher.PublishAsync("blog.example.com", "../../etc/passwd", "x", Cancel));

        machine.SeLinux = true;
        await publisher.PublishAsync("blog.example.com", "t2", "t2.thumb", Cancel);
        Assert.Contains("restorecon /var/www/agentmate/acme/.well-known/acme-challenge/t2", machine.Commands);
    }

    public void Dispose() => _root.Dispose();
}
