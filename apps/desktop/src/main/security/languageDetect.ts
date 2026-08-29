import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

/**
 * Suggests a CodeQL language by counting source files.
 *
 * This is only ever a suggestion shown in a picker, never a silent choice. Getting it wrong costs
 * the user a half-hour run that ends in CodeQL's exit 32, so the decision stays theirs; this just
 * saves them from having to think about it in the common case.
 */

const EXTENSION_LANGUAGE: Record<string, string> = {
  '.ts': 'javascript-typescript',
  '.tsx': 'javascript-typescript',
  '.js': 'javascript-typescript',
  '.jsx': 'javascript-typescript',
  '.mjs': 'javascript-typescript',
  '.cjs': 'javascript-typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.java': 'java-kotlin',
  '.kt': 'java-kotlin',
  '.cs': 'csharp',
  '.go': 'go',
  '.c': 'c-cpp',
  '.cc': 'c-cpp',
  '.cpp': 'c-cpp',
  '.h': 'c-cpp',
  '.hpp': 'c-cpp',
  '.swift': 'swift',
};

const SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'vendor',
  'target',
  '.venv',
  '__pycache__',
  '.next',
  'coverage',
]);

/** Enough files to be confident without walking a monorepo to the bottom. */
const MAX_FILES = 4000;
const MAX_DEPTH = 6;

export async function suggestCodeqlLanguage(projectPath: string): Promise<string | null> {
  const counts = new Map<string, number>();
  let seen = 0;

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || seen >= MAX_FILES) return;
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (seen >= MAX_FILES) return;
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (entry.isDirectory()) {
        if (SKIP.has(entry.name)) continue;
        await walk(join(dir, entry.name), depth + 1);
        continue;
      }
      const language = EXTENSION_LANGUAGE[extname(entry.name).toLowerCase()];
      if (!language) continue;
      counts.set(language, (counts.get(language) ?? 0) + 1);
      seen += 1;
    }
  }

  await walk(projectPath, 0);
  if (counts.size === 0) return null;

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
