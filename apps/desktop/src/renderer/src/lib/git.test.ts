import { describe, expect, it } from 'vitest';
import {
  changeStatusMeta,
  diffBarBlocks,
  diffStat,
  formatLineCount,
  projectFilePath,
  repoFileAbsolutePath,
  repoRootPath,
  sanitizeCommitMessage,
  splitGitPath,
  sumDiffStats,
} from './git';

describe('splitGitPath', () => {
  it('keeps the trailing separator with the folder', () => {
    expect(splitGitPath('src/lib/git.ts')).toEqual({ dir: 'src/lib/', name: 'git.ts' });
  });

  it('has no folder for a file at the repo root', () => {
    expect(splitGitPath('README.md')).toEqual({ dir: '', name: 'README.md' });
  });

  it('splits on whichever separator comes last', () => {
    // Git reports forward slashes, but a path coming back from the explorer can be mixed.
    expect(splitGitPath('src\\lib\\git.ts')).toEqual({ dir: 'src\\lib\\', name: 'git.ts' });
    expect(splitGitPath('src\\lib/git.ts')).toEqual({ dir: 'src\\lib/', name: 'git.ts' });
  });

  it('has an empty name for a path that ends in a separator', () => {
    expect(splitGitPath('src/lib/')).toEqual({ dir: 'src/lib/', name: '' });
  });

  it('has nothing to split for an empty path', () => {
    expect(splitGitPath('')).toEqual({ dir: '', name: '' });
  });
});

describe('repoRootPath', () => {
  it('is the project folder itself when the project is the repo', () => {
    expect(repoRootPath('E:\\code\\app', '')).toBe('E:\\code\\app');
    expect(repoRootPath('/home/me/app', '')).toBe('/home/me/app');
  });

  it('climbs one folder per level of the project prefix', () => {
    expect(repoRootPath('E:\\code\\mono\\apps\\desktop', 'apps/desktop')).toBe('E:\\code\\mono');
    expect(repoRootPath('/home/me/mono/apps/desktop', 'apps/desktop')).toBe('/home/me/mono');
    expect(repoRootPath('/home/me/mono/apps', 'apps')).toBe('/home/me/mono');
  });

  it('ignores a trailing separator on the project folder', () => {
    expect(repoRootPath('E:\\code\\mono\\apps\\', 'apps')).toBe('E:\\code\\mono');
    expect(repoRootPath('/home/me/app/', '')).toBe('/home/me/app');
  });

  it('writes the result with the separator the folder came in', () => {
    expect(repoRootPath('E:/code/mono/apps', 'apps')).toBe('E:/code/mono');
  });
});

describe('repoFileAbsolutePath', () => {
  it('rewrites a repo-relative path with the folder is own separator', () => {
    expect(repoFileAbsolutePath('E:\\code\\mono\\apps\\desktop', 'apps/desktop', 'src/a.ts')).toBe(
      'E:\\code\\mono\\src\\a.ts',
    );
    expect(repoFileAbsolutePath('/home/me/mono/apps/desktop', 'apps/desktop', 'src/a.ts')).toBe(
      '/home/me/mono/src/a.ts',
    );
  });

  it('works for a file directly at the repo root', () => {
    expect(repoFileAbsolutePath('/home/me/app', '', 'README.md')).toBe('/home/me/app/README.md');
  });
});

describe('projectFilePath', () => {
  it('maps a file inside the project into the project folder', () => {
    expect(
      projectFilePath('E:\\code\\mono\\apps\\desktop', 'apps/desktop', 'apps/desktop/src/a.ts'),
    ).toBe('E:\\code\\mono\\apps\\desktop\\src\\a.ts');
  });

  it('has no project path for a file elsewhere in the repository', () => {
    // A monorepo change list holds other packages' files too; those have no explorer row.
    expect(
      projectFilePath('/home/me/mono/apps/desktop', 'apps/desktop', 'packages/core/x.ts'),
    ).toBeNull();
  });

  it('takes every file when the project is the whole repository', () => {
    expect(projectFilePath('/home/me/app', '', 'src/a.ts')).toBe('/home/me/app/src/a.ts');
  });

  it('does not mistake a sibling folder with a matching start for the project', () => {
    expect(projectFilePath('/home/me/mono/apps', 'apps', 'apps-old/x.ts')).toBeNull();
  });
});

describe('sanitizeCommitMessage', () => {
  it('leaves a plain message alone', () => {
    expect(sanitizeCommitMessage('fix(git): stage the right file')).toBe(
      'fix(git): stage the right file',
    );
  });

  it('strips the code fences a model wraps its answer in', () => {
    expect(sanitizeCommitMessage('```\nfix: a thing\n```')).toBe('fix: a thing');
    expect(sanitizeCommitMessage('```text\nfix: a thing\n```')).toBe('fix: a thing');
  });

  it('strips the quotes a model puts around a one-line message', () => {
    expect(sanitizeCommitMessage('"fix: a thing"')).toBe('fix: a thing');
    expect(sanitizeCommitMessage("'fix: a thing'")).toBe('fix: a thing');
  });

  it('keeps a quote inside the message', () => {
    expect(sanitizeCommitMessage('fix: don\'t drop the "ok" case')).toBe(
      'fix: don\'t drop the "ok" case',
    );
  });

  it('keeps the body of a multi-line message', () => {
    expect(sanitizeCommitMessage('```\nfix: a thing\n\nBecause of B.\n```')).toBe(
      'fix: a thing\n\nBecause of B.',
    );
  });

  it('is empty for nothing but whitespace or fences', () => {
    expect(sanitizeCommitMessage('   \n  ')).toBe('');
    expect(sanitizeCommitMessage('``````')).toBe('');
  });
});

describe('changeStatusMeta', () => {
  it('labels each git status the changes panel can show', () => {
    expect(changeStatusMeta('M').label).toBe('Modified');
    expect(changeStatusMeta('A').label).toBe('Added');
    expect(changeStatusMeta('D').label).toBe('Deleted');
    expect(changeStatusMeta('R').label).toBe('Renamed');
    expect(changeStatusMeta('T').label).toBe('Type changed');
  });

  it('uses letters people expect rather than git is own for the odd two', () => {
    // Git says U for unmerged and ? for untracked; the panel shows "!" and "U".
    expect(changeStatusMeta('U')).toMatchObject({ letter: '!', label: 'Conflict' });
    expect(changeStatusMeta('?')).toMatchObject({ letter: 'U', label: 'Untracked' });
  });

  it('gives a renamed and a copied file the same colour', () => {
    expect(changeStatusMeta('C').className).toBe(changeStatusMeta('R').className);
  });
});

describe('diffStat', () => {
  it('adds up the lines on every file', () => {
    expect(
      diffStat([
        { path: 'a.ts', status: 'M', additions: 10, deletions: 4 },
        { path: 'b.ts', status: 'A', additions: 120, deletions: 0 },
      ]),
    ).toEqual({ files: 2, additions: 130, deletions: 4, uncounted: 0 });
  });

  it('leaves binary files and files git gave no counts for out of the totals', () => {
    expect(
      diffStat([
        { path: 'logo.png', status: 'A', binary: true },
        { path: 'both.ts', status: 'U' },
        { path: 'a.ts', status: 'M', additions: 3, deletions: 1 },
      ]),
    ).toEqual({ files: 3, additions: 3, deletions: 1, uncounted: 2 });
  });

  it('counts a file that only lost lines', () => {
    expect(diffStat([{ path: 'a.ts', status: 'D', additions: 0, deletions: 42 }])).toMatchObject({
      additions: 0,
      deletions: 42,
      uncounted: 0,
    });
  });

  it('is empty for no files', () => {
    expect(diffStat([])).toEqual({ files: 0, additions: 0, deletions: 0, uncounted: 0 });
  });
});

describe('sumDiffStats', () => {
  it('rolls the groups up into one total', () => {
    expect(
      sumDiffStats([
        { files: 2, additions: 10, deletions: 3, uncounted: 1 },
        { files: 1, additions: 5, deletions: 0, uncounted: 0 },
      ]),
    ).toEqual({ files: 3, additions: 15, deletions: 3, uncounted: 1 });
  });
});

describe('formatLineCount', () => {
  it('writes small numbers out in full', () => {
    expect(formatLineCount(0)).toBe('0');
    expect(formatLineCount(9999)).toBe((9999).toLocaleString());
  });

  it('shortens anything that would not fit the panel', () => {
    expect(formatLineCount(12_345)).toBe('12.3k');
    expect(formatLineCount(250_000)).toBe('250k');
    expect(formatLineCount(2_400_000)).toBe('2.4M');
  });
});

describe('diffBarBlocks', () => {
  it('is all neutral when nothing changed', () => {
    expect(diffBarBlocks(0, 0)).toEqual(['none', 'none', 'none', 'none', 'none']);
  });

  it('splits the five blocks by share of the change', () => {
    expect(diffBarBlocks(50, 50)).toEqual(['add', 'add', 'add', 'del', 'del']);
    expect(diffBarBlocks(100, 0)).toEqual(['add', 'add', 'add', 'add', 'add']);
    expect(diffBarBlocks(0, 100)).toEqual(['del', 'del', 'del', 'del', 'del']);
  });

  it('keeps a block for a side that barely moved, so it never disappears', () => {
    expect(diffBarBlocks(1000, 1).filter((block) => block === 'del')).toHaveLength(1);
    expect(diffBarBlocks(1, 1000).filter((block) => block === 'add')).toHaveLength(1);
  });
});
