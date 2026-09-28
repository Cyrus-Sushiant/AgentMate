using Tapper;

namespace AgentMate.ServerCore.Contracts;

/// <summary>Answer of the anonymous health endpoint: which core and API version is running.</summary>
[TranspilationSource]
public sealed record HealthResponse(string Status, string Version, int ApiVersion);

/// <summary>Answer of the hub's ping, used for latency and to spot clock skew on the server.</summary>
[TranspilationSource]
public sealed record PingResponse(long ServerTimeUnixMs);
