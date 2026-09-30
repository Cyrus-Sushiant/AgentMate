using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

namespace AgentMate.ServerCore.Execution;

internal enum OutputStream
{
    Out,
    Err,
}

/// <summary>One line a program wrote, without its line ending.</summary>
internal readonly record struct OutputLine(OutputStream Stream, string Text);

/// <summary>
/// A program to run: a path or a plain name and a list of arguments, never a shell string. The
/// environment is what the runner sets plus <see cref="Environment"/>; nothing is inherited from
/// the core, which keeps its own settings (and anything secret in them) away from the programs.
/// </summary>
internal sealed record ProcessSpec
{
    /// <summary>An absolute path, or a plain name looked up in <see cref="ProcessRunner.SearchPath"/>.</summary>
    public required string Program { get; init; }

    public IReadOnlyList<string> Arguments { get; init; } = [];

    public IReadOnlyDictionary<string, string> Environment { get; init; } = new Dictionary<string, string>();

    public string? WorkingDirectory { get; init; }

    public TimeSpan Timeout { get; init; } = TimeSpan.FromMinutes(1);

    /// <summary>How much of each output stream the result keeps. Lines still reach the callback.</summary>
    public int MaxOutputBytes { get; init; } = 1024 * 1024;

    /// <summary>Written to standard input, which is then closed. Without it, input is closed at once.</summary>
    public string? StandardInput { get; init; }
}

internal sealed record ProcessResult(
    int ExitCode,
    string StandardOutput,
    string StandardError,
    bool TimedOut,
    bool OutputTruncated)
{
    public bool Succeeded => ExitCode == 0 && !TimedOut;
}

/// <summary>The program could not be started at all: it is missing, or the system refused.</summary>
internal sealed class ProcessStartException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>A program ran and failed where the caller needs it to succeed.</summary>
internal sealed class ProcessFailedException(string message) : Exception(message);

internal interface IProcessRunner
{
    /// <summary>
    /// Runs the program to its end. Past its time limit it is killed with everything it started
    /// and the result says it timed out; a cancelled run is killed the same way and throws.
    /// </summary>
    Task<ProcessResult> RunAsync(
        ProcessSpec spec,
        Action<OutputLine>? onLine = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Starts programs directly (System.Diagnostics.Process with an argument list). On Linux each run
/// starts in a process group of its own (through setsid), so a kill reaches whatever the program
/// started as well. A child that leaves the group escapes that; privileged work therefore runs in
/// a transient systemd unit instead (<see cref="SystemdRunner"/>), whose cgroup nothing leaves.
/// </summary>
internal sealed partial class ProcessRunner(TimeProvider time) : IProcessRunner
{
    /// <summary>Where plain program names are looked up, whatever PATH the core was started with.</summary>
    public const string SearchPath = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

    /// <summary>Longer lines are split, so one runaway line cannot hold the whole output in memory.</summary>
    public const int MaxLineChars = 16 * 1024;

    public const int MaxOutputCap = 64 * 1024 * 1024;

    public static readonly TimeSpan MaxTimeout = TimeSpan.FromHours(24);

    /// <summary>After an exit, how long output still being written by a straggler is waited for.</summary>
    private static readonly TimeSpan _drainGrace = TimeSpan.FromSeconds(2);

    private static readonly TimeSpan _killGrace = TimeSpan.FromSeconds(10);

    private static readonly UTF8Encoding _utf8 = new(encoderShouldEmitUTF8Identifier: false);

    private static readonly Lazy<string?> _setsid = new(() =>
        OperatingSystem.IsLinux() ? FindInSearchPath("setsid") : null);

    /// <summary>
    /// The Linux part of <see cref="BaseEnvironment"/>, which is what a transient unit gets. It is
    /// declared first because static initializers run in order and the next one reads it.
    /// </summary>
    public static IReadOnlyList<KeyValuePair<string, string>> LinuxEnvironment { get; } =
    [
        new("LC_ALL", "C"),
        new("LANG", "C"),
        new("PATH", SearchPath),
    ];

    /// <summary>
    /// What every program gets. On Linux: the fixed search path and the C locale, so output parses
    /// the same on every server. On Windows (development and tests only) the few variables a
    /// Windows program cannot start without.
    /// </summary>
    public static IReadOnlyList<KeyValuePair<string, string>> BaseEnvironment { get; } = CreateBaseEnvironment();

    public Task<ProcessResult> RunAsync(
        ProcessSpec spec,
        Action<OutputLine>? onLine = null,
        CancellationToken cancellationToken = default) =>
        RunAsync(spec, onLine, started: null, cancellationToken);

    /// <param name="started">Told the process id once it runs (on Linux also its process group).</param>
    public async Task<ProcessResult> RunAsync(
        ProcessSpec spec,
        Action<OutputLine>? onLine,
        Action<int>? started,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(spec);
        Validate(spec);
        var program = Resolve(spec.Program);
        cancellationToken.ThrowIfCancellationRequested();

        var start = new ProcessStartInfo
        {
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardInputEncoding = _utf8,
            StandardOutputEncoding = _utf8,
            StandardErrorEncoding = _utf8,
        };
        var inGroup = _setsid.Value is not null;
        if (inGroup)
        {
            // setsid makes the program the leader of a new session and process group, without a
            // fork (the core's child is never a group leader), so its pid is also the group id.
            start.FileName = _setsid.Value!;
            start.ArgumentList.Add(program);
        }
        else
        {
            start.FileName = program;
        }

        foreach (var argument in spec.Arguments)
        {
            start.ArgumentList.Add(argument);
        }

        start.Environment.Clear();
        foreach (var (name, value) in BaseEnvironment)
        {
            start.Environment[name] = value;
        }

        foreach (var (name, value) in spec.Environment)
        {
            start.Environment[name] = value;
        }

        if (spec.WorkingDirectory is not null)
        {
            start.WorkingDirectory = spec.WorkingDirectory;
        }

        using var process = new Process { StartInfo = start };
        try
        {
            if (!process.Start())
            {
                throw new ProcessStartException($"Could not start {spec.Program}.");
            }
        }
        catch (Win32Exception error)
        {
            throw new ProcessStartException($"Could not start {spec.Program}: {error.Message}", error);
        }

        started?.Invoke(process.Id);
        var output = new Capture(spec.MaxOutputBytes);
        var errors = new Capture(spec.MaxOutputBytes);
        var reading = Task.WhenAll(
            ReadLinesAsync(process.StandardOutput, OutputStream.Out, output, onLine),
            ReadLinesAsync(process.StandardError, OutputStream.Err, errors, onLine));
        var writing = WriteInputAsync(process.StandardInput, spec.StandardInput);

        using var timeout = new CancellationTokenSource(spec.Timeout, time);
        using var either = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);
        var timedOut = false;
        try
        {
            await process.WaitForExitAsync(either.Token);
        }
        catch (OperationCanceledException)
        {
            timedOut = !cancellationToken.IsCancellationRequested;
            Kill(process, inGroup);
            try
            {
                await process.WaitForExitAsync(CancellationToken.None).WaitAsync(_killGrace, CancellationToken.None);
            }
            catch (TimeoutException)
            {
                // It did not die in time; it is abandoned rather than waited on for ever.
            }
        }

        try
        {
            // The pipes stay open while anything the program started still holds them; a
            // daemon that kept them is not waited for.
            await Task.WhenAll(reading, writing).WaitAsync(_drainGrace, CancellationToken.None);
        }
        catch (TimeoutException)
        {
            if (!timedOut && !cancellationToken.IsCancellationRequested && inGroup)
            {
                Kill(process, inGroup);
            }
        }

        cancellationToken.ThrowIfCancellationRequested();
        var exitCode = timedOut || !process.HasExited ? -1 : process.ExitCode;
        return new ProcessResult(
            exitCode,
            output.Text,
            errors.Text,
            timedOut,
            output.Truncated || errors.Truncated);
    }

    /// <summary>The absolute path a spec's program runs from.</summary>
    public static string Resolve(string program)
    {
        if (IsAbsolute(program))
        {
            return program;
        }

        return FindInSearchPath(program)
            ?? throw new ProcessStartException($"{program} is not installed (looked in {string.Join(':', SearchDirectories())}).");
    }

    /// <summary>A POSIX path from the root (Linux commands), or a fully qualified Windows path.</summary>
    public static bool IsAbsolute(string program) =>
        program.StartsWith('/') || (OperatingSystem.IsWindows() && Path.IsPathFullyQualified(program));

    private static void Validate(ProcessSpec spec)
    {
        var program = spec.Program;
        if (string.IsNullOrEmpty(program) || program.Any(char.IsWhiteSpace) || program.Contains('\0', StringComparison.Ordinal))
        {
            throw new ArgumentException("A program is an absolute path or a plain name, without spaces.", nameof(spec));
        }

        if (!IsAbsolute(program) && !PlainName().IsMatch(program))
        {
            throw new ArgumentException($"'{program}' is neither an absolute path nor a plain program name.", nameof(spec));
        }

        if (spec.Arguments.Any(argument => argument is null || argument.Contains('\0', StringComparison.Ordinal)))
        {
            throw new ArgumentException("Arguments cannot be null or contain NUL characters.", nameof(spec));
        }

        foreach (var (name, value) in spec.Environment)
        {
            if (!EnvironmentName().IsMatch(name) || value is null || value.Contains('\0', StringComparison.Ordinal))
            {
                throw new ArgumentException($"'{name}' is not a usable environment variable.", nameof(spec));
            }
        }

        if (spec.WorkingDirectory is not null && !IsAbsolute(spec.WorkingDirectory))
        {
            throw new ArgumentException("The working directory must be an absolute path.", nameof(spec));
        }

        if (spec.Timeout <= TimeSpan.Zero || spec.Timeout > MaxTimeout)
        {
            throw new ArgumentException("A time limit is more than zero and at most a day.", nameof(spec));
        }

        if (spec.MaxOutputBytes is < 0 or > MaxOutputCap)
        {
            throw new ArgumentException("The output cap is between 0 and 64 MiB.", nameof(spec));
        }
    }

    private static string? FindInSearchPath(string name)
    {
        foreach (var directory in SearchDirectories())
        {
            var candidate = Path.Combine(directory, name);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            if (OperatingSystem.IsWindows() && File.Exists(candidate + ".exe"))
            {
                return candidate + ".exe";
            }
        }

        return null;
    }

    /// <summary>The fixed list on Linux and macOS; on Windows, which only runs tests, the PATH.</summary>
    private static string[] SearchDirectories() => OperatingSystem.IsWindows()
        ? (Environment.GetEnvironmentVariable("PATH") ?? string.Empty)
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        : SearchPath.Split(':');

    private static List<KeyValuePair<string, string>> CreateBaseEnvironment()
    {
        if (!OperatingSystem.IsWindows())
        {
            return [.. LinuxEnvironment];
        }

        var keep = new[] { "SystemRoot", "windir", "PATH", "PATHEXT", "ComSpec", "TEMP", "TMP" };
        return [.. keep
            .Select(name => (Name: name, Value: Environment.GetEnvironmentVariable(name)))
            .Where(entry => entry.Value is not null)
            .Select(entry => new KeyValuePair<string, string>(entry.Name, entry.Value!))];
    }

    private static void Kill(Process process, bool inGroup)
    {
        if (inGroup && OperatingSystem.IsLinux())
        {
            // The whole group, including children that the process tree no longer links.
            _ = UnixSignals.KillGroup(process.Id);
        }

        try
        {
            process.Kill(entireProcessTree: true);
        }
        catch (Exception error) when (error is InvalidOperationException or Win32Exception or NotSupportedException)
        {
            // Already gone.
        }
    }

    private static async Task ReadLinesAsync(
        StreamReader reader,
        OutputStream stream,
        Capture capture,
        Action<OutputLine>? onLine)
    {
        var buffer = new char[4096];
        var line = new StringBuilder();
        var afterCarriageReturn = false;

        void Emit()
        {
            var text = line.ToString();
            line.Clear();
            capture.Add(text);
            onLine?.Invoke(new OutputLine(stream, text));
        }

        try
        {
            int read;
            while ((read = await reader.ReadAsync(buffer.AsMemory())) > 0)
            {
                for (var i = 0; i < read; i++)
                {
                    var character = buffer[i];
                    if (character == '\n' && afterCarriageReturn)
                    {
                        // The second half of a CRLF; the line already ended at the CR.
                        afterCarriageReturn = false;
                        continue;
                    }

                    afterCarriageReturn = character == '\r';
                    if (character is '\n' or '\r')
                    {
                        // A lone CR is how progress output rewrites its line; each state becomes a line.
                        Emit();
                        continue;
                    }

                    line.Append(character);
                    if (line.Length >= MaxLineChars)
                    {
                        Emit();
                    }
                }
            }
        }
        catch (Exception error) when (error is IOException or ObjectDisposedException)
        {
            // The pipe went away with the process.
        }

        if (line.Length > 0)
        {
            Emit();
        }
    }

    private static async Task WriteInputAsync(StreamWriter input, string? text)
    {
        try
        {
            if (text is not null)
            {
                await input.WriteAsync(text);
                await input.FlushAsync();
            }
        }
        catch (Exception error) when (error is IOException or ObjectDisposedException)
        {
            // The program exited without reading it all.
        }
        finally
        {
            try
            {
                input.Close();
            }
            catch (Exception error) when (error is IOException or ObjectDisposedException)
            {
                // Closed already.
            }
        }
    }

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._+-]*$", RegexOptions.CultureInvariant)]
    private static partial Regex PlainName();

    [GeneratedRegex("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.CultureInvariant)]
    private static partial Regex EnvironmentName();

    /// <summary>The output a result keeps: whole lines, until the cap.</summary>
    private sealed class Capture(int maxBytes)
    {
        private readonly StringBuilder _text = new();
        private readonly Lock _gate = new();
        private int _bytes;

        public bool Truncated { get; private set; }

        public string Text
        {
            get
            {
                lock (_gate)
                {
                    return _text.ToString();
                }
            }
        }

        public void Add(string line)
        {
            lock (_gate)
            {
                var size = Encoding.UTF8.GetByteCount(line) + 1;
                if (Truncated || _bytes + size > maxBytes)
                {
                    Truncated = true;
                    return;
                }

                _bytes += size;
                _text.Append(line).Append('\n');
            }
        }
    }
}

/// <summary>Signals for a whole process group, which .NET has no API for.</summary>
internal static partial class UnixSignals
{
    private const int SigKill = 9;

    /// <summary>SIGKILL to every process in the group. False when the group is already gone.</summary>
    public static bool KillGroup(int processGroup) =>
        processGroup > 1 && SendSignal(-processGroup, SigKill) == 0;

    [LibraryImport("libc", EntryPoint = "kill", SetLastError = true)]
    private static partial int SendSignal(int pid, int signal);
}
