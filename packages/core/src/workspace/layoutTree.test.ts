import { describe, expect, it } from 'vitest';
import {
  addTab,
  allGroups,
  allTabIds,
  createGroup,
  findGroupOfTab,
  findNeighborGroup,
  moveTab,
  normalizeLayout,
  type PaneNode,
  removeGroup,
  removeTab,
  replaceTabId,
  setRatio,
  splitGroup,
} from './layoutTree.js';

function twoByOne(): PaneNode {
  const left = createGroup('g1', ['t1', 't2'], 't1');
  return splitGroup(left, 'g1', 'row', createGroup('g2', ['t3']), 's1');
}

describe('layoutTree', () => {
  it('adds a tab at an index and activates it', () => {
    const root = addTab(createGroup('g1', ['a', 'b']), 'g1', 'c', 1);
    expect(root).toMatchObject({ tabIds: ['a', 'c', 'b'], activeTabId: 'c' });
  });

  it('splits a group, putting the new group after it by default', () => {
    const root = twoByOne();
    expect(root.type).toBe('split');
    expect(allGroups(root).map((g) => g.id)).toEqual(['g1', 'g2']);

    const before = splitGroup(
      createGroup('g1', ['a']),
      'g1',
      'column',
      createGroup('g2'),
      's',
      'before',
    );
    expect(allGroups(before).map((g) => g.id)).toEqual(['g2', 'g1']);
  });

  it('activates the right-hand neighbour when the active tab closes', () => {
    const { root } = removeTab(createGroup('g1', ['a', 'b', 'c'], 'b'), 'b');
    expect(root).toMatchObject({ tabIds: ['a', 'c'], activeTabId: 'c' });
    const { root: last } = removeTab(createGroup('g1', ['a', 'b'], 'b'), 'b');
    expect(last).toMatchObject({ activeTabId: 'a' });
  });

  it('collapses the split when a group loses its last tab', () => {
    const { root, removedGroupId } = removeTab(twoByOne(), 't3');
    expect(removedGroupId).toBe('g2');
    expect(root).toMatchObject({ type: 'group', id: 'g1' });
  });

  it('keeps the only group even when it empties', () => {
    const { root, removedGroupId } = removeTab(createGroup('g1', ['a']), 'a');
    expect(removedGroupId).toBeNull();
    expect(root).toMatchObject({ type: 'group', tabIds: [], activeTabId: null });
  });

  it('collapses nested splits to the surviving sibling', () => {
    let root = twoByOne();
    root = splitGroup(root, 'g2', 'column', createGroup('g3', ['t4']), 's2');
    root = removeTab(root, 't3').root;
    expect(allGroups(root).map((g) => g.id)).toEqual(['g1', 'g3']);
    expect(root).toMatchObject({ type: 'split', id: 's1' });
  });

  it('moves a tab between groups and removes the emptied source', () => {
    const root = moveTab(twoByOne(), 't3', 'g1', 0);
    expect(root).toMatchObject({ type: 'group', id: 'g1', tabIds: ['t3', 't1', 't2'] });
  });

  it('reorders within a group', () => {
    const root = moveTab(createGroup('g1', ['a', 'b', 'c']), 'a', 'g1', 2);
    expect(root).toMatchObject({ tabIds: ['b', 'c', 'a'], activeTabId: 'a' });
  });

  it('removes a whole group but never the last one', () => {
    expect(removeGroup(twoByOne(), 'g1')).toMatchObject({ type: 'group', id: 'g2' });
    const single = createGroup('g1', ['a']);
    expect(removeGroup(single, 'g1')).toBe(single);
  });

  it('replaces a tab id in place', () => {
    const root = replaceTabId(twoByOne(), 't1', 'fresh');
    expect(allGroups(root)[0]).toMatchObject({ tabIds: ['fresh', 't2'], activeTabId: 'fresh' });
  });

  it('clamps split ratios', () => {
    const root = setRatio(twoByOne(), 's1', 1.4);
    expect(root).toMatchObject({ ratio: 0.9 });
  });

  it('finds tabs and neighbours', () => {
    const root = twoByOne();
    expect(findGroupOfTab(root, 't2')?.id).toBe('g1');
    const rects = {
      g1: { x: 0, y: 0, width: 500, height: 400 },
      g2: { x: 500, y: 0, width: 500, height: 200 },
      g3: { x: 500, y: 200, width: 500, height: 200 },
    };
    expect(findNeighborGroup(rects, 'g1', 'right')).toBe('g2');
    expect(findNeighborGroup(rects, 'g2', 'down')).toBe('g3');
    expect(findNeighborGroup(rects, 'g3', 'left')).toBe('g1');
    expect(findNeighborGroup(rects, 'g1', 'left')).toBeNull();
  });

  it('repairs stored layouts', () => {
    const stored = {
      type: 'split',
      id: 's1',
      direction: 'sideways',
      ratio: 7,
      a: { type: 'group', id: 'g1', tabIds: ['t1', 'gone', 't1'], activeTabId: 'gone' },
      b: {
        type: 'split',
        id: 's2',
        direction: 'column',
        ratio: 0.3,
        a: { type: 'group', id: 'g2', tabIds: ['gone'] },
        b: { type: 'group', id: 'g3', tabIds: ['t2'] },
      },
    };
    const root = normalizeLayout(stored, new Set(['t1', 't2']), 'fallback');
    expect(root).toEqual({
      type: 'split',
      id: 's1',
      direction: 'row',
      ratio: 0.9,
      a: { type: 'group', id: 'g1', tabIds: ['t1'], activeTabId: 't1' },
      b: { type: 'group', id: 'g3', tabIds: ['t2'], activeTabId: 't2' },
    });
    expect(allTabIds(root)).toEqual(['t1', 't2']);
    expect(normalizeLayout(null, new Set(), 'fallback')).toMatchObject({ id: 'fallback' });
  });
});
