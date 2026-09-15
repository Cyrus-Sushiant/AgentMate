import { describe, expect, it } from 'vitest';
import { parseNumstatZ, parseStatusV2, withNumstat } from './statusV2.js';

const HASH = 'a'.repeat(40);

describe('parseStatusV2', () => {
  it('reads branch headers', () => {
    const output = [
      `# branch.oid ${HASH}`,
      '# branch.head feat/workspace',
      '# branch.upstream origin/feat/workspace',
      '# branch.ab +2 -1',
      '',
    ].join('\0');
    expect(parseStatusV2(output)).toMatchObject({
      oid: HASH,
      branch: 'feat/workspace',
      detached: false,
      upstream: 'origin/feat/workspace',
      ahead: 2,
      behind: 1,
    });
  });

  it('handles unborn and detached heads', () => {
    expect(parseStatusV2('# branch.oid (initial)\0# branch.head main\0')).toMatchObject({
      oid: null,
      branch: 'main',
    });
    expect(parseStatusV2('# branch.head (detached)\0')).toMatchObject({
      branch: null,
      detached: true,
    });
  });

  it('splits entries into staged, unstaged, untracked and conflicts', () => {
    const output = [
      `1 M. N... 100644 100644 100644 ${HASH} ${HASH} src/staged file.ts`,
      `1 .M N... 100644 100644 100644 ${HASH} ${HASH} src/édité.ts`,
      `1 AM N... 000000 100644 100644 ${HASH} ${HASH} new.ts`,
      `2 R. N... 100644 100644 100644 ${HASH} ${HASH} R100 renamed to.ts`,
      'old name.ts',
      `u UU N... 100644 100644 100644 100644 ${HASH} ${HASH} ${HASH} conflict.ts`,
      '? untracked dir/file.txt',
      '',
    ].join('\0');
    const parsed = parseStatusV2(output);
    expect(parsed.staged).toEqual([
      { path: 'src/staged file.ts', status: 'M' },
      { path: 'new.ts', status: 'A' },
      { path: 'renamed to.ts', status: 'R', origPath: 'old name.ts' },
    ]);
    expect(parsed.unstaged).toEqual([
      { path: 'src/édité.ts', status: 'M' },
      { path: 'new.ts', status: 'M' },
    ]);
    expect(parsed.conflicts).toEqual([{ path: 'conflict.ts', status: 'U', conflict: 'UU' }]);
    expect(parsed.untracked).toEqual([{ path: 'untracked dir/file.txt', status: '?' }]);
  });
});

describe('parseNumstatZ', () => {
  it('reads counts, binaries and renames', () => {
    const output = ['12\t3\tsrc/a.ts', '-\t-\timg.png', '4\t0\t', 'old.ts', 'new.ts', ''].join(
      '\0',
    );
    const stats = parseNumstatZ(output);
    expect(stats.get('src/a.ts')).toEqual({ additions: 12, deletions: 3, binary: false });
    expect(stats.get('img.png')).toEqual({ additions: 0, deletions: 0, binary: true });
    expect(stats.get('new.ts')).toEqual({ additions: 4, deletions: 0, binary: false });
    expect(stats.has('old.ts')).toBe(false);

    const merged = withNumstat(
      [
        { path: 'src/a.ts', status: 'M' },
        { path: 'x', status: 'M' },
      ],
      stats,
    );
    expect(merged).toEqual([
      { path: 'src/a.ts', status: 'M', additions: 12, deletions: 3, binary: false },
      { path: 'x', status: 'M' },
    ]);
  });
});
