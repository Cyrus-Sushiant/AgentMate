import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Project } from '@agentmat/core';
import { browsableRepoUrl } from '@agentmat/core';
import { ipcMain } from 'electron';
import type {
  ApplyVersionInput,
  ApplyVersionResult,
  ConnectRemoteInput,
  CreateGithubRepoInput,
  CreateGithubRepoResult,
  CreatePullRequestInput,
  CreatePullRequestResult,
  CreateTagInput,
  DeleteBranchInput,
  GitBranchHistory,
  GitBranchInfo,
  GitCommitInfo,
  GitDayCount,
  GitFileChange,
  GithubAccount,
  GithubActivity,
  GithubNotificationItem,
  GithubNotifications,
  GithubOwner,
  GithubRepoInfo,
  GithubRepoLookup,
  GitInitInput,
  GitOpResult,
  GitStatus,
  GitTagInfo,
  RenameBranchInput,
  SuggestGitTextResult,
  SuggestTagResult,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { cancelHeadlessPrompt, runHeadlessCliPrompt } from '../cli/headlessPrompt';
import {
  ghApi,
  ghApiAllowEmpty,
  ghErrorMessage,
  ghGraphql,
  isGhCliAvailable,
  parseGithubRemote,
} from '../git/githubCli';
import { schedulePipelineCheck } from '../pipelines/watcher';
import { store } from '../store';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 30000;
/** Pushing a whole project for the first time can take a while on a slow line. */
const PUSH_TIMEOUT_MS = 180000;
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

async function git(cwd: string, args: string[], timeoutMs = GIT_TIMEOUT_MS): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    // Nobody can answer a credential prompt in a hidden process, so a command that would
    // ask for one should fail with a readable error instead of sitting there until the timeout.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
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

function sanitizeGitBranchName(name: string): string {
  return name.trim().replace(/\s+/g, '-');
}

async function primaryRemote(cwd: string): Promise<string | null> {
  const remotes = (await git(cwd, ['remote']).catch(() => ''))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (remotes.includes('origin')) return 'origin';
  return remotes[0] ?? null;
}

async function listRefNames(cwd: string, pattern: string): Promise<string[]> {
  const output = await git(cwd, ['for-each-ref', '--format=%(refname:short)', pattern]).catch(
    () => '',
  );
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function listBranches(cwd: string): Promise<GitBranchInfo[]> {
  const localNames = new Set(await listRefNames(cwd, 'refs/heads'));
  const remote = await primaryRemote(cwd);
  const remoteNames = new Set<string>();
  if (remote) {
    const prefix = `${remote}/`;
    for (const ref of await listRefNames(cwd, `refs/remotes/${remote}`)) {
      const name = ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
      if (name && name !== 'HEAD') remoteNames.add(name);
    }
  }

  const current = (await git(cwd, ['branch', '--show-current']).catch(() => '')).trim();
  if (current) localNames.add(current);

  const names = new Set([...localNames, ...remoteNames]);
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      local: localNames.has(name),
      remote: remoteNames.has(name),
    }));
}

/** Best-effort guess at the repo's primary branch, e.g. "main" vs "master". */
async function detectDefaultBranch(cwd: string, remote?: string | null): Promise<string | null> {
  const remoteName = remote === undefined ? await primaryRemote(cwd) : remote;
  if (remoteName) {
    const symbolicRef = (
      await git(cwd, ['symbolic-ref', '--short', `refs/remotes/${remoteName}/HEAD`]).catch(() => '')
    ).trim();
    if (symbolicRef) {
      const prefix = `${remoteName}/`;
      return symbolicRef.startsWith(prefix) ? symbolicRef.slice(prefix.length) : symbolicRef;
    }
  }

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
      branches: [],
    };
  }

  const branch = (await git(cwd, ['branch', '--show-current']).catch(() => '')).trim() || null;
  const remote = await primaryRemote(cwd);
  const hasRemote = remote !== null;
  const [defaultBranch, branches] = await Promise.all([
    detectDefaultBranch(cwd, remote),
    listBranches(cwd),
  ]);

  let ahead = 0;
  let behind = 0;
  const counts = await git(cwd, [
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{upstream}',
  ]).catch(() => '');
  if (counts.trim()) {
    const [a, b] = counts.trim().split(/\s+/);
    ahead = parseInt(a, 10) || 0;
    behind = parseInt(b, 10) || 0;
  }

  const files = parseStatusPorcelain(await git(cwd, ['status', '--porcelain']));

  return { isRepo: true, branch, defaultBranch, ahead, behind, hasRemote, files, branches };
}

async function checkoutBranch(cwd: string, branchName: string): Promise<string> {
  const sanitized = sanitizeGitBranchName(branchName);
  if (!sanitized) throw new Error('Branch name cannot be empty.');

  const current = (await git(cwd, ['branch', '--show-current']).catch(() => '')).trim();
  if (current === sanitized) return `Already on '${sanitized}'.`;

  const branches = await listBranches(cwd);
  const info = branches.find((branch) => branch.name === sanitized);
  if (!info) {
    throw new Error(`Branch '${sanitized}' was not found locally or on the remote.`);
  }

  if (info.local) {
    return git(cwd, ['checkout', sanitized]);
  }

  const remote = await primaryRemote(cwd);
  if (!remote || !info.remote) {
    throw new Error(`Branch '${sanitized}' is not available locally or on a remote.`);
  }

  await git(cwd, ['fetch', remote, sanitized]).catch(() => '');
  return git(cwd, ['checkout', '--track', `${remote}/${sanitized}`]);
}

async function setDefaultBranch(cwd: string, branchName: string): Promise<string> {
  const sanitized = sanitizeGitBranchName(branchName);
  if (!sanitized) throw new Error('Branch name cannot be empty.');

  const remote = await primaryRemote(cwd);
  if (!remote) {
    throw new Error('Connect a remote before changing the default branch.');
  }

  const branches = await listBranches(cwd);
  const info = branches.find((branch) => branch.name === sanitized);
  if (!info) throw new Error(`Branch '${sanitized}' was not found.`);
  if (!info.remote) {
    throw new Error(`Push '${sanitized}' before making it the default branch.`);
  }

  const currentDefault = await detectDefaultBranch(cwd, remote);
  if (currentDefault === sanitized) {
    return `'${sanitized}' is already the default branch.`;
  }

  const remoteUrl = (await git(cwd, ['remote', 'get-url', remote]).catch(() => '')).trim();
  const parsed = parseGithubRemote(remoteUrl);
  if (parsed && (await isGhCliAvailable())) {
    await ghApi<GithubApiRepo>(`repos/${parsed.owner}/${parsed.repo}`, [
      '-X',
      'PATCH',
      '-f',
      `default_branch=${sanitized}`,
    ]);
    await git(cwd, ['remote', 'set-head', remote, sanitized]);
    return `Default branch is now '${sanitized}' on GitHub.`;
  }

  await git(cwd, ['remote', 'set-head', remote, sanitized]);
  if (parsed) {
    return `Local remote HEAD now points at '${sanitized}'. Install and sign in to the GitHub CLI to change it on GitHub too.`;
  }
  return `Remote HEAD now points at '${sanitized}'.`;
}

const HISTORY_COMMIT_LIMIT = 100;
const ACTIVITY_DAYS = 84;

function localIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyActivity(): GitDayCount[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: GitDayCount[] = [];
  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    days.push({ date: localIsoDate(day), count: 0 });
  }
  return days;
}

async function resolveBranchRef(cwd: string, branchName: string): Promise<string> {
  const sanitized = sanitizeGitBranchName(branchName);
  if (!sanitized) throw new Error('Branch name cannot be empty.');
  const branches = await listBranches(cwd);
  const info = branches.find((branch) => branch.name === sanitized);
  if (!info) throw new Error(`Branch '${sanitized}' was not found.`);
  if (info.local) return sanitized;
  const remote = await primaryRemote(cwd);
  if (remote && info.remote) return `${remote}/${sanitized}`;
  throw new Error(`Branch '${sanitized}' is not available locally or on a remote.`);
}

function parseLogTags(decorations: string): string[] {
  if (!decorations) return [];
  const tags: string[] = [];
  for (const part of decorations.split(',')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('tag: ')) tags.push(trimmed.slice(5));
  }
  return tags;
}

function parseCommitLog(output: string): GitCommitInfo[] {
  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, shortHash, author, date, parents, decorations, subject] = record.split('\x1f');
      return {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        author: author ?? '',
        date: date ?? '',
        subject: subject ?? '',
        parents: (parents ?? '').split(' ').filter(Boolean),
        tags: parseLogTags(decorations ?? ''),
      };
    })
    .filter((commit) => commit.hash.length > 0);
}

async function readBranchHistory(cwd: string, branchName: string): Promise<GitBranchHistory> {
  const sanitized = sanitizeGitBranchName(branchName);
  const ref = await resolveBranchRef(cwd, sanitized);
  const pretty = '%H%x1f%h%x1f%an%x1f%aI%x1f%P%x1f%D%x1f%s%x1e';
  const log = await git(cwd, [
    'log',
    ref,
    `--max-count=${HISTORY_COMMIT_LIMIT}`,
    `--pretty=format:${pretty}`,
  ]).catch(() => '');
  const commits = parseCommitLog(log);

  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_DAYS);
  const activityLog = await git(cwd, [
    'log',
    ref,
    `--since=${since.toISOString()}`,
    '--pretty=format:%aI',
  ]).catch(() => '');
  const activity = emptyActivity();
  const index = new Map(activity.map((day, i) => [day.date, i]));
  for (const line of activityLog.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = localIsoDate(parsed);
    const slot = index.get(key);
    if (slot !== undefined) activity[slot].count += 1;
  }

  return { branch: sanitized, commits, activity };
}

async function renameBranch(
  cwd: string,
  from: string,
  to: string,
  updateRemote: boolean,
): Promise<string> {
  const currentName = sanitizeGitBranchName(from);
  const nextName = sanitizeGitBranchName(to);
  if (!currentName || !nextName) throw new Error('Branch name cannot be empty.');
  if (currentName === nextName) throw new Error('The new name is the same as the current one.');

  const branches = await listBranches(cwd);
  const info = branches.find((branch) => branch.name === currentName);
  if (!info) throw new Error(`Branch '${currentName}' was not found.`);
  if (!info.local) {
    throw new Error(`Switch to '${currentName}' before renaming it.`);
  }
  if (branches.some((branch) => branch.name === nextName)) {
    throw new Error(`A branch named '${nextName}' already exists.`);
  }

  await git(cwd, ['branch', '-m', currentName, nextName]);
  const notes = [`Renamed '${currentName}' to '${nextName}'.`];

  if (updateRemote) {
    const remote = await primaryRemote(cwd);
    if (!remote) throw new Error('Connect a remote before renaming a branch there.');
    try {
      await git(cwd, ['push', '-u', remote, nextName], PUSH_TIMEOUT_MS);
      notes.push(`Pushed '${nextName}' to ${remote}.`);
      const defaultBranch = await detectDefaultBranch(cwd, remote);
      if (info.remote && (defaultBranch === currentName || defaultBranch === nextName)) {
        notes.push(await setDefaultBranch(cwd, nextName));
      }
      if (info.remote) {
        await git(cwd, ['push', remote, '--delete', currentName], PUSH_TIMEOUT_MS);
        notes.push(`Deleted '${currentName}' on ${remote}.`);
      }
    } catch (error) {
      const err = error as { stderr?: string; message?: string };
      throw new Error(
        `Renamed locally to '${nextName}', but the remote update failed: ${(err.stderr || err.message || 'unknown error').trim()}`,
      );
    }
  }

  return notes.join(' ');
}

async function deleteBranch(
  cwd: string,
  branchName: string,
  options: { deleteRemote: boolean; force: boolean },
): Promise<string> {
  const sanitized = sanitizeGitBranchName(branchName);
  if (!sanitized) throw new Error('Branch name cannot be empty.');

  const current = (await git(cwd, ['branch', '--show-current']).catch(() => '')).trim();
  if (current === sanitized) {
    throw new Error('Switch to another branch before deleting this one.');
  }

  const remote = await primaryRemote(cwd);
  const defaultBranch = await detectDefaultBranch(cwd, remote);
  if (defaultBranch === sanitized) {
    throw new Error('Change the default branch before deleting this one.');
  }

  const branches = await listBranches(cwd);
  const info = branches.find((branch) => branch.name === sanitized);
  if (!info) throw new Error(`Branch '${sanitized}' was not found.`);

  const notes: string[] = [];
  if (info.local) {
    await git(cwd, ['branch', options.force ? '-D' : '-d', sanitized]);
    notes.push(`Deleted local branch '${sanitized}'.`);
  }

  const shouldDeleteRemote = info.remote && (options.deleteRemote || !info.local);
  if (shouldDeleteRemote) {
    if (!remote) throw new Error('Connect a remote before deleting a remote branch.');
    await git(cwd, ['push', remote, '--delete', sanitized], PUSH_TIMEOUT_MS);
    notes.push(`Deleted '${sanitized}' on ${remote}.`);
  }

  if (notes.length === 0) {
    throw new Error(`Nothing to delete for '${sanitized}'.`);
  }
  return notes.join(' ');
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
  const truncatedDiff =
    diff.length > MAX_DIFF_CHARS ? `${diff.slice(0, MAX_DIFF_CHARS)}\n… (truncated)` : diff;

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
  const latestTag =
    (await git(cwd, ['describe', '--tags', '--abbrev=0']).catch(() => '')).trim() || null;
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
function buildReleaseSummary(
  latestTag: string | null,
  subjects: string[],
  diffStat: string,
): string {
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

/** Keeps the repo's own `v` prefix style rather than whatever the model emitted. */
function formatTagForRepo(version: string, latestTag: string | null): string {
  const wantsPrefix = latestTag ? latestTag.startsWith('v') : true;
  if (wantsPrefix && !version.startsWith('v')) return `v${version}`;
  if (!wantsPrefix && version.startsWith('v')) return version.slice(1);
  return version;
}

/**
 * Models often answer `TAG: patch` (or minor/major) instead of a concrete semver.
 * That still tells us which component to bump when we already know the latest tag.
 */
function parseBumpKind(text: string): 'major' | 'minor' | 'patch' | null {
  const tagLine = text.match(/^\s*TAG:\s*(.+)$/im)?.[1]?.trim() ?? '';
  // Only trust the TAG line so a NOTES sentence mentioning "major refactor" doesn't bump major.
  const word = tagLine.match(/\b(major|minor|patch)\b/i)?.[1]?.toLowerCase();
  if (word === 'major' || word === 'minor' || word === 'patch') return word;
  return null;
}

function bumpVersion(latest: SemverParts, kind: 'major' | 'minor' | 'patch'): string {
  if (kind === 'major') return `${latest.major + 1}.0.0`;
  if (kind === 'minor') return `${latest.major}.${latest.minor + 1}.0`;
  return `${latest.major}.${latest.minor}.${latest.patch + 1}`;
}

function extractTagNotes(text: string): { reason?: string; message?: string } {
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

  return { reason: reason || undefined, message: notes || undefined };
}

/**
 * Pulls the tag, the rationale and the release notes out of the CLI's answer,
 * tolerating chatter around the requested TAG/WHY/NOTES format.
 */
function parseSuggestedTag(text: string, latestTag: string | null): SuggestedTag | null {
  const tagLine = text.match(/^\s*TAG:\s*(.+)$/im)?.[1];
  const semver = /v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/;
  // Prefer a concrete version on the TAG line. If the model wrote "TAG: patch" (no
  // digits), keep looking through the rest of the answer before giving up.
  const match = tagLine?.match(semver) ?? text.match(semver);
  if (!match) return null;

  const tag = formatTagForRepo(match[0], latestTag);
  const { reason, message } = extractTagNotes(text);
  return { tag, reason, message };
}

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  /** Set for pre-releases like 1.7.0-rc.1, which sort below the plain 1.7.0. */
  prerelease: string | null;
}

function parseSemver(tag: string): SemverParts | null {
  const match = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ?? null,
  };
}

/** Positive when `a` is newer than `b`. */
function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

/**
 * The next version worked out from the commit subjects alone, using conventional-commit
 * markers: a `!` or BREAKING CHANGE means major, a `feat` means minor, anything else patch.
 * This is the safety net for when the CLI answers with a version that isn't actually a bump
 * of the latest tag, which models do surprisingly often (a stock "1.2.3", say).
 */
function deriveNextVersion(latest: SemverParts, subjects: string[]): string {
  const isBreaking = subjects.some(
    (s) => /^[a-z]+(\([^)]*\))?!:/i.test(s) || /BREAKING[ -]CHANGE/i.test(s),
  );
  const hasFeature = subjects.some((s) => /^feat(\([^)]*\))?:/i.test(s));

  if (isBreaking) return `${latest.major + 1}.0.0`;
  if (hasFeature) return `${latest.major}.${latest.minor + 1}.0`;
  return `${latest.major}.${latest.minor}.${latest.patch + 1}`;
}

/**
 * Per-path edit sizes against HEAD, plus untracked paths. Comparing two of these across a
 * run is what identifies the files an agent touched. A plain `git status` comparison would
 * miss any file that was already modified beforehand, since its status letters don't change.
 */
async function readWorkingTreeFingerprint(cwd: string): Promise<Map<string, string>> {
  const fingerprint = new Map<string, string>();

  // Fails on a repo with no commits yet, where there is nothing to diff against.
  const numstat = await git(cwd, ['diff', 'HEAD', '--numstat']).catch(() => '');
  for (const line of numstat.split('\n')) {
    const parts = line.trim().split('\t');
    if (parts.length >= 3) fingerprint.set(parts.slice(2).join('\t'), `${parts[0]}/${parts[1]}`);
  }

  const untracked = await git(cwd, ['ls-files', '--others', '--exclude-standard']).catch(() => '');
  for (const path of untracked
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)) {
    fingerprint.set(path, 'untracked');
  }

  return fingerprint;
}

/** Prompt handed to the agent CLI to roll a new version number through the project's files. */
function buildVersionBumpPrompt(tag: string): string {
  const version = tag.replace(/^v/, '');
  return [
    `Update this project's version to ${version}.`,
    '',
    '- Set the version field in every manifest this repo actually uses: package.json (including',
    '  workspace packages), pyproject.toml, Cargo.toml, *.csproj, app.json, build.gradle,',
    '  Info.plist, and so on.',
    '- Update hard-coded version strings the application itself displays (about screens, footers,',
    '  constants such as APP_VERSION).',
    '- Leave lockfiles alone. Only touch a CHANGELOG if this project clearly keeps one.',
    '- Edit the version fields directly. Do not run `npm version`, `yarn version`, `pnpm version`,',
    '  `cargo release`, or any other command that bumps a version by itself, since those also',
    "  create a commit and a git tag. Do not commit, tag or push anything; that's handled separately.",
    '',
    'When you are done, reply with a short plain-text summary: one line per file you changed,',
    'as "path: old version -> new version". No markdown.',
  ].join('\n');
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
    return await git(cwd, ['push'], PUSH_TIMEOUT_MS);
  } catch (error) {
    const err = error as { stderr?: string };
    if (/has no upstream branch|set the upstream/i.test(err.stderr ?? '')) {
      const remote = (await primaryRemote(cwd)) ?? 'origin';
      return git(cwd, ['push', '-u', remote, branch], PUSH_TIMEOUT_MS);
    }
    throw error;
  }
}

/**
 * Push the current branch first (so the tagged commit lands on origin), then the tag.
 * Pushing only `refs/tags/...` leaves the branch ahead, which is why "Create & push"
 * used to still need the git-section Push button afterwards.
 */
async function pushBranchAndTag(cwd: string, tag: string): Promise<void> {
  const remote = (await primaryRemote(cwd)) ?? 'origin';
  const branch = (await git(cwd, ['branch', '--show-current']).catch(() => '')).trim();
  if (branch) {
    await pushCurrentBranch(cwd, branch);
  }
  await git(cwd, ['push', remote, `refs/tags/${tag}`], PUSH_TIMEOUT_MS);
}

/**
 * Origin can point at a folder, a UNC share or a file:// URL. Those clone fine but
 * are nothing to hand a browser, so the project's repository link stays empty.
 */
const LOCAL_REMOTE_PATTERN = /^([a-z]:[\\/]|\\\\|\/|\.{1,2}[\\/]|file:)/i;

/** What GitHub accepts for a login or a repository name, and git for a branch. */
const GITHUB_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BRANCH_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

interface GithubApiRepo {
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string | null;
  private: boolean;
}

function toRepoInfo(repo: GithubApiRepo): GithubRepoInfo {
  return {
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    sshUrl: repo.ssh_url,
    // A repository with no commits yet reports no default branch.
    defaultBranch: repo.default_branch ?? '',
    isPrivate: repo.private,
  };
}

/** Who the GitHub CLI is logged in as, and everywhere that account can publish a repo. */
async function readGithubAccount(): Promise<GithubAccount> {
  if (!(await isGhCliAvailable())) {
    return { cliAvailable: false, authenticated: false, login: null, owners: [] };
  }

  let login: string;
  try {
    login = (await ghApi<{ login: string }>('user')).login;
  } catch (error) {
    return {
      cliAvailable: true,
      authenticated: false,
      login: null,
      owners: [],
      error: ghErrorMessage(error),
    };
  }

  const owners: GithubOwner[] = [{ login, type: 'user' }];
  try {
    const orgs = await ghApi<{ login: string }[]>('user/orgs?per_page=100');
    for (const org of orgs) owners.push({ login: org.login, type: 'organization' });
  } catch {
    // Listing organizations needs the read:org scope, which plenty of tokens don't carry.
    // The personal account on its own is still a perfectly good place to publish to.
  }

  return { cliAvailable: true, authenticated: true, login, owners };
}

const GITHUB_ACTIVITY_DAYS = 84;

interface GithubContributionCalendar {
  viewer: {
    login: string;
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
      };
    };
  } | null;
}

function emptyGithubActivity(partial: Omit<GithubActivity, 'yearCount' | 'days'>): GithubActivity {
  return { ...partial, yearCount: 0, days: [] };
}

function sliceRecentDays(
  byDate: Map<string, number>,
  days: number,
): { date: string; count: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: { date: string; count: number }[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const date = localIsoDate(day);
    result.push({ date, count: byDate.get(date) ?? 0 });
  }
  return result;
}

/** Contribution calendar for the GitHub CLI's signed-in user. */
async function readGithubActivity(): Promise<GithubActivity> {
  if (!(await isGhCliAvailable())) {
    return emptyGithubActivity({
      ok: false,
      cliAvailable: false,
      authenticated: false,
      login: null,
      error: 'GitHub CLI (gh) is not installed.',
    });
  }

  try {
    const data = await ghGraphql<GithubContributionCalendar>(
      'query{viewer{login contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}',
    );
    const viewer = data.viewer;
    if (!viewer) {
      return emptyGithubActivity({
        ok: false,
        cliAvailable: true,
        authenticated: false,
        login: null,
        error: 'Not signed in to the GitHub CLI. Run "gh auth login" first.',
      });
    }

    const byDate = new Map<string, number>();
    for (const week of viewer.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        byDate.set(day.date, day.contributionCount);
      }
    }

    return {
      ok: true,
      cliAvailable: true,
      authenticated: true,
      login: viewer.login,
      yearCount: viewer.contributionsCollection.contributionCalendar.totalContributions,
      days: sliceRecentDays(byDate, GITHUB_ACTIVITY_DAYS),
    };
  } catch (error) {
    const message = ghErrorMessage(error);
    const signedOut = /401|not logged|must authenticate|gh auth login/i.test(message);
    return emptyGithubActivity({
      ok: false,
      cliAvailable: true,
      authenticated: !signedOut,
      login: null,
      error: signedOut
        ? `Not signed in to the GitHub CLI. Run "gh auth login" first. (${message})`
        : message,
    });
  }
}

interface GithubApiNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  subject: { title: string; url: string | null; type: string };
  repository: { full_name: string; html_url: string };
}

function notificationUrl(item: GithubApiNotification): string | null {
  const apiUrl = item.subject.url;
  if (!apiUrl) return item.repository.html_url || null;
  return apiUrl
    .replace('https://api.github.com/repos/', 'https://github.com/')
    .replace('/pulls/', '/pull/')
    .replace('/commits/', '/commit/');
}

function toNotificationItem(item: GithubApiNotification): GithubNotificationItem {
  return {
    id: item.id,
    unread: item.unread,
    reason: item.reason,
    title: item.subject.title,
    type: item.subject.type,
    repo: item.repository.full_name,
    updatedAt: item.updated_at,
    url: notificationUrl(item),
  };
}

function emptyGithubNotifications(
  partial: Omit<GithubNotifications, 'notifications'>,
): GithubNotifications {
  return { ...partial, notifications: [] };
}

async function readGithubNotifications(): Promise<GithubNotifications> {
  if (!(await isGhCliAvailable())) {
    return emptyGithubNotifications({
      ok: false,
      cliAvailable: false,
      authenticated: false,
      error: 'GitHub CLI (gh) is not installed.',
    });
  }

  try {
    const items = await ghApi<GithubApiNotification[]>('notifications?per_page=50');
    return {
      ok: true,
      cliAvailable: true,
      authenticated: true,
      notifications: items.map(toNotificationItem),
    };
  } catch (error) {
    const message = ghErrorMessage(error);
    const signedOut = /401|not logged|must authenticate|gh auth login/i.test(message);
    return emptyGithubNotifications({
      ok: false,
      cliAvailable: true,
      authenticated: !signedOut,
      error: signedOut
        ? `Not signed in to the GitHub CLI. Run "gh auth login" first. (${message})`
        : message,
    });
  }
}

const GITHUB_THREAD_ID_PATTERN = /^\d+$/;

async function markGithubNotificationRead(threadId: string): Promise<GitOpResult> {
  const id = threadId.trim();
  if (!GITHUB_THREAD_ID_PATTERN.test(id)) {
    return { ok: false, message: 'That notification id is not valid.' };
  }
  if (!(await isGhCliAvailable())) {
    return { ok: false, message: 'GitHub CLI (gh) is not installed.' };
  }
  try {
    await ghApiAllowEmpty(`notifications/threads/${id}`, ['-X', 'PATCH']);
    return { ok: true, message: 'Marked as read.' };
  } catch (error) {
    return { ok: false, message: ghErrorMessage(error) };
  }
}

async function markGithubNotificationsRead(): Promise<GitOpResult> {
  if (!(await isGhCliAvailable())) {
    return { ok: false, message: 'GitHub CLI (gh) is not installed.' };
  }
  try {
    await ghApiAllowEmpty('notifications', ['-X', 'PUT']);
    return { ok: true, message: 'All notifications marked as read.' };
  } catch (error) {
    return { ok: false, message: ghErrorMessage(error) };
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
    const result = await runGitOp(async () => {
      const status = await readStatus(cwd);
      if (!status.branch) throw new Error('No current branch to push.');
      return pushCurrentBranch(cwd, status.branch);
    });
    if (result.ok) schedulePipelineCheck(projectId);
    return result;
  });

  ipcMain.handle(IPC.git.sync, async (_event, projectId: string): Promise<GitOpResult> => {
    const cwd = await getProjectPath(projectId);
    const result = await runGitOp(async () => {
      const fetchOut = await git(cwd, ['fetch', '--all', '--prune']);
      const pullOut = await git(cwd, ['pull']);
      const status = await readStatus(cwd);
      const pushOut = status.branch ? await pushCurrentBranch(cwd, status.branch) : '';
      return [fetchOut, pullOut, pushOut].filter(Boolean).join('\n');
    });
    if (result.ok) schedulePipelineCheck(projectId);
    return result;
  });

  ipcMain.handle(
    IPC.git.createBranch,
    async (_event, projectId: string, branchName: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      const sanitized = sanitizeGitBranchName(branchName);
      if (!sanitized) return { ok: false, message: 'Branch name cannot be empty.' };
      return runGitOp(() => git(cwd, ['checkout', '-b', sanitized]));
    },
  );

  ipcMain.handle(
    IPC.git.checkoutBranch,
    async (_event, projectId: string, branchName: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      return runGitOp(() => checkoutBranch(cwd, branchName));
    },
  );

  ipcMain.handle(
    IPC.git.setDefaultBranch,
    async (_event, projectId: string, branchName: string): Promise<GitOpResult> => {
      const cwd = await getProjectPath(projectId);
      return runGitOp(() => setDefaultBranch(cwd, branchName));
    },
  );

  ipcMain.handle(
    IPC.git.renameBranch,
    async (_event, input: RenameBranchInput): Promise<GitOpResult> => {
      const cwd = await getProjectPath(input.projectId);
      return runGitOp(() => renameBranch(cwd, input.from, input.to, Boolean(input.updateRemote)));
    },
  );

  ipcMain.handle(
    IPC.git.deleteBranch,
    async (_event, input: DeleteBranchInput): Promise<GitOpResult> => {
      const cwd = await getProjectPath(input.projectId);
      return runGitOp(() =>
        deleteBranch(cwd, input.branchName, {
          deleteRemote: Boolean(input.deleteRemote),
          force: Boolean(input.force),
        }),
      );
    },
  );

  ipcMain.handle(
    IPC.git.branchHistory,
    async (_event, projectId: string, branchName: string): Promise<GitBranchHistory> => {
      return readBranchHistory(await getProjectPath(projectId), branchName);
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
        message:
          'Invalid tag name. Use letters, digits, dots, dashes, underscores or slashes (e.g. v1.0.1).',
      };
    }

    const localSha = await git(cwd, ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`])
      .then((out) => out.trim())
      .catch(() => null);

    if (localSha) {
      // The tag is already there locally, most often because the version-bump CLI ran a tool
      // like `npm version` that tags on its own despite being told not to. As long as it still
      // points at HEAD, treat this as "already made, just needs pushing" instead of a conflict.
      const headSha = (await git(cwd, ['rev-parse', 'HEAD'])).trim();
      if (localSha !== headSha) {
        return {
          ok: false,
          message: `Tag ${tag} already exists locally but points at a different commit than HEAD. Delete it (or pick a different name) before retrying.`,
        };
      }
      if (!input.push) return { ok: false, message: `Tag ${tag} already exists locally.` };

      const existingResult = await runGitOp(async () => {
        const remote = (await primaryRemote(cwd)) ?? 'origin';
        // Annotated tags list under their own object sha; the "^{}" peeled ref is what
        // resolves that back to the commit, which is what `localSha` was compared against above.
        const remoteRefs = (
          await git(cwd, [
            'ls-remote',
            remote,
            `refs/tags/${tag}`,
            `refs/tags/${tag}^{}`,
          ]).catch(() => '')
        )
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const peeled = remoteRefs.find((line) => line.endsWith('^{}'));
        const remoteSha = (peeled ?? remoteRefs[0])?.split(/\s+/)[0];
        if (remoteSha && remoteSha !== localSha) {
          throw new Error(`Tag ${tag} already exists on origin and points at a different commit.`);
        }
        await pushBranchAndTag(cwd, tag);
        return remoteSha
          ? `Tag ${tag} already exists locally and on origin.`
          : `Tag ${tag} already existed locally, pushed the branch and tag to origin.`;
      });
      if (existingResult.ok) schedulePipelineCheck(input.projectId);
      return existingResult;
    }

    const createdResult = await runGitOp(async () => {
      await git(cwd, ['tag', '-a', tag, '-m', input.message?.trim() || tag]);
      if (!input.push) return `Created tag ${tag} locally.`;
      try {
        await pushBranchAndTag(cwd, tag);
      } catch (error) {
        // Leave the repo as we found it so the user can retry the same tag after fixing the remote.
        await git(cwd, ['tag', '-d', tag]).catch(() => undefined);
        throw error;
      }
      return `Created tag ${tag} and pushed the branch and tag to origin.`;
    });
    if (createdResult.ok && input.push) schedulePipelineCheck(input.projectId);
    return createdResult;
  });

  ipcMain.handle(
    IPC.git.suggestTag,
    async (_event, projectId: string, requestId?: string): Promise<SuggestTagResult> => {
      const project = await getProject(projectId);
      const cwd = project.folderPath;
      const { latestTag, commitsSinceLatestTag } = await readTagInfo(cwd);
      if (latestTag && commitsSinceLatestTag === 0) {
        return {
          ok: false,
          error: `No new commits since ${latestTag}, so there is nothing to tag yet.`,
        };
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
        (latestTag
          ? `The repository's latest tag is ${latestTag}. Your answer MUST be a bump of exactly that ` +
            'version and must be greater than it. Never invent an unrelated version number.\n\n'
          : '') +
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
      const notes = extractTagNotes(result.text);
      const latestParts = latestTag ? parseSemver(latestTag) : null;

      // Models often skip a concrete semver ("TAG: patch", prose only, etc.). When we
      // already know the latest tag, turn that into a real bump instead of failing the run.
      let tag = parsed?.tag;
      let reason = parsed?.reason ?? notes.reason;
      if (!tag && latestParts) {
        const bumpKind = parseBumpKind(result.text);
        const derived = bumpKind
          ? bumpVersion(latestParts, bumpKind)
          : deriveNextVersion(latestParts, subjects);
        tag = formatTagForRepo(derived, latestTag);
        reason = bumpKind
          ? `${result.cliName} suggested a ${bumpKind} bump; used ${tag}.`
          : `${result.cliName} did not return a version number; used ${tag} from the commit history instead.`;
      }

      if (!tag) {
        return {
          ok: false,
          cliName: result.cliName,
          error: `${result.cliName} did not return a version number.`,
        };
      }

      // Models regularly answer with a stock version ("1.2.3") that has nothing to do with
      // the repo. Anything that isn't strictly newer than the latest tag is dropped in favour
      // of a bump derived from the commits themselves.
      const suggestedParts = parseSemver(tag);
      if (latestParts && (!suggestedParts || compareSemver(suggestedParts, latestParts) <= 0)) {
        const derived = deriveNextVersion(latestParts, subjects);
        const rejected = tag;
        tag = formatTagForRepo(derived, latestTag);
        reason = `${result.cliName} suggested ${rejected}, which isn't newer than ${latestTag}; used ${tag} from the commit history instead.`;
      }

      return {
        ok: true,
        tag,
        reason,
        // A CLI that ignored the NOTES section still gets a usable annotation, straight from the log.
        message: parsed?.message || notes.message || fallbackTagMessage(tag, subjects),
        cliName: result.cliName,
      };
    },
  );

  ipcMain.handle(IPC.git.cancelSuggestTag, (_event, requestId: string): boolean => {
    return cancelHeadlessPrompt(requestId);
  });

  ipcMain.handle(
    IPC.git.applyVersion,
    async (_event, input: ApplyVersionInput): Promise<ApplyVersionResult> => {
      const project = await getProject(input.projectId);
      const cwd = project.folderPath;
      const tag = input.tag.trim();
      if (!tag) {
        return { ok: false, output: '', changedFiles: [], error: 'No version to apply.' };
      }

      // Snapshot first: the CLI's own summary of what it edited can't be trusted, and
      // diffing the working tree before and after is the only account of it that can.
      const before = await readWorkingTreeFingerprint(cwd);
      const headBefore = await git(cwd, ['rev-parse', 'HEAD'])
        .then((sha) => sha.trim())
        .catch(() => null);

      const result = await runHeadlessCliPrompt(buildVersionBumpPrompt(tag), cwd, {
        requestId: input.requestId,
        preferredCliId: project.cliId,
        allowWrites: true,
      });

      const after = await readWorkingTreeFingerprint(cwd);
      const changedFiles = [...after.entries()]
        .filter(([path, edits]) => before.get(path) !== edits)
        .map(([path]) => path)
        .sort();

      // Despite the prompt telling it not to, a CLI occasionally reaches for a tool like
      // `npm version` that commits (and tags) by itself; that leaves no working-tree diff to
      // report, so this is the only way to tell the UI the bump actually landed in a commit.
      const headAfter = await git(cwd, ['rev-parse', 'HEAD'])
        .then((sha) => sha.trim())
        .catch(() => null);
      const committedByCli = headBefore !== null && headAfter !== null && headBefore !== headAfter;

      if (!result.ok) {
        return {
          ok: false,
          output: result.text,
          changedFiles,
          committedByCli,
          cliName: result.cliName,
          error: result.error,
          cancelled: result.cancelled,
        };
      }

      return {
        ok: true,
        output: result.text,
        changedFiles,
        committedByCli,
        cliName: result.cliName,
      };
    },
  );

  ipcMain.handle(IPC.git.cancelApplyVersion, (_event, requestId: string): boolean => {
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
      return {
        ok: result.ok,
        text: result.text,
        cliName: result.cliName,
        error: result.error,
        cancelled: result.cancelled,
      };
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
      return {
        ok: result.ok,
        text: result.text,
        cliName: result.cliName,
        error: result.error,
        cancelled: result.cancelled,
      };
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

  ipcMain.handle(IPC.git.init, async (_event, input: GitInitInput): Promise<GitOpResult> => {
    const cwd = await getProjectPath(input.projectId);
    const branch = input.branch.trim().replace(/\s+/g, '-');
    if (!branch) return { ok: false, message: 'Branch name cannot be empty.' };
    if (!BRANCH_NAME_PATTERN.test(branch) || branch.includes('..')) {
      return {
        ok: false,
        message:
          'Invalid branch name. Use letters, digits, dots, dashes, underscores or slashes (e.g. master).',
      };
    }
    if (await isGitRepo(cwd)) {
      return { ok: false, message: 'This folder is already a git repository.' };
    }

    return runGitOp(async () => {
      try {
        await git(cwd, ['init', '-b', branch]);
      } catch {
        // git older than 2.28 has no --initial-branch, so point HEAD at the branch by hand.
        await git(cwd, ['init']);
        await git(cwd, ['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
      }

      if (!input.initialCommit) return `Initialized an empty repository on ${branch}.`;

      await git(cwd, ['add', '-A']);
      const staged = (await git(cwd, ['diff', '--cached', '--name-only']).catch(() => '')).trim();
      if (!staged) {
        return `Initialized an empty repository on ${branch}. There was nothing to commit yet.`;
      }
      await git(cwd, ['commit', '-m', input.commitMessage?.trim() || 'Initial commit']);
      return `Initialized the repository on ${branch} and committed the current files.`;
    });
  });

  ipcMain.handle(IPC.git.githubAccount, async (): Promise<GithubAccount> => readGithubAccount());

  ipcMain.handle(IPC.git.githubActivity, async (): Promise<GithubActivity> => readGithubActivity());

  ipcMain.handle(
    IPC.git.githubNotifications,
    async (): Promise<GithubNotifications> => readGithubNotifications(),
  );

  ipcMain.handle(
    IPC.git.githubMarkNotificationRead,
    async (_event, threadId: string): Promise<GitOpResult> => markGithubNotificationRead(threadId),
  );

  ipcMain.handle(
    IPC.git.githubMarkNotificationsRead,
    async (): Promise<GitOpResult> => markGithubNotificationsRead(),
  );

  ipcMain.handle(
    IPC.git.lookupGithubRepo,
    async (_event, owner: string, name: string): Promise<GithubRepoLookup> => {
      const cleanOwner = owner.trim();
      const cleanName = name.trim().replace(/\.git$/i, '');
      if (!GITHUB_NAME_PATTERN.test(cleanOwner) || !GITHUB_NAME_PATTERN.test(cleanName)) {
        return {
          ok: false,
          exists: false,
          error:
            'Owner and repository names can only hold letters, digits, dots, dashes and underscores.',
        };
      }
      if (!(await isGhCliAvailable())) {
        return { ok: false, exists: false, error: 'GitHub CLI (gh) is not installed.' };
      }

      try {
        const repo = await ghApi<GithubApiRepo>(`repos/${cleanOwner}/${cleanName}`);
        return { ok: true, exists: true, repo: toRepoInfo(repo) };
      } catch (error) {
        const message = ghErrorMessage(error);
        // A 404 is the answer we asked for ("there is no such repo"), not a failure.
        if (/\b404\b|not found/i.test(message)) return { ok: true, exists: false };
        return { ok: false, exists: false, error: message };
      }
    },
  );

  ipcMain.handle(
    IPC.git.createGithubRepo,
    async (_event, input: CreateGithubRepoInput): Promise<CreateGithubRepoResult> => {
      const owner = input.owner.trim();
      const name = input.name.trim().replace(/\.git$/i, '');
      if (!GITHUB_NAME_PATTERN.test(owner) || !GITHUB_NAME_PATTERN.test(name)) {
        return {
          ok: false,
          error:
            'Owner and repository names can only hold letters, digits, dots, dashes and underscores.',
        };
      }

      const account = await readGithubAccount();
      if (!account.authenticated) {
        return {
          ok: false,
          error: account.cliAvailable
            ? `Not signed in to the GitHub CLI. Run "gh auth login" first.${account.error ? ` (${account.error})` : ''}`
            : 'GitHub CLI (gh) is not installed.',
        };
      }

      // Repos live under either the account itself or one of its organizations, and
      // GitHub has a separate endpoint for each.
      const isPersonal = owner.toLowerCase() === (account.login ?? '').toLowerCase();
      const endpoint = isPersonal ? 'user/repos' : `orgs/${owner}/repos`;
      const args = ['-X', 'POST', '-f', `name=${name}`, '-F', `private=${input.isPrivate}`];
      const description = input.description?.trim();
      if (description) args.push('-f', `description=${description}`);

      try {
        const repo = await ghApi<GithubApiRepo>(endpoint, args);
        return { ok: true, repo: toRepoInfo(repo) };
      } catch (error) {
        return { ok: false, error: ghErrorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    IPC.git.connectRemote,
    async (_event, input: ConnectRemoteInput): Promise<GitOpResult> => {
      const cwd = await getProjectPath(input.projectId);
      const url = input.url.trim();
      if (!url) return { ok: false, message: 'Remote URL cannot be empty.' };
      if (!/^(https?:\/\/|ssh:\/\/|git@)/i.test(url)) {
        return { ok: false, message: 'The remote must be an https or ssh git URL.' };
      }
      if (!(await isGitRepo(cwd))) {
        return { ok: false, message: 'This folder is not a git repository yet.' };
      }

      return runGitOp(async () => {
        const remotes = (await git(cwd, ['remote']).catch(() => ''))
          .split('\n')
          .map((remote) => remote.trim())
          .filter(Boolean);
        if (remotes.includes('origin')) {
          await git(cwd, ['remote', 'set-url', 'origin', url]);
        } else {
          await git(cwd, ['remote', 'add', 'origin', url]);
        }
        if (!input.push) return `Connected origin to ${url}.`;

        const hasCommit = await git(cwd, ['rev-parse', '--verify', 'HEAD'])
          .then(() => true)
          .catch(() => false);
        if (!hasCommit) {
          return `Connected origin to ${url}. There is nothing to push until you make a commit.`;
        }

        const branch = (await git(cwd, ['branch', '--show-current'])).trim();
        if (!branch) throw new Error('No current branch to push, HEAD is detached.');
        await git(cwd, ['push', '-u', 'origin', branch], PUSH_TIMEOUT_MS);
        return `Connected origin and pushed ${branch}.`;
      });
    },
  );

  /**
   * Origin's URL for a folder on disk, addressed by path rather than project id:
   * the new-project form needs this before the project exists. Null when the
   * folder isn't a repository or has no origin, which is not an error worth showing.
   */
  ipcMain.handle(
    IPC.git.detectRemote,
    async (_event, folderPath: string): Promise<string | null> => {
      const cwd = folderPath?.trim();
      if (!cwd || !(await isGitRepo(cwd))) return null;
      const remote = (await git(cwd, ['remote', 'get-url', 'origin']).catch(() => '')).trim();
      if (!remote || LOCAL_REMOTE_PATTERN.test(remote)) return null;
      return browsableRepoUrl(remote);
    },
  );
}
