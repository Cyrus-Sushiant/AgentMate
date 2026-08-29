import { type FSWatcher, watch } from 'node:fs';
import { join } from 'node:path';
import { BrowserWindow, type WebContents } from 'electron';
import { IPC } from '../../shared/ipcChannels';

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
function isTracked(file: string | null): boolean {
  // Some platforms hand back no filename. Refreshing is cheaper than missing a commit.
  if (!file) return true;
  const relative = file.replaceAll('\\', '/');
  if (relative.endsWith('.lock')) return false;
  if (relative.startsWith('refs/')) return true;
  return TRACKED_FILES.has(relative);
}

function broadcast(projectId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(IPC.git.onRepoChanged, projectId);
  }
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

  let watcher: FSWatcher;
  try {
    watcher = watch(join(folderPath, '.git'), { recursive: true }, (_event, file) => {
      const entry = watches.get(projectId);
      if (!entry || !isTracked(file)) return;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        entry.timer = null;
        broadcast(projectId);
      }, DEBOUNCE_MS);
    });
  } catch {
    // Not a repo yet, a worktree whose `.git` is a file, or a drive that went away.
    // The tab still refreshes on focus and after its own git commands.
    return;
  }

  watcher.on('error', () => closeWatch(projectId));
  watches.set(projectId, { watcher, subscribers: new Set([sender]), timer: null });
}

export function unwatchProjectRepo(projectId: string, sender: WebContents): void {
  const entry = watches.get(projectId);
  if (!entry) return;
  entry.subscribers.delete(sender);
  if (entry.subscribers.size === 0) closeWatch(projectId);
}
