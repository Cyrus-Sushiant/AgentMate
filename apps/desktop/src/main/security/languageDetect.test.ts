import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir, writeTree } from '../../test/main/fixtures';
import { suggestCodeqlLanguage } from './languageDetect';

/**
 * Runs over a real temp tree rather than a mocked readdir, because every rule here is about what
 * the walk does and does not descend into. A wrong suggestion costs the user a half-hour CodeQL
 * run that ends in exit 32, so the skip list and the extension mapping both matter.
 */

describe('suggestCodeqlLanguage', () => {
  it('returns null for an empty folder', async () => {
    await expect(suggestCodeqlLanguage(tempDir())).resolves.toBeNull();
  });

  it('returns null for a folder with no recognized source files', async () => {
    const root = writeTree(tempDir(), {
      'README.md': '# docs\n',
      LICENSE: 'MIT\n',
      'data/rows.csv': 'a,b\n',
    });

    await expect(suggestCodeqlLanguage(root)).resolves.toBeNull();
  });

  it('returns null for a path that does not exist', async () => {
    await expect(suggestCodeqlLanguage(join(tempDir(), 'nope'))).resolves.toBeNull();
  });

  it('picks the language with the most files', async () => {
    const root = writeTree(tempDir(), {
      'src/a.ts': '',
      'src/b.tsx': '',
      'src/c.js': '',
      'scripts/one.py': '',
    });

    await expect(suggestCodeqlLanguage(root)).resolves.toBe('javascript-typescript');
  });

  it.each([
    ['main.py', 'python'],
    ['app.rb', 'ruby'],
    ['Main.java', 'java-kotlin'],
    ['Main.kt', 'java-kotlin'],
    ['Program.cs', 'csharp'],
    ['main.go', 'go'],
    ['main.c', 'c-cpp'],
    ['main.cc', 'c-cpp'],
    ['main.cpp', 'c-cpp'],
    ['header.h', 'c-cpp'],
    ['header.hpp', 'c-cpp'],
    ['App.swift', 'swift'],
    ['index.mjs', 'javascript-typescript'],
    ['index.cjs', 'javascript-typescript'],
    ['index.jsx', 'javascript-typescript'],
  ])('maps %s to %s', async (file, language) => {
    const root = writeTree(tempDir(), { [file]: '' });
    await expect(suggestCodeqlLanguage(root)).resolves.toBe(language);
  });

  it('matches extensions case insensitively', async () => {
    const root = writeTree(tempDir(), { 'Main.PY': '', 'other.Rb': '' });

    // A Windows checkout can easily carry an uppercase extension, and ignoring those files
    // would skew the count towards whatever happens to be lowercase.
    await expect(suggestCodeqlLanguage(root)).resolves.toMatch(/python|ruby/);
  });

  it.each(['node_modules', 'dist', 'build', 'out', 'vendor', 'target', '.venv', '__pycache__'])(
    'does not count files under %s',
    async (skipped) => {
      const root = writeTree(tempDir(), {
        'src/only.py': '',
        [`${skipped}/a.ts`]: '',
        [`${skipped}/b.ts`]: '',
        [`${skipped}/c.ts`]: '',
      });

      // A vendored copy of a JS dependency is far bigger than the project's own code, so
      // counting it would suggest the wrong language for nearly every Python project.
      await expect(suggestCodeqlLanguage(root)).resolves.toBe('python');
    },
  );

  it('skips dot directories but still walks .github', async () => {
    const root = writeTree(tempDir(), {
      '.github/scripts/release.py': '',
      '.cache/a.ts': '',
      '.idea/b.ts': '',
    });

    // Workflow helper scripts are real project code; editor and cache folders are not.
    await expect(suggestCodeqlLanguage(root)).resolves.toBe('python');
  });

  it('ignores dotfiles in the project root', async () => {
    const root = writeTree(tempDir(), { '.eslintrc.js': '', 'main.go': '' });

    await expect(suggestCodeqlLanguage(root)).resolves.toBe('go');
  });

  it('stops descending past the depth limit', async () => {
    const root = tempDir();
    writeTree(root, { 'shallow.go': '' });
    // Seven levels down is past MAX_DEPTH, so these must not be counted even though there
    // are more of them than there are Go files.
    const deep = join(root, 'a', 'b', 'c', 'd', 'e', 'f', 'g');
    mkdirSync(deep, { recursive: true });
    for (const name of ['one.py', 'two.py', 'three.py']) {
      writeFileSync(join(deep, name), '', 'utf-8');
    }

    await expect(suggestCodeqlLanguage(root)).resolves.toBe('go');
  });

  it('counts files right at the depth limit', async () => {
    const root = tempDir();
    const atLimit = join(root, 'a', 'b', 'c', 'd', 'e');
    mkdirSync(atLimit, { recursive: true });
    writeFileSync(join(atLimit, 'deep.py'), '', 'utf-8');

    await expect(suggestCodeqlLanguage(root)).resolves.toBe('python');
  });

  it('breaks a tie deterministically rather than throwing', async () => {
    const root = writeTree(tempDir(), { 'a.py': '', 'b.go': '' });

    // Either answer is defensible with one file each; what matters is that a tie still yields
    // a suggestion the picker can show.
    await expect(suggestCodeqlLanguage(root)).resolves.toMatch(/python|go/);
  });
});
