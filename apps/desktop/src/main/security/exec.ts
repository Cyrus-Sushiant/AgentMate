import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { withToolPath } from '../toolPaths';

/**
 * Process plumbing for security scans.
 *
 * Scans differ from the app's other child processes in three ways that make the existing helpers
 * a poor fit: they run for tens of minutes rather than seconds, the user needs to watch them, and
 * they have to be cancellable partway through. So this streams line by line rather than buffering
 * to completion, and it keeps only a capped tail of output rather than the whole log, since a
 * CodeQL extractor can emit hundreds of megabytes.
 */

const MAX_LOG_CHARS = 20_000;

/** Color and cursor codes are noise once the output is shown in a log panel. */
export function stripAnsi(text: string): string {
  return (
    text
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ESC is what an ANSI escape sequence starts with, matching it is the point
      .replace(/\u001B\[[?]?\d*(?:;\d+)*[a-zA-Z]/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: OSC sequences are delimited by BEL/ESC
      .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, '')
      .replace(/\[(?:\d{1,3};)*\d{1,3}m/g, '')
      .replace(/\r/g, '')
  );
}

export function trimLog(log: string): string {
  if (log.length <= MAX_LOG_CHARS) return log;
  return `... (earlier output trimmed)\n${log.slice(-MAX_LOG_CHARS)}`;
}

/**
 * Wraps one argument for `cmd.exe /s /c`. Same rules as the copy in packageManagers/execUtils:
 * inside double quotes cmd stops treating `&`, `|`, `<`, `>` and `^` as syntax, and a run of
 * trailing backslashes is doubled so a path ending in one cannot escape the closing quote. That
 * last part is what keeps `--source-root=E:\proj\` working.
 *
 * A literal double quote is refused rather than escaped, because cmd has no escape for it that
 * survives this form and no Windows path can contain one anyway.
 */
export function quoteForCmd(value: string): string {
  if (value.includes('"')) {
    throw new Error(`Refusing to run a scan command with a quote in an argument: ${value}`);
  }
  return `"${value.replace(/(\\*)$/, '$1$1')}"`;
}

/**
 * Windows spawns scanners under cmd.exe, and the scanners themselves spawn more processes:
 * Semgrep starts Python workers, CodeQL starts a JVM plus per-language extractors, `docker run`
 * starts a client. Killing only the direct child would leave every one of those running, so the
 * whole tree goes down together.
 */
export function killProcessTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {
      // Best effort: the process may already have exited on its own.
    });
    return;
  }
  child.kill('SIGTERM');
}

export interface ScanCancelToken {
  cancelled: boolean;
  /** Set by the runner so a cancel mid-spawn can reach the live child. */
  child: ChildProcess | null;
}

export interface SpawnScanOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  token: ScanCancelToken;
  /** Called for each output line, already ANSI-stripped. */
  onLine?: (line: string) => void;
}

export interface SpawnScanResult {
  code: number | null;
  log: string;
  timedOut: boolean;
  cancelled: boolean;
  /** Set when the binary itself could not be found, which is a different problem from a bad run. */
  notFound: boolean;
}

const NOT_FOUND = /is not recognized as an internal or external command|command not found|ENOENT/i;

/**
 * Runs one scanner to completion, streaming its output.
 *
 * The timeout is enforced with our own timer plus a tree kill rather than with the `timeout`
 * option, because on Windows that option signals cmd.exe and orphans the real process, which is
 * exactly the failure mode this needs to avoid for a 45-minute CodeQL run.
 */
export async function spawnScan(options: SpawnScanOptions): Promise<SpawnScanResult> {
  // Scanners installed by pip live in a Scripts folder that is off PATH on Windows, and Semgrep
  // in particular re-execs `pysemgrep` by name, so the folder has to be on the child's PATH and
  // not merely resolved into an absolute command.
  const env = await withToolPath(options.env);
  // A cancel that lands while PATH is being resolved has no child to kill yet, so honour it here
  // rather than starting a scanner nobody is waiting for.
  if (options.token.cancelled) {
    return { code: null, log: '', timedOut: false, cancelled: true, notFound: false };
  }
  return new Promise((resolve) => {
    const onWindows = process.platform === 'win32';

    // Route through cmd.exe on Windows so .cmd/.bat shims (trivy via winget, some codeql
    // installers) spawn at all. Same construction as packageManagers/execUtils runCli, and every
    // part of it matters: the command name stays unquoted so a .cmd shim can resolve its own
    // install directory from %~dp0, each argument is quoted so a project path with a space or an
    // ampersand in it survives, and the whole line takes one outer pair of quotes because
    // `cmd /s` strips the first and last quote of whatever follows /c.
    const commandLine = `"${[options.command, ...options.args.map(quoteForCmd)].join(' ')}"`;
    const child = onWindows
      ? spawn('cmd.exe', ['/d', '/s', '/c', commandLine], {
          cwd: options.cwd,
          env,
          windowsHide: true,
          // Node must not re-quote what is already a finished command line.
          windowsVerbatimArguments: true,
        })
      : spawn(options.command, options.args, {
          cwd: options.cwd,
          env,
        });

    options.token.child = child;

    let log = '';
    let pending = '';
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, options.timeoutMs);

    const consume = (chunk: Buffer | string): void => {
      const text = stripAnsi(chunk.toString());
      log = trimLog(log + text);
      if (!options.onLine) return;
      pending += text;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) options.onLine(trimmed);
      }
    };

    child.stdout?.on('data', consume);
    child.stderr?.on('data', consume);

    const finish = (code: number | null, notFound: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.token.child = null;
      if (pending.trim() && options.onLine) options.onLine(pending.trim());
      resolve({
        code,
        log,
        timedOut,
        cancelled: options.token.cancelled,
        notFound: notFound || NOT_FOUND.test(log),
      });
    };

    child.on('error', (error) => {
      log = trimLog(log + String(error));
      finish(null, NOT_FOUND.test(String(error)));
    });
    child.on('close', (code) => finish(code, false));
  });
}

/** A short buffered probe, for `--version` and `docker info` style checks. */
export async function probe(
  command: string,
  args: string[],
  timeoutMs = 8000,
): Promise<{ ok: boolean; stdout: string }> {
  // Same PATH as spawnScan gives the real run, so preflight cannot pass a scanner the run then
  // fails to find, or fail one the run would have found.
  const env = await withToolPath();
  return new Promise((resolve) => {
    const onWindows = process.platform === 'win32';
    execFile(
      onWindows ? 'cmd.exe' : command,
      onWindows ? ['/d', '/s', '/c', command, ...args] : args,
      { timeout: timeoutMs, windowsHide: true, env },
      (error, stdout) => {
        resolve({ ok: !error, stdout: (stdout ?? '').toString().trim() });
      },
    );
  });
}
