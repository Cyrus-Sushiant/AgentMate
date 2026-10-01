using AgentMate.ServerCore.Contracts;

namespace AgentMate.ServerCore.Docker;

/// <summary>
/// The Docker Engine API, as much of it as the core uses. <see cref="DockerEngine"/> talks to the
/// real engine over its Unix socket; <see cref="InMemoryDockerEngine"/> stands in for it in the
/// DevHost and the tests. Callers validate ids and names first (<see cref="DockerNames"/>): the
/// client builds request paths from them as they are.
/// </summary>
internal interface IDockerEngine
{
    /// <summary>The engine's version and the API version this core speaks with it; null when it does not answer.</summary>
    Task<EngineVersion?> GetVersionAsync(CancellationToken cancellationToken);

    Task<EngineInfo> GetInfoAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<EngineContainer>> ListContainersAsync(CancellationToken cancellationToken);

    /// <summary>Throws <see cref="DockerNotFoundException"/> for a container that does not exist.</summary>
    Task<EngineInspection> InspectContainerAsync(string container, CancellationToken cancellationToken);

    Task StartContainerAsync(string container, CancellationToken cancellationToken);

    Task StopContainerAsync(string container, int? timeoutSeconds, CancellationToken cancellationToken);

    Task RestartContainerAsync(string container, int? timeoutSeconds, CancellationToken cancellationToken);

    Task PauseContainerAsync(string container, CancellationToken cancellationToken);

    Task UnpauseContainerAsync(string container, CancellationToken cancellationToken);

    Task KillContainerAsync(string container, string signal, CancellationToken cancellationToken);

    Task RemoveContainerAsync(string container, bool removeVolumes, bool force, CancellationToken cancellationToken);

    /// <summary>A reading about every second while the container runs; the sequence ends when it stops.</summary>
    IAsyncEnumerable<StatsReading> StreamStatsAsync(string container, CancellationToken cancellationToken);

    /// <summary>Raw log output, stdout and stderr apart, each line starting with Docker's timestamp.</summary>
    IAsyncEnumerable<LogChunk> ReadLogsAsync(string container, LogOptions options, CancellationToken cancellationToken);

    /// <summary>docker exec with a TTY, attached: what is written goes to the process, what it prints comes back.</summary>
    Task<IExecSession> StartExecAsync(string container, ExecOptions options, CancellationToken cancellationToken);

    Task<IReadOnlyList<ImageInfo>> ListImagesAsync(CancellationToken cancellationToken);

    /// <summary>Pulls one tag (or digest) and reports the engine's progress messages.</summary>
    Task PullImageAsync(ImageReference image, Action<PullProgress> progress, CancellationToken cancellationToken);

    Task RemoveImageAsync(string image, bool force, CancellationToken cancellationToken);

    Task<IReadOnlyList<VolumeInfo>> ListVolumesAsync(CancellationToken cancellationToken);

    Task RemoveVolumeAsync(string volume, bool force, CancellationToken cancellationToken);

    Task<IReadOnlyList<NetworkInfo>> ListNetworksAsync(CancellationToken cancellationToken);

    Task RemoveNetworkAsync(string network, CancellationToken cancellationToken);

    Task<DockerDiskUsage> GetDiskUsageAsync(CancellationToken cancellationToken);

    Task<DockerPruneResult> PruneAsync(DockerPruneTarget target, bool allImages, CancellationToken cancellationToken);

    /// <summary>Events from <paramref name="since"/> (or from now), then as they happen.</summary>
    IAsyncEnumerable<EngineEvent> StreamEventsAsync(EventCursor? since, CancellationToken cancellationToken);
}

/// <summary>The engine is not installed, not running, or speaks an API too old for the core.</summary>
internal sealed class DockerUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>The container, image, volume or network does not exist.</summary>
internal sealed class DockerNotFoundException(string message) : Exception(message);

/// <summary>The engine refused the request (a running container to remove, an image in use). The message is the engine's.</summary>
internal sealed class DockerRequestException(string message) : Exception(message);

internal sealed record EngineVersion(
    string Version,
    string ApiVersion,
    string MinApiVersion,
    string NegotiatedApiVersion,
    string Os,
    string Arch);

internal sealed record EngineInfo(string? StorageDriver, int? CgroupVersion);

/// <summary>A container from the list, with the labels compose grouping and the UI need.</summary>
internal sealed record EngineContainer(ContainerSummary Summary, IReadOnlyDictionary<string, string> Labels);

/// <summary>
/// Inspect output: the details (with every environment name and the raw labels) and the
/// environment itself. Only the core sees <see cref="Environment"/>; it seeds the redactor and
/// leaves the process for RevealContainerEnv alone.
/// </summary>
internal sealed record EngineInspection(ContainerDetails Details, IReadOnlyList<KeyValuePair<string, string>> Environment);

internal sealed record BlockIoEntry(string Op, ulong Value);

internal sealed record NetworkTotals(ulong ReceivedBytes, ulong TransmittedBytes);

/// <summary>
/// One reading from the engine's stats stream: the counters <see cref="DockerStatsMath"/> needs,
/// with the previous reading's CPU counters (the engine sends both).
/// </summary>
internal sealed record StatsReading(
    DateTimeOffset ReadAt,
    ulong CpuTotal,
    ulong PreCpuTotal,
    ulong SystemCpu,
    ulong PreSystemCpu,
    uint OnlineCpus,
    int PerCpuCount,
    ulong MemoryUsage,
    ulong MemoryLimit,
    IReadOnlyDictionary<string, ulong> MemoryStats,
    IReadOnlyList<BlockIoEntry> BlockIo,
    IReadOnlyList<NetworkTotals> Networks,
    ulong Pids);

internal sealed record LogOptions(int? Tail, string? Since, bool Follow);

/// <summary>Bytes one stream wrote; lines may span chunks.</summary>
internal sealed record LogChunk(ContainerLogSource Stream, ReadOnlyMemory<byte> Data);

internal sealed record ExecOptions(IReadOnlyList<string> Command, string? User, int Columns, int Rows);

/// <summary>A running docker exec with a TTY.</summary>
internal interface IExecSession : IAsyncDisposable
{
    /// <summary>What the terminal printed; 0 once the process has ended.</summary>
    ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken);

    ValueTask WriteAsync(ReadOnlyMemory<byte> data, CancellationToken cancellationToken);

    Task ResizeAsync(int columns, int rows, CancellationToken cancellationToken);

    /// <summary>The exit code once the process has ended, or null if it is unknown.</summary>
    Task<int?> ExitCodeAsync(CancellationToken cancellationToken);
}

/// <summary>A validated image reference split the way the engine's pull wants it.</summary>
internal sealed record ImageReference(string Repository, string? Tag, string? Digest)
{
    public override string ToString() =>
        Digest is not null ? $"{Repository}@{Digest}" : $"{Repository}:{Tag ?? "latest"}";
}

/// <summary>One progress message of a pull: a layer's status and bytes, or an error.</summary>
internal sealed record PullProgress(string? Layer, string? Status, long? Current, long? Total, string? Error);

/// <summary>An engine event with the time Docker gave it, to the nanosecond.</summary>
internal sealed record EngineEvent(
    string Type,
    string Action,
    string ActorId,
    long TimeNano,
    IReadOnlyDictionary<string, string> Attributes);

/// <summary>A point in the event stream: unix nanoseconds, as Docker counts them.</summary>
internal readonly record struct EventCursor(long UnixNanoseconds)
{
    public string ToEngineTime() => DockerTime.ToEngineTime(UnixNanoseconds);
}
