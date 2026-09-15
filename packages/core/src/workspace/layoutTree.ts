/**
 * The split layout of a workspace: a binary tree whose leaves are tab groups. Every
 * operation here is pure and returns a new tree, so the store can persist it as plain
 * JSON and the renderer can diff it cheaply.
 */

export type SplitDirection = 'row' | 'column';

export interface PaneGroupNode {
  type: 'group';
  id: string;
  tabIds: string[];
  activeTabId: string | null;
}

export interface PaneSplitNode {
  type: 'split';
  id: string;
  /** `row` puts `a` left of `b`, `column` puts `a` above `b`. */
  direction: SplitDirection;
  /** The share of the space `a` gets, between {@link MIN_SPLIT_RATIO} and {@link MAX_SPLIT_RATIO}. */
  ratio: number;
  a: PaneNode;
  b: PaneNode;
}

export type PaneNode = PaneGroupNode | PaneSplitNode;

export type PaneDirection = 'left' | 'right' | 'up' | 'down';

export interface PaneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_SPLIT_RATIO = 0.1;
export const MAX_SPLIT_RATIO = 0.9;

export function createGroup(
  id: string,
  tabIds: string[] = [],
  activeTabId?: string,
): PaneGroupNode {
  return {
    type: 'group',
    id,
    tabIds: [...tabIds],
    activeTabId: activeTabId ?? tabIds.at(-1) ?? null,
  };
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

/** Groups in reading order: left to right, top to bottom. */
export function allGroups(root: PaneNode): PaneGroupNode[] {
  if (root.type === 'group') return [root];
  return [...allGroups(root.a), ...allGroups(root.b)];
}

export function allTabIds(root: PaneNode): string[] {
  return allGroups(root).flatMap((group) => group.tabIds);
}

export function firstGroup(root: PaneNode): PaneGroupNode {
  return root.type === 'group' ? root : firstGroup(root.a);
}

export function findGroup(root: PaneNode, groupId: string): PaneGroupNode | null {
  return allGroups(root).find((group) => group.id === groupId) ?? null;
}

export function findGroupOfTab(root: PaneNode, tabId: string): PaneGroupNode | null {
  return allGroups(root).find((group) => group.tabIds.includes(tabId)) ?? null;
}

function mapGroups(root: PaneNode, fn: (group: PaneGroupNode) => PaneGroupNode): PaneNode {
  if (root.type === 'group') return fn(root);
  const a = mapGroups(root.a, fn);
  const b = mapGroups(root.b, fn);
  return a === root.a && b === root.b ? root : { ...root, a, b };
}

function replaceNode(root: PaneNode, id: string, next: PaneNode): PaneNode {
  if (root.id === id) return next;
  if (root.type === 'group') return root;
  const a = replaceNode(root.a, id, next);
  const b = replaceNode(root.b, id, next);
  return a === root.a && b === root.b ? root : { ...root, a, b };
}

/** Drops a group and lets its sibling take over the parent split's space. */
function removeGroupNode(root: PaneNode, groupId: string): PaneNode | null {
  if (root.type === 'group') return root.id === groupId ? null : root;
  const a = removeGroupNode(root.a, groupId);
  const b = removeGroupNode(root.b, groupId);
  if (!a) return b;
  if (!b) return a;
  return a === root.a && b === root.b ? root : { ...root, a, b };
}

export function addTab(root: PaneNode, groupId: string, tabId: string, index?: number): PaneNode {
  return mapGroups(root, (group) => {
    if (group.id !== groupId) return group;
    const tabIds = group.tabIds.filter((id) => id !== tabId);
    const at = index === undefined ? tabIds.length : Math.max(0, Math.min(index, tabIds.length));
    tabIds.splice(at, 0, tabId);
    return { ...group, tabIds, activeTabId: tabId };
  });
}

/** Makes a tab the visible one in whichever group holds it. */
export function activateTab(root: PaneNode, tabId: string): PaneNode {
  return mapGroups(root, (group) =>
    group.tabIds.includes(tabId) && group.activeTabId !== tabId
      ? { ...group, activeTabId: tabId }
      : group,
  );
}

/** The tab that takes over when `tabId` leaves: the one to its right, else the one to its left. */
function neighborTab(tabIds: string[], tabId: string): string | null {
  const index = tabIds.indexOf(tabId);
  const remaining = tabIds.filter((id) => id !== tabId);
  if (remaining.length === 0) return null;
  return remaining[Math.min(index, remaining.length - 1)] ?? null;
}

export interface RemoveTabResult {
  root: PaneNode;
  /** Set when the tab's group emptied and was removed from the tree. */
  removedGroupId: string | null;
}

/**
 * Removes a tab. A group left empty is removed too, unless it is the only group, since a
 * workspace always keeps one place for new tabs to land.
 */
export function removeTab(root: PaneNode, tabId: string): RemoveTabResult {
  const owner = findGroupOfTab(root, tabId);
  if (!owner) return { root, removedGroupId: null };
  if (owner.tabIds.length === 1 && root.type === 'split') {
    return { root: removeGroupNode(root, owner.id) ?? root, removedGroupId: owner.id };
  }
  const next = mapGroups(root, (group) => {
    if (group.id !== owner.id) return group;
    return {
      ...group,
      tabIds: group.tabIds.filter((id) => id !== tabId),
      activeTabId:
        group.activeTabId === tabId ? neighborTab(group.tabIds, tabId) : group.activeTabId,
    };
  });
  return { root: next, removedGroupId: null };
}

/** Removes a whole group, tabs and all. The last group of a workspace is never removed. */
export function removeGroup(root: PaneNode, groupId: string): PaneNode {
  if (root.type === 'group') return root;
  return removeGroupNode(root, groupId) ?? root;
}

/**
 * Splits a group in two. The new group goes after the existing one (right or below) unless
 * `side` is `before`.
 */
export function splitGroup(
  root: PaneNode,
  groupId: string,
  direction: SplitDirection,
  newGroup: PaneGroupNode,
  splitId: string,
  side: 'before' | 'after' = 'after',
): PaneNode {
  const target = findGroup(root, groupId);
  if (!target) return root;
  const split: PaneSplitNode = {
    type: 'split',
    id: splitId,
    direction,
    ratio: 0.5,
    a: side === 'after' ? target : newGroup,
    b: side === 'after' ? newGroup : target,
  };
  return replaceNode(root, groupId, split);
}

/**
 * Moves a tab into another group, at `index` or the end. Moving a group's last tab away
 * removes that group.
 */
export function moveTab(
  root: PaneNode,
  tabId: string,
  targetGroupId: string,
  index?: number,
): PaneNode {
  const source = findGroupOfTab(root, tabId);
  if (!source || !findGroup(root, targetGroupId)) return root;
  if (source.id === targetGroupId) {
    const without = source.tabIds.filter((id) => id !== tabId);
    const at = index === undefined ? without.length : Math.max(0, Math.min(index, without.length));
    without.splice(at, 0, tabId);
    return mapGroups(root, (group) =>
      group.id === source.id ? { ...group, tabIds: without, activeTabId: tabId } : group,
    );
  }
  const { root: removed } = removeTab(root, tabId);
  return addTab(removed, targetGroupId, tabId, index);
}

/** Swaps a tab's id in place, keeping its position and active state. Used to restart a session. */
export function replaceTabId(root: PaneNode, oldId: string, newId: string): PaneNode {
  return mapGroups(root, (group) =>
    group.tabIds.includes(oldId)
      ? {
          ...group,
          tabIds: group.tabIds.map((id) => (id === oldId ? newId : id)),
          activeTabId: group.activeTabId === oldId ? newId : group.activeTabId,
        }
      : group,
  );
}

export function setRatio(root: PaneNode, splitId: string, ratio: number): PaneNode {
  if (root.type === 'group') return root;
  if (root.id === splitId) return { ...root, ratio: clampRatio(ratio) };
  const a = setRatio(root.a, splitId, ratio);
  const b = setRatio(root.b, splitId, ratio);
  return a === root.a && b === root.b ? root : { ...root, a, b };
}

/**
 * Finds the group next to `groupId` in a direction, using the rectangles the groups were
 * last laid out at. Among groups that lie in that direction, the nearest center wins, with
 * distance along the other axis counted double so a pane straight across beats one that is
 * merely close.
 */
export function findNeighborGroup(
  rects: Record<string, PaneRect>,
  groupId: string,
  direction: PaneDirection,
): string | null {
  const from = rects[groupId];
  if (!from) return null;
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [id, rect] of Object.entries(rects)) {
    if (id === groupId) continue;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const inDirection =
      (direction === 'left' && rect.x + rect.width <= from.x + 1) ||
      (direction === 'right' && rect.x >= from.x + from.width - 1) ||
      (direction === 'up' && rect.y + rect.height <= from.y + 1) ||
      (direction === 'down' && rect.y >= from.y + from.height - 1);
    if (!inDirection) continue;
    const horizontal = direction === 'left' || direction === 'right';
    const along = horizontal ? Math.abs(cx - fx) : Math.abs(cy - fy);
    const across = horizontal ? Math.abs(cy - fy) : Math.abs(cx - fx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Repairs a tree read back from storage: unknown or duplicate tabs are dropped, empty groups
 * collapse, ratios are clamped and an active tab is picked where it went missing. Anything
 * unrecognisable becomes a single empty group with `fallbackGroupId`.
 */
export function normalizeLayout(
  value: unknown,
  validTabIds: ReadonlySet<string>,
  fallbackGroupId: string,
): PaneNode {
  const seen = new Set<string>();
  const walk = (node: unknown): PaneNode | null => {
    if (!isRecord(node) || typeof node.id !== 'string') return null;
    if (node.type === 'group') {
      const tabIds: string[] = [];
      for (const id of Array.isArray(node.tabIds) ? node.tabIds : []) {
        if (typeof id !== 'string' || !validTabIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        tabIds.push(id);
      }
      if (tabIds.length === 0) return null;
      const active =
        typeof node.activeTabId === 'string' && tabIds.includes(node.activeTabId)
          ? node.activeTabId
          : (tabIds.at(-1) ?? null);
      return { type: 'group', id: node.id, tabIds, activeTabId: active };
    }
    if (node.type === 'split') {
      const a = walk(node.a);
      const b = walk(node.b);
      if (!a) return b;
      if (!b) return a;
      return {
        type: 'split',
        id: node.id,
        direction: node.direction === 'column' ? 'column' : 'row',
        ratio: clampRatio(typeof node.ratio === 'number' ? node.ratio : 0.5),
        a,
        b,
      };
    }
    return null;
  };
  const root = walk(value);
  if (root) return root;
  // An empty group is still a valid workspace; keep its id so focus survives a reload.
  const keepId = isRecord(value) && value.type === 'group' && typeof value.id === 'string';
  return createGroup(keepId ? String(value.id) : fallbackGroupId);
}
