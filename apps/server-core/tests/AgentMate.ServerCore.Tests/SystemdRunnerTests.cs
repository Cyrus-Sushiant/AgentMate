using AgentMate.ServerCore.Execution;
using Microsoft.Extensions.Logging.Abstractions;

namespace AgentMate.ServerCore.Tests;

/// <summary>
/// Privileged work (package operations, reboots) runs in a transient systemd unit of its own, so it
/// gets a normal environment, outlives a core restart and, above all, is stopped as a whole: every
/// process in the unit's cgroup, not just the one the core started (AC2). These tests pin the exact
/// commands; a real systemd check runs on the test servers.
/// </summary>
public sealed class SystemdRunnerTests
{
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    private static readonly Guid _job = Guid.Parse("0f8fad5b-d9cb-469f-a165-70867728950e");

    private static readonly string _unit = SystemdRunner.UnitName("job", _job);

    private static ProcessSpec Upgrade => new()
    {
        Program = "/usr/bin/apt-get",
        Arguments = ["-y", "upgrade"],
        Environment = new Dictionary<string, string> { ["DEBIAN_FRONTEND"] = "noninteractive" },
        Timeout = TimeSpan.FromMinutes(30),
    };

    private static SystemdRunner Runner(FakeProcessRunner processes) =>
        new(processes, TimeProvider.System, NullLogger<SystemdRunner>.Instance);

    [Fact]
    public void Unit_names_are_derived_from_the_job_and_nothing_else()
    {
        Assert.Equal("agentmate-job-0f8fad5bd9cb469fa16570867728950e", _unit);
        Assert.Throws<ArgumentException>(() => SystemdRunner.UnitName("Job; reboot", _job));
    }

    [Fact]
    public async Task A_command_runs_in_a_collected_transient_unit_with_its_output_piped_back()
    {
        var processes = new FakeProcessRunner();
        processes.Respond(spec => spec.Program.EndsWith("systemd-run", StringComparison.Ordinal), _ => FakeProcessRunner.Ok("done\n"));

        var result = await Runner(processes).RunAsync(_unit, "Upgrade all packages", Upgrade, onLine: null, Cancel);

        Assert.True(result.Succeeded);
        var run = Assert.Single(processes.Calls);
        Assert.Equal("systemd-run", Path.GetFileName(run.Program));
        Assert.Equal(
            [
                $"--unit={_unit}",
                "--description=AgentMate: Upgrade all packages",
                "--collect",
                "--quiet",
                "--wait",
                "--pipe",
                "--property=RuntimeMaxSec=1920",
                "--property=TimeoutStopSec=30",
                "--setenv=DEBIAN_FRONTEND=noninteractive",
                "--setenv=LC_ALL=C",
                "--setenv=LANG=C",
                "--setenv=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "--",
                "/usr/bin/apt-get",
                "-y",
                "upgrade",
            ],
            run.Arguments);
        // The core's own timer ends the run and stops the unit; systemd's limit, a little later, is
        // the backstop for a core that is no longer there to do it.
        Assert.Equal(Upgrade.Timeout, run.Timeout);
    }

    [Fact]
    public async Task Cancelling_stops_the_whole_unit()
    {
        var processes = new FakeProcessRunner();
        processes.Respond(spec => spec.Program.EndsWith("systemd-run", StringComparison.Ordinal), FakeProcessRunner.UntilCancelled);
        processes.Respond(spec => spec.Arguments is ["show", ..], _ => FakeProcessRunner.Ok("inactive\n"));
        using var cancel = CancellationTokenSource.CreateLinkedTokenSource(Cancel);

        var run = Runner(processes).RunAsync(_unit, "Upgrade all packages", Upgrade, onLine: null, cancel.Token);
        await processes.WaitForCallAsync(spec => spec.Program.EndsWith("systemd-run", StringComparison.Ordinal));
        await cancel.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => run);
        Assert.Contains(processes.Calls, spec =>
            Path.GetFileName(spec.Program) == "systemctl" && spec.Arguments.SequenceEqual(["stop", $"{_unit}.service"]));
        Assert.DoesNotContain(processes.Calls, spec => spec.Arguments.Contains("--signal=SIGKILL"));
    }

    [Fact]
    public async Task A_unit_that_will_not_stop_is_killed()
    {
        var processes = new FakeProcessRunner();
        processes.Respond(spec => spec.Program.EndsWith("systemd-run", StringComparison.Ordinal), FakeProcessRunner.UntilCancelled);
        processes.Respond(spec => spec.Arguments is ["show", ..], _ => FakeProcessRunner.Ok("deactivating\n"));
        using var cancel = CancellationTokenSource.CreateLinkedTokenSource(Cancel);

        var run = Runner(processes).RunAsync(_unit, "Upgrade all packages", Upgrade, onLine: null, cancel.Token);
        await processes.WaitForCallAsync(spec => spec.Program.EndsWith("systemd-run", StringComparison.Ordinal));
        await cancel.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => run);
        Assert.Contains(processes.Calls, spec =>
            spec.Arguments.SequenceEqual(["kill", "--signal=SIGKILL", $"{_unit}.service"]));
    }

    [Fact]
    public async Task A_run_past_its_time_limit_stops_the_unit_and_says_so()
    {
        var processes = new FakeProcessRunner();
        processes.Respond(
            spec => spec.Program.EndsWith("systemd-run", StringComparison.Ordinal),
            _ => new ProcessResult(-1, "", "", TimedOut: true, OutputTruncated: false));
        processes.Respond(spec => spec.Arguments is ["show", ..], _ => FakeProcessRunner.Ok("inactive\n"));

        var result = await Runner(processes).RunAsync(_unit, "Upgrade all packages", Upgrade, onLine: null, Cancel);

        Assert.True(result.TimedOut);
        Assert.Contains(processes.Calls, spec => spec.Arguments.SequenceEqual(["stop", $"{_unit}.service"]));
    }

    [Fact]
    public async Task A_scheduled_command_runs_later_from_a_transient_timer_and_returns_at_once()
    {
        var processes = new FakeProcessRunner();
        var reboot = SystemdRunner.UnitName("reboot", _job);

        await Runner(processes).ScheduleAsync(
            reboot,
            "Reboot",
            new ProcessSpec { Program = "/usr/bin/systemctl", Arguments = ["reboot"] },
            TimeSpan.FromSeconds(5),
            Cancel);

        var schedule = Assert.Single(processes.Calls);
        Assert.Equal(
            [
                $"--unit={reboot}",
                "--description=AgentMate: Reboot",
                "--collect",
                "--quiet",
                "--on-active=5s",
                "--timer-property=AccuracySec=100ms",
                "--setenv=LC_ALL=C",
                "--setenv=LANG=C",
                "--setenv=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "--",
                "/usr/bin/systemctl",
                "reboot",
            ],
            schedule.Arguments);
        // A timer cannot be waited on or piped; systemd-run refuses the combination.
        Assert.DoesNotContain("--wait", schedule.Arguments);
        Assert.DoesNotContain("--pipe", schedule.Arguments);
    }

    [Fact]
    public async Task A_schedule_that_systemd_refuses_is_an_error()
    {
        var processes = new FakeProcessRunner();
        processes.Respond(_ => true, _ => new ProcessResult(1, "", "Failed to start transient timer unit", false, false));

        var error = await Assert.ThrowsAsync<ProcessFailedException>(() => Runner(processes).ScheduleAsync(
            SystemdRunner.UnitName("reboot", _job),
            "Reboot",
            new ProcessSpec { Program = "/usr/bin/systemctl", Arguments = ["reboot"] },
            TimeSpan.FromSeconds(5),
            Cancel));

        Assert.Contains("Failed to start transient timer unit", error.Message, StringComparison.Ordinal);
    }
}
