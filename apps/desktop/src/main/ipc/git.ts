import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type {
  CreatePullRequestInput,
  CreatePullRequestResult,
  GitFileChange,
  GitOpResult,
  GitStatus,
} from '../../shared/apiTypes';
import { store } from '../store';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 30000;
const MAX_DIFF_CHARS = 8000;

async function getProjectPath(projectId: string): Promise<string> {
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.folderPath;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    return (await git(cwd, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

function parseStatusPorcelain(porcelain: string): GitFileChange[] {
  return porcelain
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => ({
      x: line[0] ?? ' ',
      y: line[1] ?? ' ',
      path: line.slice(3).trim(),
    }));
}

async function readStatus(cwd: string): Promise<GitStatus> {
  if (!(await isGitRepo(cwd))) {
    return { isRepo: false, branch: null, ahead: 0, behind: 0, hasRemote: false, files: [] };
  }

  const branch = (await git(cwd, ['branch', '--show-current']).catch(() => '')).trim() || null;
  const hasRemote = (await git(cwd, ['remote']).catch(() => '')).trim().length > 0;

  let ahead = 0;
  let behind = 0;
  const counts = await git(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).catch(
    () => '',
  );
  if (counts.trim()) {
    const [a, b] = counts.trim().split(/\s+/);
    ahead = parseInt(a, 10) || 0;
    behind = parseInt(b, 10) || 0;
  }

  const files = parseStatusPorcelain(await git(cwd, ['status', '--porcelain']));

  return { isRepo: true, branch, ahead, behind, hasRemote, files };
}

/** Plain-text summary of the working tree, meant to be dropped into an AI prompt. */
async function readChangeSummary(cwd: string): Promise<string> {
  const status = await git(cwd, ['status', '--porcelain']).catch(() => '');

  // `diff HEAD` covers both staged and unstaged changes against the last commit;
  // it fails on a brand-new repo with no commits yet, so fall back to the two halves.
  let diff = await git(cwd, ['diff', 'HEAD']).catch(() => '');
  if (!diff.trim()) {
    const staged = await git(cwd, ['diff', '--cached']).catch(() => '');
    const unstaged = await git(cwd, ['diff']).catch(() => '');
    diff = [staged, unstaged].filter(Boolean).join('\n');
  }
  const truncatedDiff = diff.length > MAX_DIFF_CHARS ? `${diff.slice(0, MAX_DIFF_CHARS)}\n… (truncated)` : diff;

  return [
    `Changed files:\n${status.trim() || '(none)'}`,
    `Diff:\n${truncatedDiff.trim() || '(no diff available)'}`,
  ].join('\n\n');
}

async function runGitOp(fn: () => Promise<string>): Promise<GitOpResult> {
  try {
    const output = await fn();
    return { ok: true, message: output.trim() || 'Done.' };
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return { ok: false, message: (err.stderr || err.message || 'Git command failed.').trim() };
  }
}

async function pushCurrentBranch(cwd: string, branch: string): Promise<string> {
  try {
    return await git(cwd, ['push']);
  } catch (error) {
    const err = error as { stderr?: string };
    if (/has no upstream branch|set the upstream/i.test(err.stderr ?? '')) {
      return git(cwd, ['push', '-u', 'origin', branch]);
    }
    throw error;
  }
}

function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  const match = url.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function isGhCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['--version'], { timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export function registerGitHandlers(): void {
  ipcMain.handle(IPC.git.status, async (_event, projectId: string): Promise<GitStatus> => {
    return readStatus(await getProjectPath(projectId));
  });

  ipcMain.handle(IPC.git.changeSummary, async (_event, projectId: string): Promise<string> => {
    return readChangeSummary(await getProjectPath(projectId));
  });

  ipcMain.handle(IPC.git.fetch, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    return runGitOp(() => git(cwd, ['fetch', '--all', '--prune']));
  });

  ipcMain.handle(IPC.git.pull, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    return runGitOp(() => git(cwd, ['pull']));
  });

  ipcMain.handle(IPC.git.push, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    return runGitOp(async () => {
      const status = await readStatus(cwd);
      if (!status.branch) throw new Error('No current branch to push.');
      return pushCurrentBranch(cwd, status.branch);
    });
  });

  ipcMain.handle(IPC.git.sync, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    return runGitOp(async () => {
      const fetchOut = await git(cwd, ['fetch', '--all', '--prune']);
      const pullOut = await git(cwd, ['pull']);
      const status = await readStatus(cwd);
      const pushOut = status.branch ? await pushCurrentBranch(cwd, status.branch) : '';
      return [fetchOut, pullOut, pushOut].filter(Boolean).join('\n');
    });
  });

  ipcMain.handle(
    IPC.git.createBranch,
    async (_event, projectId: string, branchName: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      const sanitized = branchName.trim().replace(/\s+/g, '-');
      if (!sanitized) return { ok: false, message: 'Branch name cannot be empty.' };
      return runGitOp(() => git(cwd, ['checkout', '-b', sanitized]));
    },
  );

  ipcMain.handle(
    IPC.git.commit,
    async (_event, projectId: string, message: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      if (!message.trim()) return { ok: false, message: 'Commit message cannot be empty.' };
      return runGitOp(async () => {
        await git(cwd, ['add', '-A']);
        return git(cwd, ['commit', '-m', message]);
      });
    },
  );

  ipcMain.handle(
    IPC.git.createPullRequest,
    async (_event, input: CreatePullRequestInput): Promise<CreatePullRequestResult> => {
      const cwd = await getProjectPath(input.projectId);
      const status = await readStatus(cwd);
      if (!status.branch) return { ok: false, error: 'No current branch found.' };

      try {
        await pushCurrentBranch(cwd, status.branch);
      } catch (error) {
        const err = error as { stderr?: string; message?: string };
        return {
          ok: false,
          error: `Failed to push branch before creating the PR: ${(err.stderr || err.message || '').trim()}`,
        };
      }

      if (await isGhCliAvailable()) {
        try {
          const args = ['pr', 'create', '--title', input.title, '--body', input.body];
          if (input.base) args.push('--base', input.base);
          const { stdout } = await execFileAsync('gh', args, {
            cwd,
            timeout: GIT_TIMEOUT_MS,
            windowsHide: true,
          });
          const url = stdout.trim().split('\n').pop() ?? '';
          return { ok: true, url };
        } catch (error) {
          const err = error as { stderr?: string; message?: string };
          return { ok: false, error: (err.stderr || err.message || 'gh pr create failed.').trim() };
        }
      }

      // No GitHub CLI — fall back to opening a pre-filled compare page in the browser.
      const remoteUrl = (await git(cwd, ['remote', 'get-url', 'origin']).catch(() => '')).trim();
      const parsed = parseGithubRemote(remoteUrl);
      if (!parsed) {
        return {
          ok: false,
          error: 'GitHub CLI (gh) is not installed and the origin remote is not a GitHub URL.',
        };
      }
      const base = input.base || 'main';
      const params = new URLSearchParams({ expand: '1', title: input.title, body: input.body });
      const url = `https://github.com/${parsed.owner}/${parsed.repo}/compare/${base}...${status.branch}?${params.toString()}`;
      return { ok: true, url, usedFallback: true };
    },
  );
}
