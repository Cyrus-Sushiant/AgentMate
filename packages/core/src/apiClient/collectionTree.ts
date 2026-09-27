import type {
  ApiTreeNode,
  PostmanCollection,
  PostmanFolder,
  PostmanItem,
  PostmanRequestItem,
} from './types.js';

/**
 * Tree operations on a collection. They never change the collection they are given: each one
 * returns a new collection, so main can apply them to what it loaded from disk and the renderer
 * can apply the same ones optimistically.
 */

export function isFolder(item: PostmanItem): item is PostmanFolder {
  return Array.isArray((item as PostmanFolder).item);
}

export function isRequestItem(item: PostmanItem): item is PostmanRequestItem {
  return !isFolder(item);
}

export function walkItems(
  items: readonly PostmanItem[],
  visit: (item: PostmanItem, depth: number) => void,
  depth = 0,
): void {
  for (const item of items) {
    visit(item, depth);
    if (isFolder(item)) walkItems(item.item, visit, depth + 1);
  }
}

export function findItem(collection: PostmanCollection, id: string): PostmanItem | null {
  let found: PostmanItem | null = null;
  walkItems(collection.item, (item) => {
    if (!found && item.id === id) found = item;
  });
  return found;
}

/** The id of the folder holding `id`, null when it is at the top level, undefined when absent. */
export function findParentId(collection: PostmanCollection, id: string): string | null | undefined {
  if (collection.item.some((item) => item.id === id)) return null;
  let parent: string | undefined;
  walkItems(collection.item, (item) => {
    if (parent === undefined && isFolder(item) && item.item.some((child) => child.id === id)) {
      parent = item.id;
    }
  });
  return parent;
}

/** Rebuilds the item list with `change` applied to the list that holds `targetId`'s children. */
function mapChildren(
  items: readonly PostmanItem[],
  parentId: string,
  change: (children: PostmanItem[]) => PostmanItem[],
): { items: PostmanItem[]; found: boolean } {
  let found = false;
  const next = items.map((item) => {
    if (!isFolder(item)) return item;
    if (item.id === parentId) {
      found = true;
      return { ...item, item: change([...item.item]) };
    }
    const inner = mapChildren(item.item, parentId, change);
    if (!inner.found) return item;
    found = true;
    return { ...item, item: inner.items };
  });
  return { items: next, found };
}

/** Adds `item` under the folder `parentId` (null for the top level), at `index` or at the end. */
export function insertItem(
  collection: PostmanCollection,
  parentId: string | null,
  item: PostmanItem,
  index?: number,
): PostmanCollection {
  const place = (children: PostmanItem[]): PostmanItem[] => {
    const at =
      index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
    children.splice(at, 0, item);
    return children;
  };
  if (parentId === null) return { ...collection, item: place([...collection.item]) };

  const { items, found } = mapChildren(collection.item, parentId, place);
  if (!found) throw new Error('That folder no longer exists.');
  return { ...collection, item: items };
}

function mapItem(
  items: readonly PostmanItem[],
  id: string,
  change: (item: PostmanItem) => PostmanItem | null,
): { items: PostmanItem[]; found: boolean } {
  let found = false;
  const next: PostmanItem[] = [];
  for (const item of items) {
    if (item.id === id) {
      found = true;
      const replaced = change(item);
      if (replaced) next.push(replaced);
      continue;
    }
    if (isFolder(item) && !found) {
      const inner = mapItem(item.item, id, change);
      if (inner.found) {
        found = true;
        next.push({ ...item, item: inner.items });
        continue;
      }
    }
    next.push(item);
  }
  return { items: next, found };
}

export function updateItem(
  collection: PostmanCollection,
  id: string,
  change: (item: PostmanItem) => PostmanItem,
): PostmanCollection {
  const { items, found } = mapItem(collection.item, id, change);
  if (!found) throw new Error('That request no longer exists.');
  return { ...collection, item: items };
}

/** Removes an item and anything under it. An id that is not there leaves the collection as is. */
export function removeItem(collection: PostmanCollection, id: string): PostmanCollection {
  const { items, found } = mapItem(collection.item, id, () => null);
  return found ? { ...collection, item: items } : collection;
}

function outlineItems(items: readonly PostmanItem[]): ApiTreeNode[] {
  return items.map((item) =>
    isFolder(item)
      ? { id: item.id, name: item.name, kind: 'folder', children: outlineItems(item.item) }
      : {
          id: item.id,
          name: item.name,
          kind: 'request',
          method: (item.request.method ?? 'GET').toUpperCase(),
        },
  );
}

/** What the sidebar needs to draw a collection: names, kinds and methods only. */
export function outline(collection: PostmanCollection): ApiTreeNode[] {
  return outlineItems(collection.item);
}
