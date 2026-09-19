import { execFile } from 'node:child_process';
import {
  type CancelToken,
  type SpawnStreamingOptions,
  type SpawnStreamingResult,
  spawnStreaming,
} from '../process/spawnStreaming';
import { withToolPath } from '../toolPaths';

/**
 * Process plumbing for security scans. The streaming, quoting and tree killing live in
 * process/spawnStreaming, shared with the Tests panel; scans only differ in wanting trimmed,
 * non-empty lines for their progress log.
 */

export { killProcessTree, quoteForCmd, stripAnsi, trimLog } from '../process/spawnStreaming';

export type ScanCancelToken = CancelToken;
export type SpawnScanOptions = SpawnStreamingOptions;
export type SpawnScanResult = SpawnStreamingResult;

/** Runs one scanner to completion, streaming its output a trimmed line at a time. */
export function spawnScan(options: SpawnScanOptions): Promise<SpawnScanResult> {
  const { onLine } = options;
  return spawnStreaming({
    ...options,
    onLine: onLine
      ? (line) => {
          const trimmed = line.trim();
          if (trimmed) onLine(trimmed);
        }
      : undefined,
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
    // A blank command reaches execFile as an empty file name, which throws rather than failing
    // the way a missing tool does. Preflight runs these without catching, so it must not throw.
    if (!command.trim()) {
      resolve({ ok: false, stdout: '' });
      return;
    }
    try {
      execFile(
        onWindows ? 'cmd.exe' : command,
        onWindows ? ['/d', '/s', '/c', command, ...args] : args,
        { timeout: timeoutMs, windowsHide: true, env },
        (error, stdout) => {
          resolve({ ok: !error, stdout: (stdout ?? '').toString().trim() });
        },
      );
    } catch {
      resolve({ ok: false, stdout: '' });
    }
  });
}
