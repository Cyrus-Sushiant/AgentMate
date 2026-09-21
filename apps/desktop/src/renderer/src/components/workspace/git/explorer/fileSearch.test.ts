import { describe, expect, it } from 'vitest';
import { searchFiles, toAbsolutePath } from './fileSearch';

/**
 * What the explorer's search box puts at the top. The order is the whole feature: a name that
 * matches beats a folder that happens to contain the letters.
 */

const FILES = [
  'README.md',
  'apps/desktop/src/renderer/src/stores/workspaceStore.ts',
  'apps/desktop/src/renderer/src/stores/workspaceStore.test.ts',
  'apps/desktop/src/renderer/src/components/workspace/git/GitPanel.tsx',
  'apps/desktop/src/main/ipc/explorer.ts',
  'packages/core/src/workspace/fileOps.ts',
  'docs/store.md',
];

function paths(query: string): string[] {
  return searchFiles(FILES, query).hits.map((hit) => hit.path);
}

describe('searchFiles', () => {
  it('finds nothing for an empty query', () => {
    expect(searchFiles(FILES, '   ')).toEqual({ hits: [], total: 0 });
  });

  it('puts the exact file name first', () => {
    expect(paths('store.md')[0]).toBe('docs/store.md');
  });

  it('prefers a name match over a folder match', () => {
    expect(paths('fileOps')[0]).toBe('packages/core/src/workspace/fileOps.ts');
    expect(paths('workspacestore')[0]).toBe(
      'apps/desktop/src/renderer/src/stores/workspaceStore.ts',
    );
  });

  it('ignores case and spaces', () => {
    expect(paths('git panel')[0]).toBe(
      'apps/desktop/src/renderer/src/components/workspace/git/GitPanel.tsx',
    );
  });

  it('matches scattered letters when nothing matches outright', () => {
    expect(paths('gtpnl')[0]).toBe(
      'apps/desktop/src/renderer/src/components/workspace/git/GitPanel.tsx',
    );
  });

  it('matches a folder and a name together when the query has a slash', () => {
    expect(paths('ipc/explorer')).toEqual(['apps/desktop/src/main/ipc/explorer.ts']);
  });

  it('marks the letters that matched', () => {
    const [hit] = searchFiles(['src/stores/workspaceStore.ts'], 'workspacestore').hits;
    const marked = hit.ranges.map(([from, to]) => hit.path.slice(from, to)).join('');
    expect(marked).toBe('workspaceStore');
  });

  it('counts every match but hands back only the first few', () => {
    const many = Array.from({ length: 30 }, (_, index) => `src/thing${index}.ts`);
    const result = searchFiles(many, 'thing', { limit: 5 });
    expect(result.total).toBe(30);
    expect(result.hits).toHaveLength(5);
  });

  it('orders equal matches the same way every time', () => {
    const first = paths('workspacestore');
    expect(paths('workspacestore')).toEqual(first);
    expect(first).toEqual([
      'apps/desktop/src/renderer/src/stores/workspaceStore.ts',
      'apps/desktop/src/renderer/src/stores/workspaceStore.test.ts',
    ]);
  });
});

describe('toAbsolutePath', () => {
  it('uses the separator the project root came with', () => {
    expect(toAbsolutePath('E:\\work\\app', 'src/index.ts')).toBe('E:\\work\\app\\src\\index.ts');
    expect(toAbsolutePath('/home/me/app/', 'src/index.ts')).toBe('/home/me/app/src/index.ts');
  });
});
