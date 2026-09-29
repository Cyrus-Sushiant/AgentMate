using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AgentMate.ServerCore.Data;

/// <summary>The core's own database: Identity's tables plus devices, sessions and the audit trail.</summary>
internal sealed class CoreDbContext(DbContextOptions<CoreDbContext> options)
    : IdentityDbContext<CoreUser, CoreRole, Guid>(options)
{
    public DbSet<Device> Devices => Set<Device>();

    public DbSet<DeviceSession> DeviceSessions => Set<DeviceSession>();

    public DbSet<EnrollmentCode> EnrollmentCodes => Set<EnrollmentCode>();

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    public DbSet<AuditAnchor> AuditAnchors => Set<AuditAnchor>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Device>(device =>
        {
            device.HasKey(d => d.Id);
            device.Property(d => d.Name).HasMaxLength(100);
            device.HasIndex(d => d.UserId);
            device.HasOne<CoreUser>().WithMany().HasForeignKey(d => d.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<DeviceSession>(session =>
        {
            session.HasKey(s => s.Id);
            session.HasIndex(s => s.DeviceId);
            session.HasOne<Device>().WithMany().HasForeignKey(s => s.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<EnrollmentCode>(code =>
        {
            code.HasKey(c => c.Id);
            code.HasIndex(c => c.CodeHash).IsUnique();
            code.HasOne<CoreUser>().WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AuditEvent>(audit =>
        {
            // Ids are assigned by the appender while it holds the write lock, so the chain has no gaps.
            audit.HasKey(a => a.Id);
            audit.Property(a => a.Id).ValueGeneratedNever();
            audit.Property(a => a.Action).HasMaxLength(100);
            audit.HasIndex(a => a.At);
        });

        builder.Entity<AuditAnchor>(anchor =>
        {
            anchor.HasKey(a => a.Id);
            anchor.Property(a => a.Id).ValueGeneratedNever();
        });
    }
}

/// <summary>For `dotnet ef`: a context on a throwaway file, since the real path comes from configuration.</summary>
internal sealed class DesignTimeCoreDbContextFactory : IDesignTimeDbContextFactory<CoreDbContext>
{
    public CoreDbContext CreateDbContext(string[] args) => new(CoreDatabase.Options("design-time.db"));
}
