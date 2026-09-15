import { createReadStream } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
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

const HEAD_BYTES = 256 * 1024;
const TAIL_BYTES = 128 * 1024;
const FIRST_LINE_LIMIT = 2 * 1024 * 1024;
const MAX_SESSIONS = 200;

const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';

interface FileInfo {
  path: string;
  mtimeMs: number;
  size: number;
}

const summaryCache = new Map<string, { key: string; summary: SessionSummary | null }>();
/** A rollout's folder never changes, so its first line is read once per app run. */
const codexMetaCache = new Map<
  string,
  { id: string; cwd: string | null; background: boolean } | null
>();

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

/** The file's first and last lines. Lines cut by a chunk edge fail to parse and are skipped. */
async function readHeadAndTail(file: FileInfo): Promise<{ head: string[]; tail: string[] }> {
  const head = (await readChunk(file.path, 0, Math.min(HEAD_BYTES, file.size))).split('\n');
  if (file.size <= HEAD_BYTES) return { head, tail: [] };
  const start = Math.max(HEAD_BYTES, file.size - TAIL_BYTES);
  const tail = (await readChunk(file.path, start, file.size - start)).split('\n');
  return { head, tail };
}

async function readFirstLine(path: string): Promise<string> {
  let text = '';
  const stream = createReadStream(path, { encoding: 'utf-8', highWaterMark: 64 * 1024 });
  try {
    for await (const chunk of stream) {
      text += chunk as string;
      const newline = text.indexOf('\n');
      if (newline >= 0) return text.slice(0, newline);
      if (text.length > FIRST_LINE_LIMIT) break;
    }
  } finally {
    stream.destroy();
  }
  return text;
}

async function jsonlFiles(dir: string): Promise<FileInfo[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const files = await Promise.all(
    names
      .filter((name) => name.endsWith('.jsonl'))
      .map(async (name) => {
        const path = join(dir, name);
        try {
          const info = await stat(path);
          return info.isFile() ? { path, mtimeMs: info.mtimeMs, size: info.size } : null;
        } catch {
          return null;
        }
      }),
  );
  return files.filter((file): file is FileInfo => file !== null);
}

async function summarize(
  file: FileInfo,
  read: (file: FileInfo) => Promise<SessionSummary | null>,
): Promise<SessionSummary | null> {
  const key = `${file.size}:${file.mtimeMs}`;
  const cached = summaryCache.get(file.path);
  if (cached?.key === key) return cached.summary;
  let summary: SessionSummary | null = null;
  try {
    summary = await read(file);
  } catch {
    summary = null;
  }
  summaryCache.set(file.path, { key, summary });
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

function claudeRoots(): string[] {
  const roots: string[] = [];
  if (process.env.CLAUDE_CONFIG_DIR) roots.push(join(process.env.CLAUDE_CONFIG_DIR, 'projects'));
  roots.push(
    join(homedir(), '.claude', 'projects'),
    join(homedir(), '.config', 'claude', 'projects'),
  );
  return [...new Set(roots)];
}

async function claudeSessions(folder: string): Promise<AgentHistorySession[]> {
  const wanted = claudeProjectDirName(folder);
  const dirs: string[] = [];
  for (const root of claudeRoots()) {
    let names: string[];
    try {
      names = await readdir(root);
    } catch {
      continue;
    }
    // The drive letter's case follows however the CLI was started, so both spellings exist.
    for (const name of names) {
      if (caseInsensitive ? name.toLowerCase() === wanted.toLowerCase() : name === wanted) {
        dirs.push(join(root, name));
      }
    }
  }

  const files = (await Promise.all(dirs.map(jsonlFiles))).flat();
  const sessions = await Promise.all(
    files.map(async (file) => {
      const summary = await summarize(file, async (f) => {
        const { head, tail } = await readHeadAndTail(f);
        return summarizeClaudeTranscript(basename(f.path, '.jsonl'), head, tail);
      });
      // Different paths can share a folder name (`a-b` and `a/b`), so check the real one.
      if (!summary || (summary.cwd && !sameFolder(summary.cwd, folder, caseInsensitive))) {
        return null;
      }
      return toSession('claude-code', file, summary);
    }),
  );
  return sessions.filter((s): s is AgentHistorySession => s !== null);
}

// --- Codex --------------------------------------------------------------------

function codexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), '.codex');
}

async function codexRollouts(): Promise<FileInfo[]> {
  const out: FileInfo[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory() && depth < 4) await walk(path, depth + 1);
        else if (
          entry.isFile() &&
          entry.name.startsWith('rollout-') &&
          entry.name.endsWith('.jsonl')
        ) {
          try {
            const info = await stat(path);
            out.push({ path, mtimeMs: info.mtimeMs, size: info.size });
          } catch {
            /* removed while listing */
          }
        }
      }),
    );
  }
  await walk(join(codexHome(), 'sessions'), 0);
  return out;
}

/** Thread names Codex shows in its own resume picker, by session id. */
async function codexThreadNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const text = await readChunk(
      join(codexHome(), 'session_index.jsonl'),
      0,
      Math.min((await stat(join(codexHome(), 'session_index.jsonl'))).size, 8 * 1024 * 1024),
    );
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
    /* no index yet */
  }
  return names;
}

async function codexSessions(folder: string): Promise<AgentHistorySession[]> {
  const rollouts = await codexRollouts();
  const matching: FileInfo[] = [];
  await Promise.all(
    rollouts.map(async (file) => {
      let meta = codexMetaCache.get(file.path);
      if (meta === undefined) {
        try {
          meta = codexRolloutMeta(await readFirstLine(file.path));
        } catch {
          meta = null;
        }
        codexMetaCache.set(file.path, meta);
      }
      if (meta?.cwd && sameFolder(meta.cwd, folder, caseInsensitive)) matching.push(file);
    }),
  );
  if (matching.length === 0) return [];

  const names = await codexThreadNames();
  const sessions = await Promise.all(
    matching.map(async (file) => {
      const summary = await summarize(file, async (f) => {
        const first = await readFirstLine(f.path);
        const { head, tail } = await readHeadAndTail(f);
        // The meta line can be longer than the head chunk; hand it over whole.
        return summarizeCodexRollout([first, ...head.slice(1)], tail);
      });
      if (!summary) return null;
      return toSession('codex', file, { ...summary, title: names.get(summary.id) ?? null });
    }),
  );
  return sessions.filter((s): s is AgentHistorySession => s !== null);
}

/** Past Claude Code and Codex conversations started in `folder`, newest first. */
export async function listAgentHistory(folder: string): Promise<AgentHistorySession[]> {
  const [claude, codex] = await Promise.all([
    claudeSessions(folder).catch(() => []),
    codexSessions(folder).catch(() => []),
  ]);
  return [...claude, ...codex].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
}
