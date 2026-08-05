import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';
import type { Project } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type {
  CreatePullRequestInput,
  CreatePullRequestResult,
  CreateTagInput,
  GitFileChange,
  GitOpResult,
  GitStatus,
  GitTagInfo,
  SuggestGitTextResult,
  SuggestTagResult,
} from '../../shared/apiTypes';
import { cancelHeadlessPrompt, runHeadlessCliPrompt } from '../cli/headlessPrompt';
import { store } from '../store';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 30000;
const MAX_DIFF_CHARS = 8000;

async function getProject(projectId: string): Promise<Project> {
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project;
}

async function getProjectPath(projectId: string): Promise<string> {
  return (await getProject(projectId)).folderPath;
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

/** Best-effort guess at the repo's primary branch, e.g. "main" vs "master". */
async function detectDefaultBranch(cwd: string): Promise<string | null> {
  const symbolicRef = (
    await git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).catch(() => '')
  ).trim();
  if (symbolicRef) return symbolicRef.replace(/^origin\//, '');

  for (const candidate of ['main', 'master']) {
    const exists = await git(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${candidate}`])
      .then(() => true)
      .catch(() => false);
    if (exists) return candidate;
  }
  return null;
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
    return {
      isRepo: false,
      branch: null,
      defaultBranch: null,
      ahead: 0,
      behind: 0,
      hasRemote: false,
      files: [],
    };
  }

  const branch = (await git(cwd, ['branch', '--show-current']).catch(() => '')).trim() || null;
  const hasRemote = (await git(cwd, ['remote']).catch(() => '')).trim().length > 0;
  const defaultBranch = await detectDefaultBranch(cwd);

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

  return { isRepo: true, branch, defaultBranch, ahead, behind, hasRemote, files };
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

const RECENT_TAG_LIMIT = 8;
const MAX_RELEASE_LOG_LINES = 120;
const MAX_FALLBACK_BULLETS = 20;
/** Refuses shell-ish and git-illegal tag names up front; git itself is the final word. */
const TAG_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/+-]*$/;

async function readTagInfo(cwd: string): Promise<GitTagInfo> {
  if (!(await isGitRepo(cwd))) {
    return { latestTag: null, recentTags: [], commitsSinceLatestTag: 0, hasRemote: false };
  }

  const hasRemote = (await git(cwd, ['remote']).catch(() => '')).trim().length > 0;
  const latestTag = (await git(cwd, ['describe', '--tags', '--abbrev=0']).catch(() => '')).trim() || null;
  const recentTags = (await git(cwd, ['tag', '--sort=-creatordate']).catch(() => ''))
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, RECENT_TAG_LIMIT);

  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
  const count = await git(cwd, ['rev-list', '--count', range]).catch(() => '');
  const commitsSinceLatestTag = parseInt(count.trim(), 10) || 0;

  return { latestTag, recentTags, commitsSinceLatestTag, hasRemote };
}

async function readCommitSubjects(cwd: string, latestTag: string | null): Promise<string[]> {
  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
  const log = await git(cwd, ['log', range, '--no-merges', '--pretty=format:%s']).catch(() => '');
  return log
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Commit log (and diff size) since the last tag, meant to be dropped into an AI prompt. */
function buildReleaseSummary(latestTag: string | null, subjects: string[], diffStat: string): string {
  const shown = subjects.slice(0, MAX_RELEASE_LOG_LINES).map((subject) => `- ${subject}`);
  if (subjects.length > shown.length) {
    shown.push(`- … and ${subjects.length - shown.length} more commits`);
  }

  return [
    `Latest existing tag: ${latestTag ?? '(none, this would be the first tag)'}`,
    `Commits since then:\n${shown.join('\n') || '(none)'}`,
    diffStat ? `Diff size: ${diffStat}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Release notes built straight from the commit log. Used whenever the CLI answers with a
 * version but no usable notes, so the tag message field is never left empty.
 */
function fallbackTagMessage(tag: string, subjects: string[]): string {
  const shown = subjects.slice(0, MAX_FALLBACK_BULLETS).map((subject) => `- ${subject}`);
  if (subjects.length > shown.length) {
    shown.push(`- … and ${subjects.length - shown.length} more commits`);
  }
  return [`Release ${tag}`, '', ...shown].join('\n').trim();
}

const MAX_TAG_MESSAGE_CHARS = 2000;

/** Drops markdown fences and stray backticks that agent CLIs like to wrap answers in. */
function stripMarkdownFences(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim();
}

interface SuggestedTag {
  tag: string;
  reason?: string;
  message?: string;
}

/**
 * Pulls the tag, the rationale and the release notes out of the CLI's answer,
 * tolerating chatter around the requested TAG/WHY/NOTES format.
 */
function parseSuggestedTag(text: string, latestTag: string | null): SuggestedTag | null {
  const tagLine = text.match(/^\s*TAG:\s*(.+)$/im)?.[1];
  const semver = /v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/;
  const match = (tagLine ?? text).match(semver);
  if (!match) return null;

  let tag = match[0];
  // Keep the repo's own prefix style rather than whatever the model felt like emitting.
  const wantsPrefix = latestTag ? latestTag.startsWith('v') : true;
  if (wantsPrefix && !tag.startsWith('v')) tag = `v${tag}`;
  if (!wantsPrefix && tag.startsWith('v')) tag = tag.slice(1);

  const reason = text
    .match(/^\s*WHY:\s*(.+)$/im)?.[1]
    ?.trim()
    .slice(0, 240);

  // NOTES is the last field, so everything after its header belongs to it. When the CLI
  // skipped the header, keep any bullet list it wrote instead, but not loose prose, which
  // is usually preamble rather than release notes.
  const headed = text.match(/^[ \t]*NOTES:[ \t]*\r?\n?([\s\S]*)$/im)?.[1];
  const bulletsOnly = stripMarkdownFences(text)
    .split('\n')
    .filter((line) => /^\s*[-*•]\s+\S/.test(line))
    .join('\n');
  const notes = stripMarkdownFences(headed ?? bulletsOnly).slice(0, MAX_TAG_MESSAGE_CHARS);

  return { tag, reason: reason || undefined, message: notes || undefined };
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

  ipcMain.handle(IPC.git.tags, async (_event, projectId: string): Promise<GitTagInfo> => {
    return readTagInfo(await getProjectPath(projectId));
  });

  ipcMain.handle(IPC.git.createTag, async (_event, input: CreateTagInput): Promise<GitOpResult> => {
    const cwd = await getProjectPath(input.projectId);
    const tag = input.tag.trim();
    if (!tag) return { ok: false, message: 'Tag name cannot be empty.' };
    if (!TAG_NAME_PATTERN.test(tag) || tag.includes('..')) {
      return {
        ok: false,
        message: 'Invalid tag name. Use letters, digits, dots, dashes, underscores or slashes (e.g. v1.0.1).',
      };
    }

    const exists = await git(cwd, ['rev-parse', '-q', '--verify', `refs/tags/${tag}`])
      .then(() => true)
      .catch(() => false);
    if (exists) return { ok: false, message: `Tag ${tag} already exists in this repository.` };

    return runGitOp(async () => {
      await git(cwd, ['tag', '-a', tag, '-m', input.message?.trim() || tag]);
      if (!input.push) return `Created tag ${tag} locally.`;
      try {
        await git(cwd, ['push', 'origin', tag]);
      } catch (error) {
        // Leave the repo as we found it so the user can retry the same tag after fixing the remote.
        await git(cwd, ['tag', '-d', tag]).catch(() => undefined);
        throw error;
      }
      return `Created tag ${tag} and pushed it to origin.`;
    });
  });

  ipcMain.handle(
    IPC.git.suggestTag,
    async (_event, projectId: string, requestId?: string): Promise<SuggestTagResult> => {
    const project = await getProject(projectId);
    const cwd = project.folderPath;
    const { latestTag, commitsSinceLatestTag } = await readTagInfo(cwd);
    if (latestTag && commitsSinceLatestTag === 0) {
      return { ok: false, error: `No new commits since ${latestTag}, so there is nothing to tag yet.` };
    }

    const subjects = await readCommitSubjects(cwd, latestTag);
    const diffStat = latestTag
      ? (await git(cwd, ['diff', '--shortstat', `${latestTag}..HEAD`]).catch(() => '')).trim()
      : '';
    const summary = buildReleaseSummary(latestTag, subjects, diffStat);
    const prompt =
      'You are picking the next git tag for a release, following semantic versioning: bump the major ' +
      'version for breaking changes, the minor version for new features, the patch version for fixes ' +
      'and chores only. Do not read or edit any files; judge only from the information below.\n\n' +
      'Answer in exactly this format, with no markdown and nothing else:\n' +
      'TAG: <the new tag>\n' +
      'WHY: <one short sentence explaining the bump>\n' +
      'NOTES:\n' +
      '<release notes for the tag annotation: a one-line summary, then a few "- " bullets ' +
      'grouping the notable changes. Keep it under 15 lines.>\n\n' +
      summary;

    const result = await runHeadlessCliPrompt(prompt, cwd, {
      requestId,
      preferredCliId: project.cliId,
    });
    if (!result.ok) {
      return {
        ok: false,
        cliName: result.cliName,
        error: result.error,
        cancelled: result.cancelled,
      };
    }

    const parsed = parseSuggestedTag(result.text, latestTag);
    if (!parsed) {
      return {
        ok: false,
        cliName: result.cliName,
        error: `${result.cliName} did not return a version number.`,
      };
    }
    return {
      ok: true,
      tag: parsed.tag,
      reason: parsed.reason,
      // A CLI that ignored the NOTES section still gets a usable annotation, straight from the log.
      message: parsed.message || fallbackTagMessage(parsed.tag, subjects),
      cliName: result.cliName,
    };
    },
  );

  ipcMain.handle(IPC.git.cancelSuggestTag, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });

  ipcMain.handle(
    IPC.git.suggestBranchName,
    async (_event, projectId: string, requestId?: string): Promise<SuggestGitTextResult> => {
      const project = await getProject(projectId);
      const summary = await readChangeSummary(project.folderPath);
      const prompt =
        'Generate a single short git branch name (kebab-case, e.g. "feat/add-login" or ' +
        '"fix/null-check", max 60 characters, no spaces, no quotes, no markdown) describing these ' +
        'uncommitted changes. Do not read or edit any files; judge only from the information below. ' +
        `Reply with ONLY the branch name and nothing else.\n\n${summary}`;

      const result = await runHeadlessCliPrompt(prompt, project.folderPath, {
        requestId,
        preferredCliId: project.cliId,
      });
      return { ok: result.ok, text: result.text, cliName: result.cliName, error: result.error, cancelled: result.cancelled };
    },
  );

  ipcMain.handle(IPC.git.cancelSuggestBranchName, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });

  ipcMain.handle(
    IPC.git.suggestCommitMessage,
    async (_event, projectId: string, requestId?: string): Promise<SuggestGitTextResult> => {
      const project = await getProject(projectId);
      const summary = await readChangeSummary(project.folderPath);
      const prompt =
        'Write a concise, conventional-commit style git commit message (a short summary line, ' +
        'optionally followed by a brief body) describing these changes. Do not read or edit any ' +
        'files; judge only from the information below. Reply with ONLY the commit message, no code ' +
        `fences, no extra commentary.\n\n${summary}`;

      const result = await runHeadlessCliPrompt(prompt, project.folderPath, {
        requestId,
        preferredCliId: project.cliId,
      });
      return { ok: result.ok, text: result.text, cliName: result.cliName, error: result.error, cancelled: result.cancelled };
    },
  );

  ipcMain.handle(IPC.git.cancelSuggestCommitMessage, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });

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

      // No GitHub CLI, fall back to opening a pre-filled compare page in the browser.
      const remoteUrl = (await git(cwd, ['remote', 'get-url', 'origin']).catch(() => '')).trim();
      const parsed = parseGithubRemote(remoteUrl);
      if (!parsed) {
        return {
          ok: false,
          error: 'GitHub CLI (gh) is not installed and the origin remote is not a GitHub URL.',
        };
      }
      const base = input.base || (await detectDefaultBranch(cwd)) || 'main';
      const params = new URLSearchParams({ expand: '1', title: input.title, body: input.body });
      const url = `https://github.com/${parsed.owner}/${parsed.repo}/compare/${base}...${status.branch}?${params.toString()}`;
      return { ok: true, url, usedFallback: true };
    },
  );
}
