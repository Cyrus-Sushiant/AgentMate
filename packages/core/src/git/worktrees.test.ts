import { describe, expect, it } from 'vitest';
import {
  branchNameProblem,
  branchSlug,
  cleanBranchSuggestion,
  DEFAULT_PROJECT_WORKTREE_SETUP,
  DEFAULT_WORKTREE_SETTINGS,
  defaultWorktreePath,
  matchCopyGlobs,
  normalizeProjectWorktreeSetup,
  normalizeWorktreeSettings,
  parseWorktreeList,
  uniquePath,
} from './worktrees.js';

const HASH = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

/** `git worktree list --porcelain -z`: one field per NUL, records end with an empty field. */
function porcelain(records: string[][]): string {
  return records.map((fields) => `${fields.join('\0')}\0\0`).join('');
}

describe('parseWorktreeList', () => {
  it('reads the main worktree and a linked one', () => {
    const output = porcelain([
      ['worktree C:/code/app', `HEAD ${HASH}`, 'branch refs/heads/main'],
      ['worktree C:/code/app.worktrees/feat-auth', `HEAD ${OTHER}`, 'branch refs/heads/feat/auth'],
    ]);
    expect(parseWorktreeList(output)).toEqual([
      {
        path: 'C:/code/app',
        head: HASH,
        branch: 'main',
        detached: false,
        bare: false,
        locked: false,
        prunable: false,
      },
      {
        path: 'C:/code/app.worktrees/feat-auth',
        head: OTHER,
        branch: 'feat/auth',
        detached: false,
        bare: false,
        locked: false,
        prunable: false,
      },
    ]);
  });

  it('reads detached, bare, locked and prunable records with their reasons', () => {
    const output = porcelain([
      ['worktree /repo.git', 'bare'],
      ['worktree /tmp/detached', `HEAD ${HASH}`, 'detached'],
      ['worktree /tmp/locked', `HEAD ${HASH}`, 'branch refs/heads/x', 'locked on a usb drive'],
      [
        'worktree /tmp/gone',
        `HEAD ${HASH}`,
        'branch refs/heads/y',
        'prunable gitdir file points to non-existent location',
      ],
    ]);
    const [bare, detached, locked, gone] = parseWorktreeList(output);
    expect(bare).toMatchObject({ path: '/repo.git', bare: true, head: null, branch: null });
    expect(detached).toMatchObject({ detached: true, branch: null, head: HASH });
    expect(locked).toMatchObject({ locked: true, lockReason: 'on a usb drive', branch: 'x' });
    expect(gone).toMatchObject({
      prunable: true,
      prunableReason: 'gitdir file points to non-existent location',
    });
  });

  it('takes a bare lock or prune flag without a reason', () => {
    const [entry] = parseWorktreeList(
      porcelain([['worktree /w', `HEAD ${HASH}`, 'branch refs/heads/w', 'locked', 'prunable']]),
    );
    expect(entry).toMatchObject({ locked: true, prunable: true });
    expect(entry?.lockReason).toBeUndefined();
    expect(entry?.prunableReason).toBeUndefined();
  });

  it('accepts the newline form and ignores trailing blank records', () => {
    const output = `worktree /a\nHEAD ${HASH}\nbranch refs/heads/main\n\nworktree /b\nHEAD ${HASH}\ndetached\n\n\n`;
    expect(parseWorktreeList(output).map((w) => w.path)).toEqual(['/a', '/b']);
  });

  it('keeps spaces in paths', () => {
    const [entry] = parseWorktreeList(
      porcelain([['worktree C:/My Code/app', `HEAD ${HASH}`, 'branch refs/heads/main']]),
    );
    expect(entry?.path).toBe('C:/My Code/app');
  });

  it('returns nothing for empty output', () => {
    expect(parseWorktreeList('')).toEqual([]);
  });
});

describe('branchSlug', () => {
  it('turns a branch into a folder-friendly name', () => {
    expect(branchSlug('feat/Auth Flow!')).toBe('feat-auth-flow');
    expect(branchSlug('fix//login--page')).toBe('fix-login-page');
    expect(branchSlug('  -release_1.2-  ')).toBe('release_1.2');
  });

  it('never returns an empty name or a dot name', () => {
    expect(branchSlug('///')).toBe('worktree');
    expect(branchSlug('..')).toBe('worktree');
  });

  it('keeps names short enough for Windows paths', () => {
    const slug = branchSlug(`feat/${'a'.repeat(200)}`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('defaultWorktreePath', () => {
  it('puts worktrees in a folder next to the repository', () => {
    expect(defaultWorktreePath('C:\\code\\app', 'feat/auth')).toBe(
      'C:\\code\\app.worktrees\\feat-auth',
    );
    expect(defaultWorktreePath('/home/me/app/', 'fix-login')).toBe(
      '/home/me/app.worktrees/fix-login',
    );
  });

  it('uses a chosen base folder, grouped per repository', () => {
    expect(defaultWorktreePath('C:\\code\\app', 'feat/auth', 'D:\\trees')).toBe(
      'D:\\trees\\app\\feat-auth',
    );
    expect(defaultWorktreePath('/code/app', 'x', '/trees/')).toBe('/trees/app/x');
  });

  it('handles a repository at a drive root', () => {
    expect(defaultWorktreePath('D:\\', 'feat')).toBe('D:\\worktrees\\feat');
  });
});

describe('uniquePath', () => {
  it('keeps a free path and numbers a taken one', () => {
    const taken = new Set(['/w/feat', '/w/feat-2']);
    expect(uniquePath('/w/other', (p) => taken.has(p))).toBe('/w/other');
    expect(uniquePath('/w/feat', (p) => taken.has(p))).toBe('/w/feat-3');
  });
});

describe('matchCopyGlobs', () => {
  const files = [
    '.env',
    '.env.local',
    'apps/web/.env.development',
    'config/.env',
    'src/env.ts',
    'secrets/key.pem',
    'notes/.envrc',
  ];

  it('matches a bare name at any depth, like .gitignore does', () => {
    expect(matchCopyGlobs(files, ['.env'])).toEqual(['.env', 'config/.env']);
  });

  it('matches wildcards within a name', () => {
    expect(matchCopyGlobs(files, ['.env.*'])).toEqual(['.env.local', 'apps/web/.env.development']);
  });

  it('anchors a pattern with a slash to the root and supports **', () => {
    expect(matchCopyGlobs(files, ['secrets/*.pem'])).toEqual(['secrets/key.pem']);
    expect(matchCopyGlobs(files, ['apps/**/.env*'])).toEqual(['apps/web/.env.development']);
    expect(matchCopyGlobs(files, ['/config/.env'])).toEqual(['config/.env']);
  });

  it('returns each file once, in input order, and skips blank patterns', () => {
    expect(matchCopyGlobs(files, ['.env', '.env*', '  '])).toEqual([
      '.env',
      '.env.local',
      'apps/web/.env.development',
      'config/.env',
      'notes/.envrc',
    ]);
  });

  it('accepts Windows separators in the file list', () => {
    expect(matchCopyGlobs(['apps\\web\\.env'], ['apps/web/.env'])).toEqual(['apps\\web\\.env']);
  });
});

describe('normalizeWorktreeSettings', () => {
  it('fills in defaults for a missing or broken value', () => {
    expect(normalizeWorktreeSettings(undefined)).toEqual(DEFAULT_WORKTREE_SETTINGS);
    expect(normalizeWorktreeSettings('nope')).toEqual(DEFAULT_WORKTREE_SETTINGS);
  });

  it('keeps valid fields and cleans the rest', () => {
    expect(
      normalizeWorktreeSettings({
        baseDir: '  D:\trees  ',
        copyGlobs: ['.env', ' ', 3, '.env', 'config/*.local'],
        deleteBranchOnRemove: true,
      }),
    ).toEqual({
      baseDir: 'D:\trees',
      copyGlobs: ['.env', 'config/*.local'],
      deleteBranchOnRemove: true,
    });
  });

  it('treats a blank base folder as next to the repository', () => {
    expect(normalizeWorktreeSettings({ baseDir: '   ' }).baseDir).toBeNull();
  });

  it('keeps an empty pattern list, which copies nothing', () => {
    expect(normalizeWorktreeSettings({ copyGlobs: [] }).copyGlobs).toEqual([]);
  });
});

describe('normalizeProjectWorktreeSetup', () => {
  it('fills in defaults', () => {
    expect(normalizeProjectWorktreeSetup(undefined)).toEqual(DEFAULT_PROJECT_WORKTREE_SETUP);
  });

  it('trims the command and keeps a null or cleaned pattern override', () => {
    expect(normalizeProjectWorktreeSetup({ command: ' pnpm i ', copyGlobs: null })).toEqual({
      command: 'pnpm i',
      copyGlobs: null,
    });
    expect(normalizeProjectWorktreeSetup({ copyGlobs: ['.env', ''] }).copyGlobs).toEqual(['.env']);
  });
});

describe('branchNameProblem', () => {
  it('accepts ordinary branch names', () => {
    expect(branchNameProblem('feat/auth')).toBeNull();
    expect(branchNameProblem('fix-1.2_x')).toBeNull();
  });

  it('explains what git would refuse', () => {
    expect(branchNameProblem('')).toBe('Give the branch a name.');
    expect(branchNameProblem('has space')).toBe('Branch names cannot contain spaces.');
    expect(branchNameProblem('-x')).toBe('Start with a letter or a digit.');
    expect(branchNameProblem('a..b')).toBe('Branch names cannot contain "..".');
    expect(branchNameProblem('feat/')).toBe('Branch names cannot end with "/" or ".".');
    expect(branchNameProblem('x.lock')).toBe('Branch names cannot end with ".lock".');
    expect(branchNameProblem('a//b')).toBe('Branch names cannot contain "//".');
    expect(branchNameProblem('what?')).toBe(
      'Use letters, digits, dots, dashes, underscores or slashes.',
    );
  });
});

describe('cleanBranchSuggestion', () => {
  it('keeps the first line and makes it a valid branch name', () => {
    expect(cleanBranchSuggestion('`Feat/Add Login Page`\nHere is why...')).toBe(
      'feat/add-login-page',
    );
    expect(cleanBranchSuggestion('  "fix/null-check"  ')).toBe('fix/null-check');
    expect(cleanBranchSuggestion('\n\nBranch: chore/bump deps!!')).toBe('branch-chore/bump-deps');
  });

  it('drops leading punctuation and caps the length', () => {
    expect(cleanBranchSuggestion('--/-feat')).toBe('feat');
    expect(cleanBranchSuggestion(`feat/${'x'.repeat(100)}`)?.length ?? 0).toBeLessThanOrEqual(60);
  });

  it('returns null when nothing usable is left', () => {
    expect(cleanBranchSuggestion('   ')).toBeNull();
    expect(cleanBranchSuggestion('!!!')).toBeNull();
  });
});
