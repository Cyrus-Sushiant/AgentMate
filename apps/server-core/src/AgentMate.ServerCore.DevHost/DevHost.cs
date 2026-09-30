using System.Net;
using AgentMate.ServerCore;
using AgentMate.ServerCore.Data;
using AgentMate.ServerCore.Security;
using Microsoft.AspNetCore.Identity;

namespace AgentMate.ServerCore.DevHost;

/// <summary>
/// Starts the core on 127.0.0.1 (port 7810 unless AGENTMATE_DEV_CORE_PORT says otherwise) with a
/// throwaway data folder. Only development builds of the desktop app connect to it, and only when
/// AGENTMATE_DEPLOY_DEV_CORE names it.
/// </summary>
/// <remarks>
/// A real server gets its owner and device from `admin` commands run over SSH. The DevHost has no
/// SSH, so it has a fixed development owner and a loopback-only endpoint that enrolls a device for
/// it. The machine it reports on is pretend (Fakes/): metrics that move, a few updates waiting,
/// Docker and nginx running, and a reboot that drops every connection for a few seconds. This
/// project is never published, so none of that can reach a real server.
/// </remarks>
internal static class DevHost
{
    public const int DefaultPort = 7810;

    public const string DevUserName = "dev";

    public const string DevPassword = "agentmate-local-password";

    public static async Task<int> RunAsync(string[] args)
    {
        var port = int.TryParse(Environment.GetEnvironmentVariable("AGENTMATE_DEV_CORE_PORT"), out var chosen)
            ? chosen
            : DefaultPort;
        var data = Path.Combine(Path.GetTempPath(), "agentmate-core-devhost");

        await using var app = CoreApplication.Build(
            [
                $"--Core:Listen:TcpPort={port}",
                $"--Core:DataDirectory={data}",
                "--environment",
                "Development",
                .. args,
            ],
            Fakes.FakePlatform.Add);
        app.MapPost("/dev/enroll", EnrollAsync).AllowAnonymous();
        await app.StartAsync();
        await EnsureDevOwnerAsync(app.Services);
        await app.WaitForShutdownAsync();
        return 0;
    }

    private static async Task EnsureDevOwnerAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<CoreUser>>();
        if (await users.FindByNameAsync(DevUserName) is not null)
        {
            return;
        }

        var owner = new CoreUser { UserName = DevUserName };
        var created = await users.CreateAsync(owner, DevPassword);
        var result = created.Succeeded ? await users.AddToRoleAsync(owner, CoreRoles.Owner) : created;
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"The DevHost could not create its development owner: {string.Join(" ", result.Errors.Select(e => e.Description))}");
        }
    }

    private static async Task<IResult> EnrollAsync(DevEnrollRequest request, HttpContext http, CoreDbContext db, UserManager<CoreUser> users)
    {
        if (http.Connection.RemoteIpAddress is not { } remote || !IPAddress.IsLoopback(remote))
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        var publicKey = DeviceKeys.ParsePublicKey(request.PublicKey);
        var owner = await users.FindByNameAsync(DevUserName);
        if (publicKey is null || owner is null)
        {
            return Results.BadRequest();
        }

        var device = new Device
        {
            Id = Guid.NewGuid(),
            UserId = owner.Id,
            Name = string.IsNullOrWhiteSpace(request.DeviceName) ? "Development" : request.DeviceName.Trim()[..Math.Min(100, request.DeviceName.Trim().Length)],
            PublicKey = publicKey,
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();
        return Results.Ok(new DevEnrollResponse(device.Id, DevUserName));
    }

    internal sealed record DevEnrollRequest(string PublicKey, string? DeviceName);

    internal sealed record DevEnrollResponse(Guid DeviceId, string UserName);
}
