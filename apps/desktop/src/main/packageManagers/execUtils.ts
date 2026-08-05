import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CliResult {
  stdout: string;
  stderr: string;
  /** 0 on a clean exit; non-zero exits are returned, not thrown, since package
   *  managers like `npm outdated` use exit code 1 to mean "found results". */
  code: number;
}

interface ExecErrorLike extends Error {
  stdout?: string;
  stderr?: string;
  code?: string | number;
}

const NOT_FOUND_PATTERN =
  /is not recognized as an internal or external command|command not found|no such file or directory/i;

/** Thrown when the underlying CLI (npm/yarn/pnpm/dotnet) isn't on PATH at all. */
export class CliNotFoundError extends Error {}

/**
 * Runs a CLI command, routing through cmd.exe on Windows so npm/yarn/pnpm/dotnet
 * .cmd shims spawn correctly (Node refuses to spawn .cmd files directly as of
 * Node >=18.20/20.11/21.6). Command/args are always static, code-authored
 * strings assembled from parsed manifest data, never raw renderer input.
 *
 * Non-zero exits are returned rather than thrown. Outdated-package commands
 * commonly exit 1 when they find results, which is expected, not a failure.
 * A genuinely missing CLI (ENOENT, or cmd.exe's "not recognized") throws
 * CliNotFoundError so callers can render a cli-missing state.
 */
export async function runCli(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 30000,
): Promise<CliResult> {
  const options = {
    cwd,
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    // Cline's CLI self-updates on every invocation, including a bare version check,
    // by spawning a detached background installer; on Windows that can flash open a
    // visible console. This is a no-op env var for every other CLI we shell out to.
    env: { ...process.env, CLINE_NO_AUTO_UPDATE: '1' },
  };
  try {
    const { stdout, stderr } =
      process.platform === 'win32'
        ? await execFileAsync('cmd.exe', ['/d', '/s', '/c', command, ...args], options)
        : await execFileAsync(command, args, options);
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as ExecErrorLike;
    if (e.code === 'ENOENT' || e.code === 9009 || NOT_FOUND_PATTERN.test(e.stderr ?? '')) {
      throw new CliNotFoundError(`${command} is not available on PATH`);
    }
    if (typeof e.stdout === 'string' || typeof e.stderr === 'string') {
      return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: typeof e.code === 'number' ? e.code : 1 };
    }
    throw err;
  }
}

export function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Runs async tasks with a concurrency cap, preserving input order in the result. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
