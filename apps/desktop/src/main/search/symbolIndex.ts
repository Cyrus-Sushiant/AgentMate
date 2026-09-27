import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { SymbolIndex, SymbolIndexPayload } from '../../shared/apiTypes';
import { packSymbolIndex, type SymbolEntry } from '../../shared/symbolIndex';
import { indexProjectFiles } from '../explorer/fileIndex';
import { RG_BASE_ARGS } from './rgArgs';
import { createLineSplitter } from './rgJson';
import { ripgrepPath } from './ripgrepPath';
import {
  buildFileSymbols,
  LANGUAGE_EXTENSIONS,
  type Language,
  languageOf,
  prefilterFor,
} from './symbolExtractors';

/**
 * The declarations behind the workspace search's `t:` and `m:` filters, kept per project.
 *
 * The first request scans the whole project with ripgrep, one run per language it contains.
 * After that a request is answered from memory straight away, and when the answer is a few
 * seconds old a check runs behind it: the file list is compared by size and modified time,
 * and only files that changed are scanned again. The window polls while the search is open,
 * so it picks up the new version on its next ask.
 */

export interface SymbolIndexerOptions {
  /** Stands in for the bundled binary in tests. Null means it is missing. */
  rgPath?: string | null;
  listFiles?: (folder: string) => Promise<string[]>;
  maxSymbols?: number;
  /** How old an answer can be before a request also checks for changed files. */
  staleMs?: number;
  maxProjects?: number;
  /** Past this many changed files a full scan is quicker than listing them all to ripgrep. */
  maxChanged?: number;
}

export interface SymbolRequest {
  /** The version the window already has. */
  sinceVersion?: number;
  /** Wait for the check for changed files instead of answering from memory. */
  fresh?: boolean;
}

interface FileStamp {
  mtimeMs: number;
  size: number;
}

interface ProjectSymbols {
  folder: string;
  byFile: Map<string, SymbolEntry[]>;
  stamps: Map<string, FileStamp>;
  packed: SymbolIndex | null;
  checkedAt: number;
  work: Promise<void> | null;
}

export const MAX_SYMBOLS = 150_000;
const STALE_MS = 5000;
const MAX_PROJECTS = 3;
const MAX_CHANGED = 300;
/** Paths per ripgrep run when rescanning, to stay well inside Windows' command line limit. */
const PATHS_PER_RUN = 100;
const STAT_CONCURRENCY = 64;
const LANGUAGE_CONCURRENCY = 3;

let versions = 0;

async function eachLimited<T>(items: readonly T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await run(item);
    }
  });
  await Promise.all(workers);
}

async function stampAll(folder: string, files: readonly string[]): Promise<Map<string, FileStamp>> {
  const stamps = new Map<string, FileStamp>();
  await eachLimited(files, STAT_CONCURRENCY, async (path) => {
    try {
      const info = await stat(join(folder, path));
      stamps.set(path, { mtimeMs: info.mtimeMs, size: info.size });
    } catch {
      // Gone since the list was made, which the next check will see.
    }
  });
  return stamps;
}

/** Runs ripgrep and hands over each `path`, line number and text it printed. */
function runRg(
  rg: string,
  folder: string,
  args: string[],
  onLine: (path: string, line: number, text: string) => void,
): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(rg, args, {
      cwd: folder,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const splitter = createLineSplitter((raw) => {
      // `--null` puts a NUL after the path, then comes `line:text`.
      const nul = raw.indexOf('\0');
      if (nul === -1) return;
      const rest = raw.slice(nul + 1);
      const colon = rest.indexOf(':');
      const line = Number(rest.slice(0, colon));
      if (!(line > 0)) return;
      const path = raw
        .slice(0, nul)
        .replace(/^\.[\\/]/, '')
        .replaceAll('\\', '/');
      onLine(path, line, rest.slice(colon + 1));
    });
    child.stdout.on('data', (chunk: Buffer) => splitter.push(chunk));
    child.on('error', fail);
    child.on('close', () => {
      splitter.end();
      done();
    });
  });
}

function scanArgs(lang: Language, paths: readonly string[]): string[] {
  const extensions = LANGUAGE_EXTENSIONS[lang];
  return [
    '--no-heading',
    '--with-filename',
    '--line-number',
    '--null',
    '--color=never',
    '--max-columns=400',
    ...RG_BASE_ARGS,
    `--glob=*.{${extensions.join(',')}}`,
    `--regexp=${prefilterFor(lang)}`,
    '--',
    ...paths,
  ];
}

/** Scans files of one language and files their declarations under each path. */
async function scanLanguage(
  rg: string,
  folder: string,
  lang: Language,
  paths: readonly string[],
  keep: ReadonlySet<string>,
  into: Map<string, SymbolEntry[]>,
): Promise<void> {
  const lines = new Map<string, { line: number; text: string }[]>();
  await runRg(rg, folder, scanArgs(lang, paths), (path, line, text) => {
    if (!keep.has(path)) return;
    const list = lines.get(path);
    if (list) list.push({ line, text });
    else lines.set(path, [{ line, text }]);
  });
  for (const [path, list] of lines) {
    list.sort((a, b) => a.line - b.line);
    into.set(path, buildFileSymbols(lang, path, list));
  }
}

function languagesIn(files: Iterable<string>): Map<Language, string[]> {
  const byLanguage = new Map<Language, string[]>();
  for (const path of files) {
    const lang = languageOf(path);
    if (!lang) continue;
    const list = byLanguage.get(lang);
    if (list) list.push(path);
    else byLanguage.set(lang, [path]);
  }
  return byLanguage;
}

export function createSymbolIndexer(options: SymbolIndexerOptions = {}) {
  const listFiles =
    options.listFiles ?? (async (folder: string) => (await indexProjectFiles(folder)).files);
  const maxSymbols = options.maxSymbols ?? MAX_SYMBOLS;
  const staleMs = options.staleMs ?? STALE_MS;
  const maxProjects = options.maxProjects ?? MAX_PROJECTS;
  const maxChanged = options.maxChanged ?? MAX_CHANGED;
  const projects = new Map<string, ProjectSymbols>();

  function rgPath(): string | null {
    return options.rgPath === undefined ? ripgrepPath() : options.rgPath;
  }

  function projectFor(folder: string): ProjectSymbols {
    const key = resolve(folder);
    let project = projects.get(key);
    if (project) {
      // Most recently used goes to the end, so the first entry is the one to drop.
      projects.delete(key);
    } else {
      project = {
        folder: key,
        byFile: new Map(),
        stamps: new Map(),
        packed: null,
        checkedAt: 0,
        work: null,
      };
    }
    projects.set(key, project);
    while (projects.size > maxProjects) {
      const oldest = projects.keys().next().value;
      if (oldest === undefined) break;
      projects.delete(oldest);
    }
    return project;
  }

  function repack(project: ProjectSymbols, unavailable = false): void {
    const entries: SymbolEntry[] = [];
    let truncated = false;
    // Files in path order, so ties in the ranking come out the same every time.
    for (const path of [...project.byFile.keys()].sort()) {
      for (const entry of project.byFile.get(path) ?? []) {
        if (entries.length >= maxSymbols) {
          truncated = true;
          break;
        }
        entries.push(entry);
      }
      if (truncated) break;
    }
    versions += 1;
    project.packed = packSymbolIndex(entries, {
      version: versions,
      root: project.folder,
      truncated,
      unavailable,
    });
  }

  async function currentFiles(project: ProjectSymbols): Promise<string[]> {
    return (await listFiles(project.folder)).filter((path) => languageOf(path) !== null);
  }

  async function fullScan(project: ProjectSymbols): Promise<void> {
    const rg = rgPath();
    if (!rg) {
      project.byFile = new Map();
      project.checkedAt = Date.now();
      repack(project, true);
      return;
    }
    const files = await currentFiles(project);
    const keep = new Set(files);
    const [stamps] = await Promise.all([
      stampAll(project.folder, files),
      (async () => {
        const byFile = new Map<string, SymbolEntry[]>();
        await eachLimited([...languagesIn(files).keys()], LANGUAGE_CONCURRENCY, (lang) =>
          scanLanguage(rg, project.folder, lang, ['.'], keep, byFile),
        );
        project.byFile = byFile;
      })(),
    ]);
    project.stamps = stamps;
    project.checkedAt = Date.now();
    repack(project);
  }

  async function rescanChanged(project: ProjectSymbols): Promise<void> {
    const rg = rgPath();
    if (!rg) return;
    const files = await currentFiles(project);
    const stamps = await stampAll(project.folder, files);
    project.checkedAt = Date.now();
    const changed = files.filter((path) => {
      const now = stamps.get(path);
      const before = project.stamps.get(path);
      return now && (!before || before.mtimeMs !== now.mtimeMs || before.size !== now.size);
    });
    const removed = [...project.stamps.keys()].filter((path) => !stamps.has(path));
    if (changed.length === 0 && removed.length === 0) return;
    if (changed.length > maxChanged) {
      await fullScan(project);
      return;
    }
    const byFile = new Map(project.byFile);
    for (const path of [...removed, ...changed]) byFile.delete(path);
    const keep = new Set(changed);
    await eachLimited([...languagesIn(changed)], LANGUAGE_CONCURRENCY, async ([lang, paths]) => {
      for (let start = 0; start < paths.length; start += PATHS_PER_RUN) {
        await scanLanguage(
          rg,
          project.folder,
          lang,
          paths.slice(start, start + PATHS_PER_RUN),
          keep,
          byFile,
        );
      }
    });
    project.byFile = byFile;
    project.stamps = stamps;
    repack(project);
  }

  function run(
    project: ProjectSymbols,
    task: (project: ProjectSymbols) => Promise<void>,
  ): Promise<void> {
    project.work ??= task(project).finally(() => {
      project.work = null;
    });
    return project.work;
  }

  return {
    async get(folder: string, request: SymbolRequest = {}): Promise<SymbolIndexPayload> {
      const project = projectFor(folder);
      if (!project.packed) {
        await run(project, fullScan);
      } else if (Date.now() - project.checkedAt >= staleMs || project.work) {
        const checking = run(project, rescanChanged).catch(() => {
          // A failed check keeps the last good index; the next request tries again.
        });
        if (request.fresh) await checking;
      }
      const packed = project.packed as SymbolIndex;
      return request.sinceVersion === packed.version
        ? { unchanged: true, version: packed.version }
        : packed;
    },
    forget(folder: string): void {
      projects.delete(resolve(folder));
    },
  };
}

/** The indexer the IPC handlers share. */
export const symbolIndexer = createSymbolIndexer();
