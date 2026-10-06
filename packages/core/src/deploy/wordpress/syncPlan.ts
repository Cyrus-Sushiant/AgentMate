import type { WpItemRef } from './protocol.js';

/**
 * Three-way comparison between this computer, the last sync (the base) and the site, for one
 * WordPress project (E19). Pure: the walker and the manifest reader hand it file maps that are
 * already filtered (hard deny, ignore rules), and it decides what each path needs.
 *
 * For each path in the union of local, base and remote, a side "changed" when it differs from the
 * base: `added` (not in base), `modified` (hash differs), `deleted` (in base, gone on that side).
 *
 * Deploy (local changes go to the site):
 * - local unchanged: `none`.
 * - local added or modified: `upload` when the site is unchanged, or already holds the same
 *   bytes (then `none`); `conflict` when the site changed it differently.
 * - local deleted: `deleteRemote` when the site is unchanged; `none` when the site deleted it
 *   too; `conflict` when the site changed it. Never delete a file the base never listed.
 * - `expectedRemote` is what the site should hold now: the base hash, or null for a new file. For
 *   a conflict it is the hash the site was seen holding, so a forced deploy still stops if the
 *   file changes yet again.
 * - When `remote` is null (not read, or the item is new on the site), the site counts as the base.
 *
 * Pull (site changes come here) mirrors it: `download`, `deleteLocal`, `none` or `conflict`,
 * judged against whether the local copy still matches the base. A null `remote` means nothing
 * was read, so nothing is pulled for that item.
 *
 * `size` and the byte totals count what a plan's own actions move: uploads for a deploy,
 * downloads for a pull. A conflict carries the size it would move if it were resolved that way.
 *
 * Byte comparison only: line endings are never normalized.
 */

export type WpFileMap = Record<string, { sha256: string; size: number }>;

export interface WpItemSnapshot {
  item: WpItemRef;
  isFile: boolean;
  local: WpFileMap;
  base: WpFileMap;
  remote: WpFileMap | null;
}

export type WpChange = 'added' | 'modified' | 'deleted';

export type WpPlannedAction =
  | 'upload'
  | 'deleteRemote'
  | 'download'
  | 'deleteLocal'
  | 'conflict'
  | 'none';

export interface WpPlannedChange {
  item: WpItemRef;
  path: string;
  local: WpChange | null;
  remote: WpChange | null;
  action: WpPlannedAction;
  /** Deploy: the hash the site should hold now (null = must not exist). Pull: unused (null). */
  expectedRemote: string | null;
  /** Bytes that will travel for this path (0 for deletes and `none`). */
  size: number;
}

export interface WpSyncPlan {
  direction: 'deploy' | 'pull';
  /** Every path whose action is not `none`, conflicts included, sorted by item then path. */
  changes: WpPlannedChange[];
  conflicts: WpPlannedChange[];
  uploadBytes: number;
  downloadBytes: number;
}

type Entry = { sha256: string; size: number } | undefined;

/** How one side differs from the base. */
function changeOf(base: Entry, side: Entry): WpChange | null {
  if (!base) return side ? 'added' : null;
  if (!side) return 'deleted';
  return side.sha256 === base.sha256 ? null : 'modified';
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function itemSortKey(item: WpItemRef): string {
  return `${item.kind}:${item.slug}`;
}

interface PathState {
  item: WpItemRef;
  path: string;
  base: Entry;
  local: Entry;
  remote: Entry;
  localChange: WpChange | null;
  remoteChange: WpChange | null;
}

function* pathsOf(items: readonly WpItemSnapshot[]): Generator<PathState> {
  const sorted = [...items].sort((a, b) => compare(itemSortKey(a.item), itemSortKey(b.item)));
  for (const snapshot of sorted) {
    const remote = snapshot.remote ?? snapshot.base;
    const paths = new Set([
      ...Object.keys(snapshot.local),
      ...Object.keys(snapshot.base),
      ...Object.keys(remote),
    ]);
    for (const path of [...paths].sort(compare)) {
      const base = snapshot.base[path];
      const local = snapshot.local[path];
      const there = remote[path];
      yield {
        item: snapshot.item,
        path,
        base,
        local,
        remote: there,
        localChange: changeOf(base, local),
        remoteChange: changeOf(base, there),
      };
    }
  }
}

function finish(direction: 'deploy' | 'pull', changes: WpPlannedChange[]): WpSyncPlan {
  let uploadBytes = 0;
  let downloadBytes = 0;
  for (const change of changes) {
    if (change.action === 'upload') uploadBytes += change.size;
    if (change.action === 'download') downloadBytes += change.size;
  }
  return {
    direction,
    changes,
    conflicts: changes.filter((change) => change.action === 'conflict'),
    uploadBytes,
    downloadBytes,
  };
}

export function planWpDeploy(items: readonly WpItemSnapshot[]): WpSyncPlan {
  const changes: WpPlannedChange[] = [];
  for (const state of pathsOf(items)) {
    const { localChange, remoteChange, local, remote, base } = state;
    if (localChange === null) continue;
    let action: WpPlannedAction;
    let expectedRemote: string | null = base?.sha256 ?? null;
    if (localChange === 'deleted') {
      if (remoteChange === null) action = 'deleteRemote';
      else if (remoteChange === 'deleted') action = 'none';
      else {
        action = 'conflict';
        expectedRemote = remote?.sha256 ?? null;
      }
    } else if (remoteChange === null) {
      action = 'upload';
    } else if (remote && local && remote.sha256 === local.sha256) {
      action = 'none';
    } else {
      action = 'conflict';
      expectedRemote = remote?.sha256 ?? null;
    }
    if (action === 'none') continue;
    changes.push({
      item: state.item,
      path: state.path,
      local: localChange,
      remote: remoteChange,
      action,
      expectedRemote,
      size: action === 'deleteRemote' ? 0 : (local?.size ?? 0),
    });
  }
  return finish('deploy', changes);
}

export function planWpPull(items: readonly WpItemSnapshot[]): WpSyncPlan {
  const changes: WpPlannedChange[] = [];
  for (const state of pathsOf(items.filter((snapshot) => snapshot.remote !== null))) {
    const { localChange, remoteChange, local, remote } = state;
    if (remoteChange === null) continue;
    let action: WpPlannedAction;
    if (remoteChange === 'deleted') {
      if (localChange === null) action = 'deleteLocal';
      else if (localChange === 'deleted') action = 'none';
      else action = 'conflict';
    } else if (localChange === null) {
      action = 'download';
    } else if (local && remote && local.sha256 === remote.sha256) {
      action = 'none';
    } else {
      action = 'conflict';
    }
    if (action === 'none') continue;
    changes.push({
      item: state.item,
      path: state.path,
      local: localChange,
      remote: remoteChange,
      action,
      expectedRemote: null,
      size: action === 'deleteLocal' ? 0 : (remote?.size ?? 0),
    });
  }
  return finish('pull', changes);
}
