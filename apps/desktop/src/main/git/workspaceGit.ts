import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { type GitChangeEntry, parseNumstatZ, parseStatusV2, withNumstat } from '@agentmat/core';
import { shell } from 'electron';
import type {
  GitDiffSide,
  GitDiscardResult,
  GitFileDiff,
  GitPendingOperation,
  WorkspaceGitState,
} from '../../shared/apiTypes';
import { gitOrNull } from './plumbing';
import { runGit } from './versionReview';

/** Past this many untracked files the list is cut; a missing .gitignore should not flood the panel. */
const MAX_UNTRACKED = 2000;
/** Either side of a diff above this is shown as "too large" instead of loading it into Monaco. */
const MAX_DIFF_BYTES = 2 * 1024 * 1024;
/** How long a discard can be undone. */
const UNDO_TTL_MS = 5 * 60_000;
/** A request naming more paths than this is not coming from the panel. */
const MAX_PATHS = 10_000;
const OBJECT_ID_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

export const EMPTY_WORKSPACE_GIT_STATE: WorkspaceGitState = {
  isRepo: false,
  branch: null,
  detached: false,
  head: null,
  upstream: null,
  ahead: 0,
  behind: 0,
  hasRemote: false,
  operation: null,
  conflicts: [],
  staged: [],
  unstaged: [],
  untracked: [],
  untrackedTruncated: false,
};

interface RepoLocation {
  root: string;
  gitDir: string;
}

/** The repository a folder belongs to, or null when it is not inside one. */
export async function locateRepo(cwd: string): Promise<RepoLocation | null> {
  const out = await gitOrNull(cwd, ['rev-parse', '--show-toplevel', '--absolute-git-dir']);
  const [root, gitDir] = (out ?? '').split(/\r?\n/).map((line) => line.trim());
  return root && gitDir ? { root: resolve(root), gitDir: resolve(gitDir) } : null;
}

function pendingOperation(gitDir: string): GitPendingOperation | null {
  if (existsSync(join(gitDir, 'rebase-merge')) || existsSync(join(gitDir, 'rebase-apply'))) {
    return 'rebase';
  }
  if (existsSync(join(gitDir, 'MERGE_HEAD'))) return 'merge';
  if (existsSync(join(gitDir, 'CHERRY_PICK_HEAD'))) return 'cherry-pick';
  if (existsSync(join(gitDir, 'REVERT_HEAD'))) return 'revert';
  return null;
}

/**
 * One read of everything the changes panel shows. Four git calls in parallel: status with
 * branch info, line counts for each side, and the remote list.
 */
export async function readWorkspaceGitState(cwd: string): Promise<WorkspaceGitState> {
  const repo = await locateRepo(cwd);
  if (!repo) return EMPTY_WORKSPACE_GIT_STATE;
  const { root } = repo;
  const [status, unstagedStat, stagedStat, remotes] = await Promise.all([
    // --no-optional-locks keeps the read from rewriting the index, which the watcher would
    // otherwise see as a change and answer with another read.
    gitOrNull(root, [
      '--no-optional-locks',
      'status',
      '--porcelain=v2',
      '-z',
      '--branch',
      '--untracked-files=all',
    ]),
    gitOrNull(root, ['--no-optional-locks', 'diff', '--numstat', '-z']),
    gitOrNull(root, ['--no-optional-locks', 'diff', '--cached', '--numstat', '-z']),
    gitOrNull(root, ['remote']),
  ]);
  const parsed = parseStatusV2(status ?? '');
  return {
    isRepo: true,
    branch: parsed.branch,
    detached: parsed.detached,
    head: parsed.oid ? parsed.oid.slice(0, 7) : null,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    hasRemote: (remotes ?? '').trim().length > 0,
    operation: pendingOperation(repo.gitDir),
    conflicts: parsed.conflicts,
    staged: withNumstat(parsed.staged, parseNumstatZ(stagedStat ?? '')),
    unstaged: withNumstat(parsed.unstaged, parseNumstatZ(unstagedStat ?? '')),
    untracked: parsed.untracked.slice(0, MAX_UNTRACKED),
    untrackedTruncated: parsed.untracked.length > MAX_UNTRACKED,
  };
}

/**
 * Checks paths that came from the renderer: repo-relative, no NUL, and inside the repository
 * once resolved. Returns them with forward slashes, the way git prints them.
 */
export function assertRepoPaths(root: string, paths: unknown): string[] {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS) {
    throw new Error('No files were given.');
  }
  return paths.map((path) => {
    if (typeof path !== 'string' || !path || path.includes('\0') || isAbsolute(path)) {
      throw new Error('That path is outside the repository.');
    }
    const inside = relative(root, resolve(root, path));
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) {
      throw new Error('That path is outside the repository.');
    }
    return inside.replaceAll('\\', '/');
  });
}

/** Runs a git command that takes its paths on stdin, so any number of them fits. */
async function withPathspecs(root: string, args: string[], paths: string[]): Promise<void> {
  await runGit(
    root,
    ['--literal-pathspecs', ...args, '--pathspec-from-file=-', '--pathspec-file-nul'],
    `${paths.join('\0')}\0`,
  );
}

async function hasHead(root: string): Promise<boolean> {
  return (await gitOrNull(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])) !== null;
}

export async function stagePaths(root: string, paths: string[]): Promise<void> {
  await withPathspecs(root, ['add', '-A'], paths);
}

export async function unstagePaths(root: string, paths: string[]): Promise<void> {
  if (await hasHead(root)) {
    await withPathspecs(root, ['restore', '--staged'], paths);
    return;
  }
  // Before the first commit there is nothing to restore to; unstaging means untracking.
  await withPathspecs(root, ['rm', '--cached', '-r', '--quiet'], paths);
}

interface DiscardBackup {
  root: string;
  expiresAt: number;
  /** Path to the exact bytes it had, or null when it did not exist (so undo deletes it again). */
  files: { path: string; blobId: string | null }[];
}

const discardBackups = new Map<string, DiscardBackup>();

function pruneBackups(now: number): void {
  for (const [token, backup] of discardBackups) {
    if (backup.expiresAt <= now) discardBackups.delete(token);
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

/** Stores a file's bytes as a loose object, exactly as they are on disk. */
async function backupBlob(root: string, path: string): Promise<string | null> {
  if (!(await isFile(join(root, path)))) return null;
  const id = (await runGit(root, ['hash-object', '-w', '--no-filters', '--', path]))
    .toString('utf8')
    .trim();
  return OBJECT_ID_PATTERN.test(id) ? id : null;
}

/**
 * Throws away working tree changes. Tracked files go back to their staged (or committed)
 * content; untracked files go to the system trash. Either way the bytes are kept as git
 * objects first, so the returned token can put them back.
 */
export async function discardPaths(
  root: string,
  paths: string[],
  side: 'unstaged' | 'untracked',
): Promise<GitDiscardResult> {
  const now = Date.now();
  pruneBackups(now);
  const files: DiscardBackup['files'] = [];
  for (const path of paths) files.push({ path, blobId: await backupBlob(root, path) });

  if (side === 'untracked') {
    for (const { path } of files) {
      const absolute = join(root, path);
      await shell.trashItem(absolute).catch(() => rm(absolute, { force: true }));
    }
  } else {
    await withPathspecs(root, ['restore', '--worktree'], paths);
  }

  const token = randomUUID();
  discardBackups.set(token, { root, files, expiresAt: now + UNDO_TTL_MS });
  const count = paths.length;
  return {
    ok: true,
    message: `Discarded changes in ${count} file${count === 1 ? '' : 's'}.`,
    undoToken: token,
  };
}

export async function undoDiscard(token: string): Promise<void> {
  pruneBackups(Date.now());
  const backup = discardBackups.get(token);
  if (!backup) throw new Error('That discard can no longer be undone.');
  discardBackups.delete(token);
  for (const { path, blobId } of backup.files) {
    const absolute = join(backup.root, path);
    if (!blobId) {
      await rm(absolute, { force: true });
      continue;
    }
    const content = await runGit(backup.root, ['cat-file', 'blob', blobId]);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
}

export async function resolveConflict(
  root: string,
  path: string,
  pick: 'ours' | 'theirs',
): Promise<void> {
  await runGit(root, ['--literal-pathspecs', 'checkout', `--${pick}`, '--', path]);
  await runGit(root, ['--literal-pathspecs', 'add', '--', path]);
}

export async function abortOperation(root: string, gitDir: string): Promise<string> {
  const operation = pendingOperation(gitDir);
  if (!operation) throw new Error('There is nothing to abort.');
  await runGit(root, [operation, '--abort']);
  return `Aborted the ${operation}.`;
}

export async function commitStaged(root: string, message: string): Promise<string> {
  const staged = (await gitOrNull(root, ['diff', '--cached', '--name-only'])) ?? '';
  if (!staged.trim()) throw new Error('Nothing is staged yet.');
  return (await runGit(root, ['commit', '-m', message])).toString('utf8');
}

/** One side of a diff from git's object store, converted the way a checkout would write it. */
async function readBlob(root: string, spec: string): Promise<Buffer | null> {
  try {
    return await runGit(root, ['cat-file', '--filters', spec]);
  } catch {
    try {
      return await runGit(root, ['cat-file', 'blob', spec]);
    } catch {
      return null;
    }
  }
}

async function readWorking(root: string, path: string): Promise<Buffer | null> {
  const absolute = join(root, path);
  if (!(await isFile(absolute))) return null;
  return readFile(absolute);
}

/**
 * Saves an edit made in the diff view. Only an existing regular file is written, the same
 * kind readWorking shows, so a symlink or a deleted file can't be turned into a new write.
 */
export async function writeWorkingFile(root: string, path: string, content: string): Promise<void> {
  const absolute = join(root, path);
  if (!(await isFile(absolute))) throw new Error(`${path} is no longer a file on disk.`);
  await writeFile(absolute, content, 'utf8');
}

function looksBinary(buffer: Buffer | null): boolean {
  if (!buffer) return false;
  return buffer.subarray(0, 8000).includes(0);
}

const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,64}$/i;

export function assertCommitHash(hash: unknown): string {
  if (typeof hash !== 'string' || !COMMIT_HASH_PATTERN.test(hash)) {
    throw new Error('That is not a commit id.');
  }
  return hash;
}

/** The files one commit touched, with line counts. A root commit is compared to nothing. */
export async function readCommitFiles(root: string, hash: string): Promise<GitChangeEntry[]> {
  const [names, stats] = await Promise.all([
    runGit(root, [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '-r',
      '-M',
      '--name-status',
      '-z',
      hash,
    ]),
    runGit(root, ['diff-tree', '--root', '--no-commit-id', '-r', '-M', '--numstat', '-z', hash]),
  ]);
  const fields = names.toString('utf8').split('\0');
  const entries: GitChangeEntry[] = [];
  for (let i = 0; i < fields.length; i += 1) {
    const code = fields[i];
    if (!code) continue;
    const letter = code[0] as GitChangeEntry['status'];
    if (letter === 'R' || letter === 'C') {
      const origPath = fields[i + 1] ?? '';
      const path = fields[i + 2] ?? '';
      i += 2;
      if (path) entries.push({ path, origPath, status: letter });
    } else {
      const path = fields[i + 1] ?? '';
      i += 1;
      if (path) entries.push({ path, status: 'MADT'.includes(letter) ? letter : 'M' });
    }
  }
  return withNumstat(entries, parseNumstatZ(stats.toString('utf8')));
}

/** One file as a commit changed it: its parent's version against the commit's. */
export async function readCommitFileDiff(
  root: string,
  hash: string,
  path: string,
  origPath?: string,
): Promise<GitFileDiff> {
  const original = await readBlob(root, `${hash}^:${origPath ?? path}`);
  const modified = await readBlob(root, `${hash}:${path}`);
  const tooLarge =
    (original?.length ?? 0) > MAX_DIFF_BYTES || (modified?.length ?? 0) > MAX_DIFF_BYTES;
  const binary = looksBinary(original) || looksBinary(modified);
  const text = (buffer: Buffer | null): string =>
    tooLarge || binary || !buffer ? '' : buffer.toString('utf8');
  return { path, original: text(original), modified: text(modified), binary, tooLarge };
}

export async function readFileDiff(
  root: string,
  path: string,
  side: GitDiffSide,
  origPath?: string,
): Promise<GitFileDiff> {
  let original: Buffer | null = null;
  let modified: Buffer | null = null;
  switch (side) {
    case 'staged':
      original = await readBlob(root, `HEAD:${origPath ?? path}`);
      modified = await readBlob(root, `:0:${path}`);
      break;
    case 'unstaged':
      original = (await readBlob(root, `:0:${path}`)) ?? (await readBlob(root, `HEAD:${path}`));
      modified = await readWorking(root, path);
      break;
    case 'untracked':
      modified = await readWorking(root, path);
      break;
    case 'conflict':
      original = await readBlob(root, `HEAD:${path}`);
      modified = await readWorking(root, path);
      break;
  }
  const tooLarge =
    (original?.length ?? 0) > MAX_DIFF_BYTES || (modified?.length ?? 0) > MAX_DIFF_BYTES;
  const binary = looksBinary(original) || looksBinary(modified);
  const text = (buffer: Buffer | null): string =>
    tooLarge || binary || !buffer ? '' : buffer.toString('utf8');
  return { path, original: text(original), modified: text(modified), binary, tooLarge };
}
