import { describe, expect, it } from 'vitest';
import type { WpItemRef } from './protocol.js';
import {
  planWpDeploy,
  planWpPull,
  type WpChange,
  type WpFileMap,
  type WpItemSnapshot,
  type WpPlannedAction,
} from './syncPlan.js';

/**
 * Every combination of base, local and remote for one path, in both directions. `-` is "no such
 * file"; X, Y and Z are three different contents, with X always the base's when there is one.
 */

const THEME: WpItemRef = { kind: 'theme', slug: 'shop' };
const HASH = { X: 'a'.repeat(64), Y: 'b'.repeat(64), Z: 'c'.repeat(64) } as const;
const SIZE = { X: 10, Y: 20, Z: 30 } as const;

type Content = '-' | keyof typeof HASH;

function files(content: Content): WpFileMap {
  return content === '-' ? {} : { 'style.css': { sha256: HASH[content], size: SIZE[content] } };
}

function snapshot(base: Content, local: Content, remote: Content | null): WpItemSnapshot {
  return {
    item: THEME,
    isFile: false,
    base: files(base),
    local: files(local),
    remote: remote === null ? null : files(remote),
  };
}

interface Row {
  base: Content;
  local: Content;
  remote: Content;
  localChange: WpChange | null;
  remoteChange: WpChange | null;
  deploy: WpPlannedAction;
  /** Deploy's expectedRemote, when the action is not `none`. */
  expected?: Content;
  pull: WpPlannedAction;
}

const ROWS: Row[] = [
  // No base: the file is new on one side or both.
  {
    base: '-',
    local: '-',
    remote: 'X',
    localChange: null,
    remoteChange: 'added',
    deploy: 'none',
    pull: 'download',
  },
  {
    base: '-',
    local: '-',
    remote: 'Y',
    localChange: null,
    remoteChange: 'added',
    deploy: 'none',
    pull: 'download',
  },
  {
    base: '-',
    local: 'X',
    remote: '-',
    localChange: 'added',
    remoteChange: null,
    deploy: 'upload',
    expected: '-',
    pull: 'none',
  },
  {
    base: '-',
    local: 'X',
    remote: 'X',
    localChange: 'added',
    remoteChange: 'added',
    deploy: 'none',
    pull: 'none',
  },
  {
    base: '-',
    local: 'X',
    remote: 'Y',
    localChange: 'added',
    remoteChange: 'added',
    deploy: 'conflict',
    expected: 'Y',
    pull: 'conflict',
  },
  {
    base: '-',
    local: 'Y',
    remote: '-',
    localChange: 'added',
    remoteChange: null,
    deploy: 'upload',
    expected: '-',
    pull: 'none',
  },
  {
    base: '-',
    local: 'Y',
    remote: 'Z',
    localChange: 'added',
    remoteChange: 'added',
    deploy: 'conflict',
    expected: 'Z',
    pull: 'conflict',
  },
  // Base X.
  {
    base: 'X',
    local: '-',
    remote: '-',
    localChange: 'deleted',
    remoteChange: 'deleted',
    deploy: 'none',
    pull: 'none',
  },
  {
    base: 'X',
    local: '-',
    remote: 'X',
    localChange: 'deleted',
    remoteChange: null,
    deploy: 'deleteRemote',
    expected: 'X',
    pull: 'none',
  },
  {
    base: 'X',
    local: '-',
    remote: 'Y',
    localChange: 'deleted',
    remoteChange: 'modified',
    deploy: 'conflict',
    expected: 'Y',
    pull: 'conflict',
  },
  {
    base: 'X',
    local: 'X',
    remote: '-',
    localChange: null,
    remoteChange: 'deleted',
    deploy: 'none',
    pull: 'deleteLocal',
  },
  {
    base: 'X',
    local: 'X',
    remote: 'X',
    localChange: null,
    remoteChange: null,
    deploy: 'none',
    pull: 'none',
  },
  {
    base: 'X',
    local: 'X',
    remote: 'Y',
    localChange: null,
    remoteChange: 'modified',
    deploy: 'none',
    pull: 'download',
  },
  {
    base: 'X',
    local: 'Y',
    remote: '-',
    localChange: 'modified',
    remoteChange: 'deleted',
    deploy: 'conflict',
    expected: '-',
    pull: 'conflict',
  },
  {
    base: 'X',
    local: 'Y',
    remote: 'X',
    localChange: 'modified',
    remoteChange: null,
    deploy: 'upload',
    expected: 'X',
    pull: 'none',
  },
  {
    base: 'X',
    local: 'Y',
    remote: 'Y',
    localChange: 'modified',
    remoteChange: 'modified',
    deploy: 'none',
    pull: 'none',
  },
  {
    base: 'X',
    local: 'Y',
    remote: 'Z',
    localChange: 'modified',
    remoteChange: 'modified',
    deploy: 'conflict',
    expected: 'Z',
    pull: 'conflict',
  },
];

const hashOf = (content: Content | undefined) =>
  content === undefined || content === '-' ? null : HASH[content];

describe.each(ROWS)('base $base, local $local, site $remote', (row) => {
  it(`deploy: ${row.deploy}`, () => {
    const plan = planWpDeploy([snapshot(row.base, row.local, row.remote)]);
    expect(plan.direction).toBe('deploy');
    if (row.deploy === 'none') {
      expect(plan.changes).toEqual([]);
      return;
    }
    expect(plan.changes).toHaveLength(1);
    const [change] = plan.changes;
    expect(change).toMatchObject({
      item: THEME,
      path: 'style.css',
      local: row.localChange,
      remote: row.remoteChange,
      action: row.deploy,
      expectedRemote: hashOf(row.expected),
      size: row.deploy === 'deleteRemote' || row.local === '-' ? 0 : SIZE[row.local as 'X'],
    });
    expect(plan.conflicts).toEqual(row.deploy === 'conflict' ? [change] : []);
    expect(plan.uploadBytes).toBe(row.deploy === 'upload' ? change.size : 0);
    expect(plan.downloadBytes).toBe(0);
  });

  it(`pull: ${row.pull}`, () => {
    const plan = planWpPull([snapshot(row.base, row.local, row.remote)]);
    expect(plan.direction).toBe('pull');
    if (row.pull === 'none') {
      expect(plan.changes).toEqual([]);
      return;
    }
    const [change] = plan.changes;
    expect(change).toMatchObject({
      local: row.localChange,
      remote: row.remoteChange,
      action: row.pull,
      expectedRemote: null,
      size: row.pull === 'deleteLocal' || row.remote === '-' ? 0 : SIZE[row.remote as 'X'],
    });
    expect(plan.conflicts).toEqual(row.pull === 'conflict' ? [change] : []);
    expect(plan.downloadBytes).toBe(row.pull === 'download' ? change.size : 0);
    expect(plan.uploadBytes).toBe(0);
  });
});

describe('when the site was not read', () => {
  it('deploys against the base', () => {
    expect(planWpDeploy([snapshot('X', 'Y', null)]).changes[0]).toMatchObject({
      action: 'upload',
      remote: null,
      expectedRemote: HASH.X,
    });
    expect(planWpDeploy([snapshot('X', '-', null)]).changes[0].action).toBe('deleteRemote');
    expect(planWpDeploy([snapshot('-', 'X', null)]).changes[0]).toMatchObject({
      action: 'upload',
      expectedRemote: null,
    });
    expect(planWpDeploy([snapshot('X', 'X', null)]).changes).toEqual([]);
  });

  it('pulls nothing', () => {
    expect(planWpPull([snapshot('X', 'Y', null), snapshot('-', '-', null)]).changes).toEqual([]);
  });
});

describe('plans over several items', () => {
  const entry = (sha: string, size: number) => ({ sha256: sha.repeat(64), size });

  it('sorts by item then path, and adds up the bytes', () => {
    const plugin: WpItemRef = { kind: 'plugin', slug: 'zz' };
    const theme: WpItemRef = { kind: 'theme', slug: 'aa' };
    const plan = planWpDeploy([
      {
        item: theme,
        isFile: false,
        base: {},
        local: { 'z.php': entry('1', 5), 'a.php': entry('2', 7), 'B.php': entry('3', 1) },
        remote: {},
      },
      { item: plugin, isFile: false, base: {}, local: { 'm.php': entry('4', 3) }, remote: null },
    ]);
    expect(plan.changes.map((change) => `${change.item.slug}/${change.path}`)).toEqual([
      'zz/m.php',
      'aa/B.php',
      'aa/a.php',
      'aa/z.php',
    ]);
    expect(plan.uploadBytes).toBe(16);
  });

  it('handles a single-file plugin by its own name', () => {
    const hello: WpItemRef = { kind: 'plugin', slug: 'hello.php' };
    const plan = planWpPull([
      {
        item: hello,
        isFile: true,
        base: { 'hello.php': entry('1', 5) },
        local: { 'hello.php': entry('1', 5) },
        remote: { 'hello.php': entry('2', 6) },
      },
    ]);
    expect(plan.changes).toEqual([
      {
        item: hello,
        path: 'hello.php',
        local: null,
        remote: 'modified',
        action: 'download',
        expectedRemote: null,
        size: 6,
      },
    ]);
    expect(plan.downloadBytes).toBe(6);
  });

  it('compares bytes, not line endings or sizes', () => {
    const plan = planWpDeploy([
      {
        item: THEME,
        isFile: false,
        base: { 'a.php': entry('1', 5) },
        local: { 'a.php': entry('2', 5) },
        remote: { 'a.php': entry('1', 9) },
      },
    ]);
    expect(plan.changes[0].action).toBe('upload');
  });

  it('never deletes a site file the base never listed', () => {
    const plan = planWpDeploy([
      { item: THEME, isFile: false, base: {}, local: {}, remote: { 'theirs.php': entry('1', 1) } },
    ]);
    expect(plan.changes).toEqual([]);
  });
});
