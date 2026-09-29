using Microsoft.AspNetCore.Identity;

namespace AgentMate.ServerCore.Data;

// Timestamps are unix milliseconds throughout: SQLite has no date type, and a number sorts and
// compares the same way in SQL as in code.

/// <summary>A person who can sign in to this core.</summary>
internal sealed class CoreUser : IdentityUser<Guid>
{
    public long CreatedAt { get; set; }

    /// <summary>
    /// The newest 30-second step an authenticator code was accepted for. That code and every older
    /// one are spent (see OneTimeAuthenticatorTokenProvider).
    /// </summary>
    public long LastTotpStep { get; set; }
}

internal sealed class CoreRole : IdentityRole<Guid>
{
}

/// <summary>A desktop that holds a private key; every sign-in and renewal is signed with it.</summary>
internal sealed class Device
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public required string Name { get; set; }

    /// <summary>The P-256 public key as SubjectPublicKeyInfo (DER).</summary>
    public required byte[] PublicKey { get; set; }

    public long CreatedAt { get; set; }

    public long? LastSeenAt { get; set; }

    public long? RevokedAt { get; set; }
}

/// <summary>One sign-in of one device. Renewing it needs a fresh signature, never a stored secret.</summary>
internal sealed class DeviceSession
{
    public Guid Id { get; set; }

    public Guid DeviceId { get; set; }

    public Guid UserId { get; set; }

    public long CreatedAt { get; set; }

    public long LastRenewedAt { get; set; }

    /// <summary>The absolute end. Renewals never move it.</summary>
    public long ExpiresAt { get; set; }

    public long? RevokedAt { get; set; }

    /// <summary>Until when sensitive actions go ahead without asking for the password again.</summary>
    public long? StepUpUntil { get; set; }

    /// <summary>The user's security stamp at sign-in. A password reset changes it, which ends the session.</summary>
    public required string SecurityStamp { get; set; }
}

/// <summary>A single-use code an Owner creates so another device can enroll.</summary>
internal sealed class EnrollmentCode
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid CreatedBy { get; set; }

    /// <summary>SHA-256 of the code. The code itself is shown once and never stored.</summary>
    public required string CodeHash { get; set; }

    public long CreatedAt { get; set; }

    public long ExpiresAt { get; set; }

    public long? RedeemedAt { get; set; }
}

/// <summary>One entry of the hash-chained audit trail.</summary>
internal sealed class AuditEvent
{
    public long Id { get; set; }

    public long At { get; set; }

    public Guid? ActorUserId { get; set; }

    public Guid? DeviceId { get; set; }

    /// <summary>The Unix user on the other end of the socket, when the core could tell.</summary>
    public int? PeerUid { get; set; }

    public required string Action { get; set; }

    public string? Target { get; set; }

    /// <summary>Redacted parameters as JSON.</summary>
    public string? Parameters { get; set; }

    public required string Result { get; set; }

    public required string PrevHash { get; set; }

    public required string Hash { get; set; }
}

/// <summary>Where the chain continues after old events were pruned.</summary>
internal sealed class AuditAnchor
{
    public int Id { get; set; }

    public long LastPrunedId { get; set; }

    public required string LastPrunedHash { get; set; }
}
