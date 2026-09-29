using Microsoft.Data.Sqlite;

namespace AgentMate.ServerCore.Tests;

/// <summary>Temporary state folders for tests, removed again even when a database was open in them.</summary>
internal static class TestFolders
{
    public static string Create(string prefix) =>
        Path.Combine(Path.GetTempPath(), $"{prefix}-{Guid.NewGuid():N}");

    /// <summary>
    /// SQLite's connection pool keeps the database file open, which Windows will not delete, so the
    /// pool is emptied first. A few retries cover a handle that is still being let go.
    /// </summary>
    public static void Delete(string path)
    {
        SqliteConnection.ClearAllPools();
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                if (Directory.Exists(path))
                {
                    Directory.Delete(path, recursive: true);
                }

                return;
            }
            catch (IOException) when (attempt < 10)
            {
                Thread.Sleep(100);
            }
        }
    }
}
