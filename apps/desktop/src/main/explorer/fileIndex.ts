import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ExplorerFileIndex } from '../../shared/apiTypes';

const execFileAsync = promisify(execFile);

/**
 * Where the index stops. Past this a result list is not what anyone needs, and the renderer
 * would be holding a few megabytes of paths to scan on every keystroke.
 */
export const MAX_INDEXED_FILES = 20000;
const GIT_TIMEOUT_MS = 20000;
/** Comfortably more than MAX_INDEXED_FILES paths worth of output. */
const GIT_MAX_BUFFER = 16 * 1024 * 1024;
/** How many folders the fallback walk reads at once. */
const WALK_CONCURRENCY = 24;

/** Never worth searching, and the two folders that make a walk slow. */
const ALWAYS_SKIPPED = new Set(['.git', 'node_modules']);

/**
 * Generated folders, skipped only by the fallback walk. In a repository .gitignore already
 * keeps them out, and there the user's own list is the better judge of what is generated.
 */
const GENERATED = new Set([
  '.cache',
  '.gradle',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  '.venv',
  '__pycache__',
  'build',
  'coverage',
  'dist',
  'out',
  'Pods',
  'target',
  'vendor',
  'venv',
]);

function skipped(relative: string): boolean {
  return (
    relative.startsWith('node_modules/') ||
    relative.includes('/node_modules/') ||
    relative.startsWith('.git/')
  );
}

/**
 * The project's files from git, which already knows what is tracked and what .gitignore
 * leaves out. Null when the folder is not a repository, or git is not there to ask.
 */
async function gitFiles(root: string): Promise<string[] | null> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      'git',
      ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        timeout: GIT_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: GIT_MAX_BUFFER,
        encoding: 'utf-8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
    ));
  } catch {
    return null;
  }
  // A file in a merge conflict is listed once per stage, so the paths need collapsing.
  const files = new Set<string>();
  for (const path of stdout.split('\0')) {
    if (!path || skipped(path)) continue;
    files.add(path);
    if (files.size > MAX_INDEXED_FILES) break;
  }
  return Array.from(files);
}

/** Reads one level of folders, collecting their files and returning the folders below them. */
async function readLevel(root: string, dirs: string[], files: string[]): Promise<string[]> {
  const next: string[] = [];
  for (let start = 0; start < dirs.length; start += WALK_CONCURRENCY) {
    const batch = dirs.slice(start, start + WALK_CONCURRENCY);
    const listings = await Promise.all(
      batch.map((relative) =>
        readdir(join(root, relative), { withFileTypes: true }).catch(() => []),
      ),
    );
    for (const [index, entries] of listings.entries()) {
      const parent = batch[index];
      for (const entry of entries) {
        const path = parent ? `${parent}/${entry.name}` : entry.name;
        // Links are left as files here, the way the tree lists them.
        if (!entry.isDirectory()) files.push(path);
        else if (!ALWAYS_SKIPPED.has(entry.name) && !GENERATED.has(entry.name)) next.push(path);
      }
    }
    if (files.length > MAX_INDEXED_FILES) return [];
  }
  return next;
}

/** Every file under the folder, for a project that git cannot list. */
async function walk(root: string): Promise<string[]> {
  const files: string[] = [];
  let level = [''];
  while (level.length > 0 && files.length <= MAX_INDEXED_FILES) {
    level = await readLevel(root, level, files);
  }
  return files;
}

/**
 * The project's files as paths relative to its folder, with forward slashes, for the
 * explorer's search box. Built in one pass so matching can then run in the renderer without
 * another trip per keystroke.
 */
export async function indexProjectFiles(folder: string): Promise<ExplorerFileIndex> {
  const root = resolve(folder);
  const files = (await gitFiles(root)) ?? (await walk(root));
  return {
    root,
    files: files.length > MAX_INDEXED_FILES ? files.slice(0, MAX_INDEXED_FILES) : files,
    truncated: files.length > MAX_INDEXED_FILES,
  };
}
