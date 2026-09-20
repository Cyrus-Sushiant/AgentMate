import { createHash } from 'node:crypto';
import { type FSWatcher, watch } from 'node:fs';
import { type WebContents } from 'electron';
import type { WorkspaceGitState } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { broadcastToWindows, sendToContents } from '../ipc/send';
import { isTracked } from './repoWatcher';
import { locateRepo, readWorkspaceGitState } from './workspaceGit';

/**
 * Keeps the workspace's changes panel live. Agents write files constantly, so this watches
 * the whole working tree (not just `.git`, which is all the Git tab's watcher needs), skips
 * the folders that churn without mattering, and only tells the renderer when the status
 * actually came out different.
 */

/** Quiet period before a burst of writes counts as settled. */
const DEBOUNCE_MS = 300;
/** A tool that writes nonstop still gets the panel refreshed this often. */
const MAX_WAIT_MS = 1500;
/** Where recursive watching is unreliable or too costly, status is polled instead. */
const POLL_MS = 3000;
const RETRY_WATCH_MS = 10_000;

/** Build output, dependencies and caches: busy, huge and almost always gitignored. */
const IGNORED_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'coverage',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  '.gradle',
  '.idea',
  '.vs',
]);

interface TreeWatch {
  projectId: string;
  folderPath: string;
  subscribers: Set<WebContents>;
  watcher: FSWatcher | null;
  poller: NodeJS.Timeout | null;
  retry: NodeJS.Timeout | null;
  debounce: NodeJS.Timeout | null;
  firstEventAt: number | null;
  reading: boolean;
  rerun: boolean;
  lastHash: string | null;
  lastState: WorkspaceGitState | null;
}

const watches = new Map<string, TreeWatch>();
const trackedSenders = new WeakSet<WebContents>();

function isRelevant(file: string | null): boolean {
  // Some platforms report no filename. Refreshing is cheaper than missing a change.
  if (!file) return true;
  const relative = file.replaceAll('\\', '/');
  const segments = relative.split('/');
  if (segments[0] === '.git') return isTracked(segments.slice(1).join('/'));
  return !segments.some((segment) => IGNORED_SEGMENTS.has(segment));
}

function send(entry: TreeWatch, state: WorkspaceGitState): void {
  for (const sender of entry.subscribers) {
    sendToContents(sender, IPC.git.onWorkspaceState, entry.projectId, state);
  }
}

async function readAndPublish(entry: TreeWatch, force = false): Promise<void> {
  if (entry.reading) {
    entry.rerun = true;
    return;
  }
  entry.reading = true;
  try {
    const state = await readWorkspaceGitState(entry.folderPath);
    const hash = createHash('sha1').update(JSON.stringify(state)).digest('hex');
    if (force || hash !== entry.lastHash) {
      entry.lastHash = hash;
      entry.lastState = state;
      if (watches.get(entry.projectId) === entry) send(entry, state);
    }
  } catch {
    // A read that fails mid-rebase or while the drive sleeps is retried on the next event.
  } finally {
    entry.reading = false;
    if (entry.rerun) {
      entry.rerun = false;
      void readAndPublish(entry);
    }
  }
}

function schedule(entry: TreeWatch): void {
  const now = Date.now();
  entry.firstEventAt ??= now;
  if (entry.debounce) clearTimeout(entry.debounce);
  const waited = now - entry.firstEventAt;
  const delay = waited >= MAX_WAIT_MS ? 0 : Math.min(DEBOUNCE_MS, MAX_WAIT_MS - waited);
  entry.debounce = setTimeout(() => {
    entry.debounce = null;
    entry.firstEventAt = null;
    void readAndPublish(entry);
  }, delay);
}

function startPolling(entry: TreeWatch): void {
  if (entry.poller) return;
  entry.poller = setInterval(() => void readAndPublish(entry), POLL_MS);
}

function stopTimers(entry: TreeWatch): void {
  for (const timer of [entry.debounce, entry.retry]) if (timer) clearTimeout(timer);
  if (entry.poller) clearInterval(entry.poller);
  entry.debounce = null;
  entry.retry = null;
  entry.poller = null;
}

async function startWatching(entry: TreeWatch): Promise<void> {
  // Linux adds an inotify watch per directory for a recursive watch, ignored ones included,
  // which can exhaust the system limit on a big repo. Polling is the safer default there.
  if (process.platform === 'linux') {
    startPolling(entry);
    return;
  }
  const repo = await locateRepo(entry.folderPath);
  if (watches.get(entry.projectId) !== entry) return;
  try {
    entry.watcher = watch(repo?.root ?? entry.folderPath, { recursive: true }, (_event, file) => {
      if (isRelevant(file)) schedule(entry);
    });
    entry.watcher.on('error', () => {
      // Windows reports an overflow when thousands of files change at once (an install).
      // Fall back to polling for a while, then try watching again.
      entry.watcher?.close();
      entry.watcher = null;
      startPolling(entry);
      entry.retry ??= setTimeout(() => {
        entry.retry = null;
        if (watches.get(entry.projectId) !== entry) return;
        if (entry.poller) clearInterval(entry.poller);
        entry.poller = null;
        void startWatching(entry);
      }, RETRY_WATCH_MS);
    });
  } catch {
    startPolling(entry);
  }
}

function closeWatch(projectId: string): void {
  const entry = watches.get(projectId);
  if (!entry) return;
  stopTimers(entry);
  entry.watcher?.close();
  watches.delete(projectId);
}

function trackSender(sender: WebContents): void {
  if (trackedSenders.has(sender)) return;
  trackedSenders.add(sender);
  sender.once('destroyed', () => {
    for (const projectId of [...watches.keys()]) unwatchWorkingTree(projectId, sender);
  });
}

export function watchWorkingTree(projectId: string, folderPath: string, sender: WebContents): void {
  trackSender(sender);
  const existing = watches.get(projectId);
  if (existing) {
    existing.subscribers.add(sender);
    // A second window joining gets the current state straight away.
    if (existing.lastState) {
      sendToContents(sender, IPC.git.onWorkspaceState, projectId, existing.lastState);
    }
    return;
  }
  const entry: TreeWatch = {
    projectId,
    folderPath,
    subscribers: new Set([sender]),
    watcher: null,
    poller: null,
    retry: null,
    debounce: null,
    firstEventAt: null,
    reading: false,
    rerun: false,
    lastHash: null,
    lastState: null,
  };
  watches.set(projectId, entry);
  void startWatching(entry);
  void readAndPublish(entry, true);
}

export function unwatchWorkingTree(projectId: string, sender: WebContents): void {
  const entry = watches.get(projectId);
  if (!entry) return;
  entry.subscribers.delete(sender);
  if (entry.subscribers.size === 0) closeWatch(projectId);
}

/**
 * Re-reads and pushes a project's state now, after the app itself changed the repo, so the
 * panel does not wait for the file events to arrive. Also reaches windows that are not
 * watching, since they may still show the state in a cache.
 */
export async function refreshWorkspaceState(projectId: string, folderPath: string): Promise<void> {
  const entry = watches.get(projectId);
  if (entry) {
    await readAndPublish(entry, true);
    return;
  }
  const state = await readWorkspaceGitState(folderPath).catch(() => null);
  if (!state) return;
  broadcastToWindows(IPC.git.onWorkspaceState, projectId, state);
}
