using Tapper;

namespace AgentMate.ServerCore.Contracts;

// Backups (E15): the core's state, encrypted on the server with a passphrase only the user knows
// (PBKDF2-HMAC-SHA256 and AES-256-GCM), then downloaded to the app over REST and deleted. A restore
// runs over SSH as root with `agentmate-core admin restore-stage`, so it works on a core nobody can
// sign in to and on a new server.

/// <summary>The passphrase never leaves the core in any form, and is never stored or logged.</summary>
[TranspilationSource]
public sealed record BackupRequest(string Passphrase);

[TranspilationSource]
public sealed record BackupContents(
    int Users,
    int Devices,
    int Stacks,
    int Sites,
    int Certificates,
    long DatabaseBytes,
    int Files);

/// <summary>A backup waiting on the server to be downloaded (GET /api/v1/backups/{Id}); it goes after ExpiresAtUnixMs.</summary>
[TranspilationSource]
public sealed record BackupInfo(
    Guid Id,
    string FileName,
    long SizeBytes,
    string Sha256,
    long CreatedAtUnixMs,
    long ExpiresAtUnixMs,
    string CoreVersion,
    BackupContents Contents);
