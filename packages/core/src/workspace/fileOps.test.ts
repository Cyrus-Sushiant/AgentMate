import { describe, expect, it } from 'vitest';
import {
  appendGitignore,
  baseName,
  copyName,
  gitignoreLine,
  isSameOrInside,
  parentPath,
  relativeTo,
  remapPath,
  splitExtension,
  topLevelPaths,
  validateEntryName,
} from './fileOps.js';

describe('validateEntryName', () => {
  it('accepts ordinary names', () => {
    expect(validateEntryName('index.ts', 'win32')).toBeNull();
    expect(validateEntryName('.env', 'linux')).toBeNull();
  });

  it('rejects empty and dot names', () => {
    expect(validateEntryName('  ', 'linux')).not.toBeNull();
    expect(validateEntryName('..', 'linux')).not.toBeNull();
    expect(validateEntryName('.', 'darwin')).not.toBeNull();
  });

  it('only allows slashes when nesting is allowed', () => {
    expect(validateEntryName('a/b.ts', 'linux')).not.toBeNull();
    expect(validateEntryName('a/b.ts', 'linux', { allowNested: true })).toBeNull();
    expect(validateEntryName('a/../b.ts', 'linux', { allowNested: true })).not.toBeNull();
    expect(validateEntryName('/b.ts', 'linux', { allowNested: true })).not.toBeNull();
    expect(validateEntryName('a//b', 'linux', { allowNested: true })).not.toBeNull();
    expect(validateEntryName('a/', 'linux', { allowNested: true })).toBeNull();
  });

  it('applies Windows rules only on Windows', () => {
    expect(validateEntryName('a:b', 'win32')).not.toBeNull();
    expect(validateEntryName('a:b', 'linux')).toBeNull();
    expect(validateEntryName('con.txt', 'win32')).not.toBeNull();
    expect(validateEntryName('console.txt', 'win32')).toBeNull();
    expect(validateEntryName('name.', 'win32')).not.toBeNull();
  });

  it('rejects names padded with spaces', () => {
    expect(validateEntryName(' a.ts', 'linux')).not.toBeNull();
  });
});

describe('splitExtension', () => {
  it('splits at the last dot and keeps dotfiles whole', () => {
    expect(splitExtension('a.tar.gz')).toEqual({ base: 'a.tar', ext: '.gz' });
    expect(splitExtension('.env')).toEqual({ base: '.env', ext: '' });
    expect(splitExtension('Makefile')).toEqual({ base: 'Makefile', ext: '' });
  });
});

describe('copyName', () => {
  it('keeps a free name', () => {
    expect(copyName('a.ts', ['b.ts'])).toBe('a.ts');
  });

  it('counts up like VS Code', () => {
    expect(copyName('a.ts', ['a.ts'])).toBe('a copy.ts');
    expect(copyName('a.ts', ['a.ts', 'a copy.ts'])).toBe('a copy 2.ts');
    expect(copyName('A.ts', ['a.ts', 'A COPY.ts'])).toBe('A copy 2.ts');
  });

  it('does not split folder names at a dot', () => {
    expect(copyName('v1.2', ['v1.2'], true)).toBe('v1.2 copy');
  });
});

describe('path helpers', () => {
  it('checks containment on segment boundaries', () => {
    expect(isSameOrInside('C:\\p\\src\\a.ts', 'C:\\p\\src')).toBe(true);
    expect(isSameOrInside('C:\\p\\src', 'C:\\p\\src\\')).toBe(true);
    expect(isSameOrInside('C:\\p\\src2', 'C:\\p\\src')).toBe(false);
    expect(isSameOrInside('/p/src/a', '/p/src')).toBe(true);
  });

  it('remaps a path and its children', () => {
    expect(remapPath('/p/old/a.ts', '/p/old', '/p/new')).toBe('/p/new/a.ts');
    expect(remapPath('/p/old', '/p/old', '/p/new')).toBe('/p/new');
    expect(remapPath('/p/older', '/p/old', '/p/new')).toBeNull();
  });

  it('finds parents and base names', () => {
    expect(parentPath('C:\\p\\a.ts')).toBe('C:\\p');
    expect(parentPath('C:\\a.ts')).toBe('C:\\');
    expect(parentPath('/p/a.ts')).toBe('/p');
    expect(baseName('C:\\p\\a.ts')).toBe('a.ts');
    expect(baseName('/p/dir/')).toBe('dir');
  });

  it('makes forward-slash relative paths', () => {
    expect(relativeTo('C:\\repo', 'C:\\repo\\src\\a.ts')).toBe('src/a.ts');
    expect(relativeTo('C:\\repo', 'C:\\repo')).toBe('');
    expect(relativeTo('C:\\repo', 'C:\\other\\a.ts')).toBeNull();
  });

  it('drops paths nested in another selected path', () => {
    expect(topLevelPaths(['/p/a', '/p/a/b.ts', '/p/c', '/p/c'])).toEqual(['/p/a', '/p/c']);
  });
});

describe('gitignore', () => {
  it('anchors paths and marks folders', () => {
    expect(gitignoreLine('src/gen', true)).toBe('/src/gen/');
    expect(gitignoreLine('src\\a.log', false)).toBe('/src/a.log');
    expect(gitignoreLine('notes #1 [draft].md', false)).toBe('/notes \\#1 \\[draft\\].md');
  });

  it('builds extension patterns for files only', () => {
    expect(gitignoreLine('logs/a.log', false, 'extension')).toBe('*.log');
    expect(gitignoreLine('Makefile', false, 'extension')).toBeNull();
    expect(gitignoreLine('dir.d', true, 'extension')).toBeNull();
  });

  it('appends on a new line and skips duplicates', () => {
    expect(appendGitignore('', '/a')).toBe('/a\n');
    expect(appendGitignore('node_modules', '/a')).toBe('node_modules\n/a\n');
    expect(appendGitignore('x\r\n', '/a')).toBe('x\r\n/a\r\n');
    expect(appendGitignore('/a\n', '/a')).toBeNull();
  });
});
