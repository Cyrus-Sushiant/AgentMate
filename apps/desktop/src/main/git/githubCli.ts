import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GH_TIMEOUT_MS = 20000;

export function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  const match = url.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function isGhCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['--version'], { timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export function ghErrorMessage(error: unknown): string {
  const err = error as { stderr?: string; message?: string };
  return (err.stderr || err.message || 'The GitHub CLI command failed.').trim();
}

/** One `gh api` call, parsed. Throws with gh's own stderr, which is usually the clearest message. */
export async function ghApi<T>(path: string, args: string[] = []): Promise<T> {
  const { stdout } = await execFileAsync(
    'gh',
    ['api', '-H', 'Accept: application/vnd.github+json', path, ...args],
    {
      timeout: GH_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
  return JSON.parse(stdout) as T;
}

/**
 * Same as `ghApi`, but GitHub's mark-as-read endpoints return 205 with an empty
 * body, which is success rather than invalid JSON.
 */
export async function ghApiAllowEmpty(path: string, args: string[] = []): Promise<void> {
  const { stdout } = await execFileAsync(
    'gh',
    ['api', '-H', 'Accept: application/vnd.github+json', path, ...args],
    {
      timeout: GH_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
  const trimmed = stdout.trim();
  if (!trimmed) return;
  JSON.parse(trimmed);
}

interface GithubGraphqlPayload<T> {
  data?: T;
  errors?: { message: string }[];
}

/** One `gh api graphql` call. Throws when GitHub returns errors in the payload. */
export async function ghGraphql<T>(query: string): Promise<T> {
  const payload = await ghApi<GithubGraphqlPayload<T>>('graphql', ['-f', `query=${query}`]);
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }
  if (!payload.data) throw new Error('GitHub GraphQL returned no data.');
  return payload.data;
}
