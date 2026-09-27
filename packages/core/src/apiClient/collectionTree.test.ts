import { describe, expect, it } from 'vitest';
import {
  findItem,
  findParentId,
  insertItem,
  isFolder,
  outline,
  removeItem,
  updateItem,
  walkItems,
} from './collectionTree.js';
import type { PostmanCollection, PostmanFolder, PostmanRequestItem } from './types.js';
import { POSTMAN_SCHEMA_V21 } from './types.js';

const request = (id: string, method = 'GET'): PostmanRequestItem => ({
  id,
  name: `Request ${id}`,
  request: { method, url: `https://a.test/${id}` },
});

const folder = (id: string, item: PostmanFolder['item'] = []): PostmanFolder => ({
  id,
  name: `Folder ${id}`,
  item,
});

function sample(): PostmanCollection {
  return {
    info: { name: 'Sample', schema: POSTMAN_SCHEMA_V21 },
    item: [request('a'), folder('f1', [request('b', 'post'), folder('f2', [request('c')])])],
  };
}

describe('findItem and findParentId', () => {
  it('finds items at any depth', () => {
    const collection = sample();
    expect(findItem(collection, 'a')?.name).toBe('Request a');
    expect(findItem(collection, 'c')?.name).toBe('Request c');
    expect(findItem(collection, 'nope')).toBeNull();
  });

  it('reports the folder an item sits in, or null for the top level', () => {
    const collection = sample();
    expect(findParentId(collection, 'c')).toBe('f2');
    expect(findParentId(collection, 'a')).toBeNull();
    expect(findParentId(collection, 'nope')).toBeUndefined();
  });
});

describe('insertItem', () => {
  it('appends to the top level or to a folder', () => {
    const top = insertItem(sample(), null, request('d'));
    expect(top.item.at(-1)?.id).toBe('d');

    const nested = insertItem(sample(), 'f2', request('d'));
    const f2 = findItem(nested, 'f2');
    expect(f2 && isFolder(f2) && f2.item.map((i) => i.id)).toEqual(['c', 'd']);
  });

  it('puts the item at a given position', () => {
    const next = insertItem(sample(), null, request('d'), 0);
    expect(next.item.map((i) => i.id)).toEqual(['d', 'a', 'f1']);
  });

  it('refuses a parent that is missing or is a request', () => {
    expect(() => insertItem(sample(), 'nope', request('d'))).toThrow(/folder/i);
    expect(() => insertItem(sample(), 'a', request('d'))).toThrow(/folder/i);
  });

  it('leaves the original collection untouched', () => {
    const original = sample();
    insertItem(original, 'f1', request('d'));
    const f1 = findItem(original, 'f1');
    expect(f1 && isFolder(f1) && f1.item).toHaveLength(2);
  });
});

describe('updateItem', () => {
  it('replaces an item with what the updater returns', () => {
    const next = updateItem(sample(), 'b', (item) => ({ ...item, name: 'Renamed' }));
    expect(findItem(next, 'b')?.name).toBe('Renamed');
  });

  it('throws when the item is gone', () => {
    expect(() => updateItem(sample(), 'nope', (i) => i)).toThrow(/no longer exists/);
  });
});

describe('removeItem', () => {
  it('removes an item and everything under it', () => {
    const next = removeItem(sample(), 'f2');
    expect(findItem(next, 'f2')).toBeNull();
    expect(findItem(next, 'c')).toBeNull();
    expect(findItem(next, 'b')).not.toBeNull();
  });

  it('does nothing for an id that is not there', () => {
    const original = sample();
    expect(removeItem(original, 'nope')).toEqual(original);
  });
});

describe('walkItems and outline', () => {
  it('visits every item depth first with its depth', () => {
    const seen: string[] = [];
    walkItems(sample().item, (item, depth) => seen.push(`${item.id}:${depth}`));
    expect(seen).toEqual(['a:0', 'f1:0', 'b:1', 'f2:1', 'c:2']);
  });

  it('draws the sidebar tree with upper-case methods and no request details', () => {
    expect(outline(sample())).toEqual([
      { id: 'a', name: 'Request a', kind: 'request', method: 'GET' },
      {
        id: 'f1',
        name: 'Folder f1',
        kind: 'folder',
        children: [
          { id: 'b', name: 'Request b', kind: 'request', method: 'POST' },
          {
            id: 'f2',
            name: 'Folder f2',
            kind: 'folder',
            children: [{ id: 'c', name: 'Request c', kind: 'request', method: 'GET' }],
          },
        ],
      },
    ]);
  });
});
