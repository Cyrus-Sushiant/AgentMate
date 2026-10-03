using System.Formats.Tar;
using System.IO.Compression;
using AgentMate.ServerCore.Backups;
using AgentMate.ServerCore.Data;
using Microsoft.EntityFrameworkCore;

namespace AgentMate.ServerCore.Tests.Backups;

/// <summary>What goes into a backup, and what a restore refuses to stage.</summary>
public sealed class BackupArchiveTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"core-archive-{Guid.NewGuid():N}");

    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    public void Dispose() => TestFolders.Delete(_root);

    private async Task<(string Data, byte[] Payload)> PayloadAsync()
    {
        var data = Path.Combine(_root, "data");
        await CoreDatabase.PrepareAsync(CoreDatabase.PathIn(data), Cancel);
        Directory.CreateDirectory(Path.Combine(data, "keys"));
        await File.WriteAllTextAsync(Path.Combine(data, "keys", "key-1.xml"), "<key/>", Cancel);
        Directory.CreateDirectory(Path.Combine(data, "stacks", "shop", "1"));
        await File.WriteAllTextAsync(Path.Combine(data, "stacks", "shop", "1", "compose.yaml"), "services: {}\n", Cancel);
        Directory.CreateDirectory(Path.Combine(data, "jobs"));
        await File.WriteAllTextAsync(Path.Combine(data, "jobs", "old.log"), "noise", Cancel);
        var work = Path.Combine(_root, "work");
        Directory.CreateDirectory(work);
        using var output = new MemoryStream();
        await BackupArchive.WriteAsync(data, work, output, "1.2.0", "web-01", 42, Cancel);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        return (data, output.ToArray());
    }

    private static List<string> Names(byte[] payload)
    {
        using var gzip = new GZipStream(new MemoryStream(payload), CompressionMode.Decompress);
        using var reader = new TarReader(gzip);
        var names = new List<string>();
        while (reader.GetNextEntry() is { } entry)
        {
            names.Add(entry.Name);
        }

        return names;
    }

    [Fact]
    public async Task The_database_keys_and_stacks_go_in_and_job_logs_stay_out()
    {
        var (_, payload) = await PayloadAsync();

        var names = Names(payload);

        Assert.Equal("backup.json", names[0]);
        Assert.Contains("core.db", names);
        Assert.Contains("keys/key-1.xml", names);
        Assert.Contains("stacks/shop/1/compose.yaml", names);
        Assert.DoesNotContain(names, name => name.StartsWith("jobs", StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_backup_from_a_newer_core_is_refused_and_leaves_nothing()
    {
        var (_, payload) = await PayloadAsync();
        var into = Path.Combine(_root, "stage");

        var refused = await Assert.ThrowsAsync<BackupRefusedException>(() =>
            BackupArchive.StageAsync(new MemoryStream(payload), into, [], 42, Cancel));

        Assert.Contains("newer server core (1.2.0)", refused.Message, StringComparison.Ordinal);
        Assert.False(Directory.Exists(into));
    }

    [Fact]
    public async Task A_staged_backup_matches_what_the_core_knows()
    {
        var (data, payload) = await PayloadAsync();
        await using var db = new CoreDbContext(CoreDatabase.Options(CoreDatabase.PathIn(data)));
        var known = db.Database.GetMigrations().ToList();
        var into = Path.Combine(_root, "stage");

        var manifest = await BackupArchive.StageAsync(new MemoryStream(payload), into, known, 42, Cancel);

        Assert.Equal("web-01", manifest.HostName);
        Assert.Equal(known[^1], manifest.LatestMigration);
        Assert.Equal(2, manifest.Contents.Files);
        Assert.True(File.Exists(Path.Combine(into, "stacks", "shop", "1", "compose.yaml")));
        Assert.Empty(await BackupArchive.OwnersAsync(into, Cancel));
    }
}
