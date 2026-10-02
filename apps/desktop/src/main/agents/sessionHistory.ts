import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type AgentHistoryProvider,
  type AgentHistorySession,
  claudeProjectDirName,
  codexRolloutMeta,
  type SessionSummary,
  sameFolder,
  summarizeClaudeTranscript,
  summarizeCodexRollout,
} from '@agentmat/core';

// Past conversations for the workspace's history section. Claude Code keeps one transcript per
// session in a folder named after the project path; Codex keeps rollouts by date, with the
// folder written on the first line. Only the first and last chunk of a file is read, and the
// result is cached against the file's size and mtime, so listing again is nearly free.
//
// The reading goes through a small HistoryFs, so the same logic lists this machine's history
// and, over SFTP, a saved server's.

const HEAD_BYTES = 256 * 1024;
const TAIL_BYTES = 128 * 1024;
const FIRST_LINE_STEP = 64 * 1024;
const FIRST_LINE_LIMIT = 2 * 1024 * 1024;
const THREAD_INDEX_LIMIT = 8 * 1024 * 1024;
const MAX_SESSIONS = 200;
const CONCURRENCY = 6;

export interface HistoryDirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  mtimeMs: number;
}

/** The few file operations the history reader needs, on this machine or a remote one. */
export interface HistoryFs {
  /** Cache namespace, e.g. 'local' or 'ssh:<serverId>'. */
  readonly scope: string;
  readonly caseInsensitive: boolean;
  /** Join path segments with the target's separator. */
  join(...parts: string[]): string;
  home(): Promise<string>;
  env(name: string): Promise<string | undefined>;
  /** Entries with attributes in one call; rejects or returns [] when the dir is missing. */
  list(dir: string): Promise<HistoryDirEntry[]>;
  /** Decoded UTF-8 text of bytes [start, start+length). */
  readRange(path: string, start: number, length: number): Promise<string>;
}

export interface CollectHistoryOptions {
  /** Only sessions started in this folder. Without it, every session on the target. */
  folder?: string;
  limit?: number;
  headBytes?: number;
  tailBytes?: number;
  /** How many files are read at once. */
  concurrency?: number;
}

interface Settings {
  folder: string | undefined;
  limit: number;
  headBytes: number;
  tailBytes: number;
  concurrency: number;
}

interface FileInfo {
  path: string;
  name: string;
  mtimeMs: number;
  size: number;
}

type CodexMeta = { id: string; cwd: string | null; background: boolean } | null;

const summaryCache = new Map<string, { key: string; summary: SessionSummary | null }>();
/** A rollout's folder never changes, so its first line is read once per app run. */
const codexMetaCache = new Map<string, CodexMeta>();

/** Forgets every cached summary and rollout folder. For tests. */
export function clearHistoryCaches(): void {
  summaryCache.clear();
  codexMetaCache.clear();
}

const cacheKey = (fs: HistoryFs, path: string): string => `${fs.scope}\u0000${path}`;

/** Runs `fn` over `items` with at most `limit` calls in flight, keeping the order. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

async function listDir(fs: HistoryFs, dir: string): Promise<HistoryDirEntry[]> {
  try {
    return await fs.list(dir);
  } catch {
    return [];
  }
}

const fileInfo = (fs: HistoryFs, dir: string, entry: HistoryDirEntry): FileInfo => ({
  path: fs.join(dir, entry.name),
  name: entry.name,
  mtimeMs: entry.mtimeMs,
  size: entry.size,
});

/** The file's first and last lines. Lines cut by a chunk edge fail to parse and are skipped. */
async function readHeadAndTail(
  fs: HistoryFs,
  file: FileInfo,
  settings: Settings,
): Promise<{ head: string[]; tail: string[] }> {
  const head = (await fs.readRange(file.path, 0, Math.min(settings.headBytes, file.size))).split(
    '\n',
  );
  if (file.size <= settings.headBytes) return { head, tail: [] };
  const start = Math.max(settings.headBytes, file.size - settings.tailBytes);
  const tail = (await fs.readRange(file.path, start, file.size - start)).split('\n');
  return { head, tail };
}

/**
 * The first line, read in steps from `start` on top of `text` already read. A multi-byte
 * character cut by a step edge only garbles a JSON string value, so the line still parses.
 */
async function readFirstLine(fs: HistoryFs, file: FileInfo, start = 0, text = ''): Promise<string> {
  let offset = start;
  let line = text;
  while (offset < file.size && offset < FIRST_LINE_LIMIT) {
    const length = Math.min(FIRST_LINE_STEP, file.size - offset);
    const chunk = await fs.readRange(file.path, offset, length);
    if (!chunk) break;
    const newline = chunk.indexOf('\n');
    if (newline >= 0) return line + chunk.slice(0, newline);
    line += chunk;
    offset += length;
  }
  return line;
}

async function summarize(
  fs: HistoryFs,
  file: FileInfo,
  read: (file: FileInfo) => Promise<SessionSummary | null>,
): Promise<SessionSummary | null> {
  const key = `${file.size}:${file.mtimeMs}`;
  const cached = summaryCache.get(cacheKey(fs, file.path));
  if (cached?.key === key) return cached.summary;
  let summary: SessionSummary | null = null;
  try {
    summary = await read(file);
  } catch {
    summary = null;
  }
  summaryCache.set(cacheKey(fs, file.path), { key, summary });
  return summary;
}

function toSession(
  provider: AgentHistoryProvider,
  file: FileInfo,
  summary: SessionSummary,
): AgentHistorySession {
  return { ...summary, provider, updatedAt: file.mtimeMs, sizeBytes: file.size };
}

// --- Claude Code ------------------------------------------------------------

async function claudeRoots(fs: HistoryFs, home: string): Promise<string[]> {
  const roots: string[] = [];
  const configDir = await fs.env('CLAUDE_CONFIG_DIR');
  if (configDir) roots.push(fs.join(configDir, 'projects'));
  roots.push(fs.join(home, '.claude', 'projects'), fs.join(home, '.config', 'claude', 'projects'));
  return [...new Set(roots)];
}

/** Transcript files, from the folder's project dirs or, without a folder, from all of them. */
async function claudeFiles(fs: HistoryFs, home: string, settings: Settings): Promise<FileInfo[]> {
  const wanted = settings.folder === undefined ? null : claudeProjectDirName(settings.folder);
  const dirs: string[] = [];
  for (const root of await claudeRoots(fs, home)) {
    // The drive letter's case follows however the CLI was started, so both spellings exist.
    for (const entry of await listDir(fs, root)) {
      if (!entry.isDirectory) continue;
      const matches =
        wanted === null ||
        (fs.caseInsensitive
          ? entry.name.toLowerCase() === wanted.toLowerCase()
          : entry.name === wanted);
      if (matches) dirs.push(fs.join(root, entry.name));
    }
  }
  const lists = await mapLimit(dirs, settings.concurrency, async (dir) =>
    (await listDir(fs, dir))
      .filter((entry) => entry.isFile && entry.name.endsWith('.jsonl'))
      .map((entry) => fileInfo(fs, dir, entry)),
  );
  return lists.flat();
}

async function claudeSession(
  fs: HistoryFs,
  file: FileInfo,
  settings: Settings,
): Promise<AgentHistorySession | null> {
  const summary = await summarize(fs, file, async (f) => {
    const { head, tail } = await readHeadAndTail(fs, f, settings);
    return summarizeClaudeTranscript(f.name.slice(0, -'.jsonl'.length), head, tail);
  });
  if (!summary) return null;
  // Different paths can share a folder name (`a-b` and `a/b`), so check the real one.
  const { folder } = settings;
  if (folder !== undefined && summary.cwd && !sameFolder(summary.cwd, folder, fs.caseInsensitive)) {
    return null;
  }
  return toSession('claude-code', file, summary);
}

// --- Codex --------------------------------------------------------------------

async function codexHome(fs: HistoryFs, home: string): Promise<string> {
  return (await fs.env('CODEX_HOME')) || fs.join(home, '.codex');
}

async function codexRollouts(fs: HistoryFs, home: string, settings: Settings): Promise<FileInfo[]> {
  const out: FileInfo[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    await mapLimit(await listDir(fs, dir), settings.concurrency, async (entry) => {
      if (entry.isDirectory && depth < 4) await walk(fs.join(dir, entry.name), depth + 1);
      else if (entry.isFile && entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
        out.push(fileInfo(fs, dir, entry));
      }
    });
  }
  await walk(fs.join(home, 'sessions'), 0);
  return out;
}

/** Rollouts worth reading: those started in the folder, or every one without a folder. */
async function codexFiles(fs: HistoryFs, home: string, settings: Settings): Promise<FileInfo[]> {
  const rollouts = await codexRollouts(fs, home, settings);
  const { folder } = settings;
  if (folder === undefined) return rollouts;
  const metas = await mapLimit(rollouts, settings.concurrency, async (file) => {
    const key = cacheKey(fs, file.path);
    let meta = codexMetaCache.get(key);
    if (meta === undefined) {
      try {
        meta = codexRolloutMeta(await readFirstLine(fs, file));
      } catch {
        meta = null;
      }
      codexMetaCache.set(key, meta);
    }
    return meta;
  });
  return rollouts.filter((_, i) => {
    const cwd = metas[i]?.cwd;
    return cwd ? sameFolder(cwd, folder, fs.caseInsensitive) : false;
  });
}

async function codexSession(
  fs: HistoryFs,
  file: FileInfo,
  settings: Settings,
): Promise<AgentHistorySession | null> {
  const summary = await summarize(fs, file, async (f) => {
    const { head, tail } = await readHeadAndTail(fs, f, settings);
    // The meta line can be longer than the head chunk; finish it and hand it over whole.
    const cut = head.length === 1 && f.size > settings.headBytes;
    const first = cut ? await readFirstLine(fs, f, settings.headBytes, head[0]) : head[0];
    return summarizeCodexRollout([first, ...head.slice(1)], tail);
  });
  return summary ? toSession('codex', file, summary) : null;
}

/** Thread names Codex shows in its own resume picker, by session id. */
async function codexThreadNames(fs: HistoryFs, home: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const index = (await listDir(fs, home)).find(
    (entry) => entry.isFile && entry.name === 'session_index.jsonl',
  );
  if (!index) return names;
  try {
    const path = fs.join(home, index.name);
    const text = await fs.readRange(path, 0, Math.min(index.size, THREAD_INDEX_LIMIT));
    for (const line of text.split('\n')) {
      try {
        const record = JSON.parse(line) as { id?: unknown; thread_name?: unknown };
        if (typeof record.id === 'string' && typeof record.thread_name === 'string') {
          names.set(record.id, record.thread_name);
        }
      } catch {
        /* partial or foreign line */
      }
    }
  } catch {
    /* removed while reading */
  }
  return names;
}

// --- Both ---------------------------------------------------------------------

/**
 * Past Claude Code and Codex conversations on the target, newest first. Candidate files are
 * capped to the newest `limit` before any transcript is read, so a server with thousands of
 * sessions costs `limit` reads, not thousands.
 */
export async function collectHistory(
  fs: HistoryFs,
  options: CollectHistoryOptions = {},
): Promise<AgentHistorySession[]> {
  const settings: Settings = {
    folder: options.folder,
    limit: options.limit ?? MAX_SESSIONS,
    headBytes: options.headBytes ?? HEAD_BYTES,
    tailBytes: options.tailBytes ?? TAIL_BYTES,
    concurrency: options.concurrency ?? CONCURRENCY,
  };
  const home = await fs.home();
  const codex = await codexHome(fs, home);
  const [claudeCandidates, codexCandidates] = await Promise.all([
    claudeFiles(fs, home, settings).catch(() => []),
    codexFiles(fs, codex, settings).catch(() => []),
  ]);
  const picked = [
    ...claudeCandidates.map((file) => ({ provider: 'claude-code' as const, file })),
    ...codexCandidates.map((file) => ({ provider: 'codex' as const, file })),
  ]
    .sort((a, b) => b.file.mtimeMs - a.file.mtimeMs)
    .slice(0, settings.limit);

  const read = await mapLimit(picked, settings.concurrency, ({ provider, file }) =>
    provider === 'claude-code'
      ? claudeSession(fs, file, settings)
      : codexSession(fs, file, settings),
  );
  let sessions = read.filter((s): s is AgentHistorySession => s !== null);

  if (sessions.some((s) => s.provider === 'codex')) {
    const names = await codexThreadNames(fs, codex);
    sessions = sessions.map((s) =>
      s.provider === 'codex' ? { ...s, title: names.get(s.id) ?? null } : s,
    );
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, settings.limit);
}

// --- This machine -----------------------------------------------------------------

async function readChunk(path: string, start: number, length: number): Promise<string> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead).toString('utf-8');
  } finally {
    await handle.close();
  }
}

export const localHistoryFs: HistoryFs = {
  scope: 'local',
  caseInsensitive: process.platform === 'win32' || process.platform === 'darwin',
  join: (...parts) => join(...parts),
  home: async () => homedir(),
  env: async (name) => process.env[name],
  list: async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    const listed = await Promise.all(
      entries.map(async (entry): Promise<HistoryDirEntry | null> => {
        if (entry.isDirectory()) {
          return { name: entry.name, isDirectory: true, isFile: false, size: 0, mtimeMs: 0 };
        }
        if (!entry.isFile() && !entry.isSymbolicLink()) return null;
        // stat follows links, so a linked transcript or folder counts as what it points at.
        try {
          const info = await stat(join(dir, entry.name));
          return {
            name: entry.name,
            isDirectory: info.isDirectory(),
            isFile: info.isFile(),
            size: info.size,
            mtimeMs: info.mtimeMs,
          };
        } catch {
          return null; // removed while listing
        }
      }),
    );
    return listed.filter((entry): entry is HistoryDirEntry => entry !== null);
  },
  readRange: readChunk,
};

/** Past Claude Code and Codex conversations started in `folder`, newest first. */
export async function listAgentHistory(folder: string): Promise<AgentHistorySession[]> {
  return collectHistory(localHistoryFs, { folder });
}
