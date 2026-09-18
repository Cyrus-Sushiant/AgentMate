import { describe, expect, it } from 'vitest';
import { IPC } from './ipcChannels';

/**
 * The IPC map is one flat namespace at runtime: `ipcMain.handle` keys on the
 * string, not on where it sits in this object. Two leaves sharing a string
 * means the second handler registration replaces the first, and nothing in the
 * type system notices. These tests walk the object, so a channel added
 * tomorrow is checked without anyone touching this file.
 */

interface Leaf {
  /** Dotted path inside the IPC object, e.g. "git.status". */
  path: string;
  channel: string;
}

type ChannelTree = { [key: string]: string | ChannelTree };

function collectLeaves(tree: ChannelTree, prefix = ''): Leaf[] {
  const leaves: Leaf[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') leaves.push({ path, channel: value });
    else leaves.push(...collectLeaves(value, path));
  }
  return leaves;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

const leaves = collectLeaves(IPC as unknown as ChannelTree);

/** Formats the failures so a red test names the offending channels, not just a count. */
function describeLeaves(bad: Leaf[]): string[] {
  return bad.map((leaf) => `${leaf.path} -> ${leaf.channel}`);
}

describe('IPC channel map', () => {
  it('has channels to check at all', () => {
    // Guards the walker itself: an IPC object reshaped into something this
    // traversal misses would make every test below vacuously pass.
    expect(leaves.length).toBeGreaterThan(400);
  });

  it('gives every leaf a unique channel string', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const leaf of leaves) {
      const first = seen.get(leaf.channel);
      if (first) duplicates.push(`${leaf.channel} is used by both ${first} and ${leaf.path}`);
      else seen.set(leaf.channel, leaf.path);
    }
    expect(duplicates).toEqual([]);
  });

  it('names every channel "group:member", the convention the file already uses', () => {
    // Electron does not care, but the prefix is how a channel in a log is
    // traced back to the handler module that owns it.
    const wrong = leaves.filter(
      (leaf) => !/^[a-z][A-Za-z0-9]*:[a-zA-Z][A-Za-z0-9]*$/.test(leaf.channel),
    );
    expect(describeLeaves(wrong)).toEqual([]);
  });

  it('prefixes each channel with the group it is nested under', () => {
    // A channel copy-pasted into the wrong group keeps working but lands in a
    // different handler module than its name says, which is how duplicates get
    // introduced in the first place.
    const mismatched = leaves.filter((leaf) => {
      const group = leaf.path.split('.')[0];
      return !leaf.channel.startsWith(`${group}:`);
    });
    expect(describeLeaves(mismatched)).toEqual([]);
  });

  it('matches the member half of each channel to its key', () => {
    // Most leaves spell the member exactly like the key. Event channels are
    // sometimes declared as `onFoo: 'group:foo'`, which is deliberate, so the
    // key may carry an extra `on` prefix and nothing else.
    const odd = leaves.filter((leaf) => {
      const key = leaf.path.slice(leaf.path.indexOf('.') + 1);
      const member = leaf.channel.slice(leaf.channel.indexOf(':') + 1);
      if (member === key) return false;
      return !(key.startsWith('on') && lowerFirst(key.slice(2)) === lowerFirst(member));
    });
    expect(describeLeaves(odd)).toEqual([]);
  });

  it('is exactly two levels deep, which is what the preload and handler wiring assume', () => {
    // The contract test and every `IPC.group.member` call site read this shape.
    expect(describeLeaves(leaves.filter((leaf) => leaf.path.split('.').length !== 2))).toEqual([]);
  });

  it('has no empty group', () => {
    // An empty group is the leftover of a feature that was removed halfway.
    const empty = Object.entries(IPC)
      .filter(([, value]) => Object.keys(value).length === 0)
      .map(([group]) => group);
    expect(empty).toEqual([]);
  });
});
