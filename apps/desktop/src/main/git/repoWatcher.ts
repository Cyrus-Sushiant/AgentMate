import { type FSWatcher, readFileSync, statSync, watch } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { type WebContents } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { broadcastToWindows } from '../ipc/send';

/**
 * Commits, merges and rebases write a burst of files, so collapse the burst into one
 * refresh. Short enough that the Git tab still feels instant.
 */
const DEBOUNCE_MS = 300;

/** The files git rewrites when the repo actually moves: commit, checkout, merge, fetch, stage. */
const TRACKED_FILES = new Set([
  'HEAD',
  'ORIG_HEAD',
  'MERGE_HEAD',
  'FETCH_HEAD',
  'index',
  'packed-refs',
]);

interface RepoWatch {
  watcher: FSWatcher;
  /** For a worktree, where its own files sit inside the shared `.git` (see gitWatchTarget). */
  prefix: string;
  /** The renderers that asked for this repo. The watcher closes when the last one leaves. */
  subscribers: Set<WebContents>;
  timer: NodeJS.Timeout | null;
}

const watches = new Map<string, RepoWatch>();
/** Renderers we already hooked a 'destroyed' cleanup onto, so a reload does not leak a watcher. */
const trackedSenders = new WeakSet<WebContents>();

/**
 * `.git` also holds objects, logs and lock files, which change far more often than the
 * status the UI shows. Ignoring them keeps a busy repo from triggering a refresh per write.
 */
export function isTracked(file: string | null, prefix = ''): boolean {
  // Some platforms hand back no filename. Refreshing is cheaper than missing a commit.
  if (!file) return true;
  const path = file.replaceAll('\\', '/');
  if (path.endsWith('.lock')) return false;
  // Branches and the fetch result are shared by every worktree of the repository.
  if (path.startsWith('refs/') || path === 'packed-refs' || path === 'FETCH_HEAD') return true;
  if (!prefix) return TRACKED_FILES.has(path);
  return path.startsWith(prefix) && TRACKED_FILES.has(path.slice(prefix.length));
}

export interface GitWatchTarget {
  /** The `.git` folder to watch. */
  root: string;
  /** Empty for a normal checkout; `worktrees/<name>/` for a linked worktree. */
  prefix: string;
}

/**
 * Where a checkout's git files live. A linked worktree's `.git` is a file pointing at
 * `<repo>/.git/worktrees/<name>`, which holds its own HEAD and index, while its branches live in
 * the shared `.git`. Watching the shared folder with that prefix sees both. Read straight from
 * disk rather than asking git, since this runs every time a Git tab opens.
 */
export function gitWatchTarget(folderPath: string): GitWatchTarget | null {
  const dotGit = join(folderPath, '.git');
  try {
    if (statSync(dotGit).isDirectory()) return { root: dotGit, prefix: '' };
    const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]?.trim();
    if (!pointer) return null;
    const gitDir = resolve(folderPath, pointer);
    const commonDir = resolve(gitDir, readFileSync(join(gitDir, 'commondir'), 'utf8').trim());
    const prefix = relative(commonDir, gitDir).replaceAll('\\', '/');
    if (!prefix || prefix.startsWith('..')) return null;
    return { root: commonDir, prefix: `${prefix}/` };
  } catch {
    return null;
  }
}

function broadcast(projectId: string): void {
  broadcastToWindows(IPC.git.onRepoChanged, projectId);
}

function closeWatch(projectId: string): void {
  const entry = watches.get(projectId);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  entry.watcher.close();
  watches.delete(projectId);
}

function trackSender(sender: WebContents): void {
  if (trackedSenders.has(sender)) return;
  trackedSenders.add(sender);
  // A window that closes or reloads never gets to send its unwatch calls.
  sender.once('destroyed', () => {
    for (const projectId of [...watches.keys()]) unwatchProjectRepo(projectId, sender);
  });
}

/**
 * Watches a project's `.git` folder so work done outside the app (a commit from an editor,
 * a pull from the terminal) shows up in the Git tab without the user reopening it.
 */
export function watchProjectRepo(projectId: string, folderPath: string, sender: WebContents): void {
  trackSender(sender);

  const existing = watches.get(projectId);
  if (existing) {
    existing.subscribers.add(sender);
    return;
  }

  // Not a repo yet, or a drive that went away. The tab still refreshes on focus and after its
  // own git commands.
  const target = gitWatchTarget(folderPath);
  if (!target) return;
  let watcher: FSWatcher;
  try {
    watcher = watch(target.root, { recursive: true }, (_event, file) => {
      const entry = watches.get(projectId);
      if (!entry || !isTracked(file, entry.prefix)) return;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        entry.timer = null;
        broadcast(projectId);
      }, DEBOUNCE_MS);
    });
  } catch {
    return;
  }

  watcher.on('error', () => closeWatch(projectId));
  watches.set(projectId, {
    watcher,
    prefix: target.prefix,
    subscribers: new Set([sender]),
    timer: null,
  });
}

export function unwatchProjectRepo(projectId: string, sender: WebContents): void {
  const entry = watches.get(projectId);
  if (!entry) return;
  entry.subscribers.delete(sender);
  if (entry.subscribers.size === 0) closeWatch(projectId);
}
