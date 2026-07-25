import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Parsing for the local-log usage providers (Claude Code, Codex). Deliberately
// free of any `electron` / `@agentmat/core` import so this module can be loaded
// both by the main process and by the scan worker thread.
//
// Session logs are append-only JSONL and get big — a few hundred MB of Claude
// transcripts is normal. So we never re-read a file we've already seen: each
// file's byte offset and the token events extracted from it are cached, and a
// rescan only streams the bytes appended since last time.

const DAY_MS = 86_400_000;

/** Retention horizon for token events (a day of slack over the 30d we report). */
export function retentionSinceMs(): number {
  return Date.now() - 31 * DAY_MS;
}

/** One token event, as plain JSON so it survives structured-clone + disk cache. */
export interface RawUsageEntry {
  /** Epoch ms. */
  at: number;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Provider message id when the log has one; used to dedupe across files. */
  id?: string;
}

/** A quota snapshot plus when it was observed, so newer ones win. */
export interface RawWindow {
  label: string;
  used: number;
  total: number;
  percent: number;
  resetAt: string | null;
  at: number;
}

/** Everything we remember about one already-parsed log file. */
export interface FileScanState {
  /** Bytes consumed so far, always landing on a line boundary. */
  offset: number;
  mtimeMs: number;
  size: number;
  /** Carry-over parser state (Codex's current model) across a resumed read. */
  model?: string;
  entries: RawUsageEntry[];
  window?: RawWindow;
}

/** Scan cache for one provider, keyed by absolute file path. */
export type ScanCache = Record<string, FileScanState>;

export interface ScanResult {
  entries: RawUsageEntry[];
  window?: RawWindow;
  /** The cache to persist for the next scan. */
  cache: ScanCache;
}

export type LocalLogProvider = 'claude-code' | 'codex';

// --- file discovery -------------------------------------------------------

interface LogFile {
  path: string;
  mtimeMs: number;
  size: number;
}

/**
 * Recursively collect `*.jsonl` files under `root`, skipping any whose mtime is
 * older than `sinceMs` — a file untouched for over a month cannot hold an event
 * inside our retention horizon. A missing root resolves to an empty list.
 */
async function collectLogFiles(root: string, sinceMs: number): Promise<LogFile[]> {
  const out: LogFile[] = [];
  async function recur(dir: string): Promise<void> {
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // directory doesn't exist / not readable
    }
    for (const dirent of dirents) {
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await recur(full);
      } else if (dirent.isFile() && dirent.name.endsWith('.jsonl')) {
        try {
          const info = await stat(full);
          if (info.mtimeMs >= sinceMs) {
            out.push({ path: full, mtimeMs: info.mtimeMs, size: info.size });
          }
        } catch {
          /* ignore unreadable file */
        }
      }
    }
  }
  await recur(root);
  return out;
}

/**
 * Stream `file` from `fromOffset`, handing each complete line to `onLine`, and
 * return the new byte offset. A trailing partial line (the CLI was mid-write)
 * is left unconsumed so the next scan picks it up whole.
 */
async function readNewLines(
  file: string,
  fromOffset: number,
  onLine: (line: string) => void,
): Promise<number> {
  let consumed = fromOffset;
  let pending = '';
  // setEncoding lets the stream, not us, deal with multi-byte characters that
  // straddle a chunk boundary.
  const stream = createReadStream(file, { start: fromOffset, encoding: 'utf-8' });
  for await (const chunk of stream) {
    pending += chunk as string;
    let nl = pending.indexOf('\n');
    while (nl >= 0) {
      const line = pending.slice(0, nl);
      consumed += Buffer.byteLength(line, 'utf-8') + 1;
      onLine(line);
      pending = pending.slice(nl + 1);
      nl = pending.indexOf('\n');
    }
  }
  return consumed;
}

// --- Claude Code ----------------------------------------------------------

// Claude Code writes one JSONL file per session under its config dir. Assistant
// lines carry `message.model` + `message.usage` with input/output and the two
// cache token counters. `CLAUDE_CONFIG_DIR` overrides the location; otherwise we
// check the two well-known homes.
function claudeRoots(): string[] {
  const roots: string[] = [];
  const override = process.env.CLAUDE_CONFIG_DIR;
  if (override) roots.push(join(override, 'projects'));
  roots.push(join(homedir(), '.claude', 'projects'));
  roots.push(join(homedir(), '.config', 'claude', 'projects'));
  return roots;
}

interface ClaudeLine {
  timestamp?: string;
  message?: {
    model?: string;
    id?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

function parseClaudeLine(line: string, state: FileScanState): void {
  // Cheap substring reject before paying for JSON.parse — most transcript lines
  // are user/tool records with no usage block at all.
  if (!line.includes('"usage"')) return;
  let parsed: ClaudeLine;
  try {
    parsed = JSON.parse(line) as ClaudeLine;
  } catch {
    return;
  }
  const usage = parsed.message?.usage;
  const model = parsed.message?.model;
  const ts = parsed.timestamp;
  if (!usage || !model || !ts) return;

  const at = new Date(ts).getTime();
  if (Number.isNaN(at)) return;

  state.entries.push({
    at,
    model,
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    id: parsed.message?.id,
  });
}

// --- Codex ----------------------------------------------------------------

// Codex writes rollout JSONL under `~/.codex/sessions/<yyyy>/<mm>/<dd>/`.
// `turn_context` lines carry the active `model`; `event_msg` lines with
// `payload.type === 'token_count'` carry per-turn token deltas in
// `info.last_token_usage`, plus a `rate_limits` object we surface as the quota
// window. `CODEX_HOME` overrides the base dir.
function codexRoots(): string[] {
  const base = process.env.CODEX_HOME || join(homedir(), '.codex');
  return [join(base, 'sessions')];
}

interface CodexTokenBreakdown {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

interface CodexRateLimitWindow {
  used_percent?: number;
  window_minutes?: number;
  resets_at?: number; // unix seconds
}

interface CodexLine {
  timestamp?: string;
  type?: string;
  payload?: {
    type?: string;
    model?: string;
    info?: { last_token_usage?: CodexTokenBreakdown; total_token_usage?: CodexTokenBreakdown };
    rate_limits?: { primary?: CodexRateLimitWindow | null; secondary?: CodexRateLimitWindow | null } | null;
  };
}

function windowFromRateLimit(rl: CodexRateLimitWindow, label: string, at: number): RawWindow | null {
  if (typeof rl.used_percent !== 'number') return null;
  return {
    label,
    used: Math.round(rl.used_percent),
    total: 100,
    percent: Math.max(0, Math.min(100, rl.used_percent)),
    resetAt: rl.resets_at ? new Date(rl.resets_at * 1000).toISOString() : null,
    at,
  };
}

function parseCodexLine(line: string, state: FileScanState): void {
  if (!line) return;
  let parsed: CodexLine;
  try {
    parsed = JSON.parse(line) as CodexLine;
  } catch {
    return;
  }
  const payload = parsed.payload;
  if (!payload) return;

  // Model is set on turn_context lines and applies to the token_count events
  // that follow it within the same session file.
  if (payload.model) state.model = payload.model;
  if (payload.type !== 'token_count') return;

  const at = parsed.timestamp ? new Date(parsed.timestamp).getTime() : NaN;
  if (Number.isNaN(at)) return;

  // Prefer the per-turn delta; it's what makes daily bucketing correct.
  const delta = payload.info?.last_token_usage;
  if (delta) {
    const input = delta.input_tokens ?? 0;
    const cached = delta.cached_input_tokens ?? 0;
    const output = (delta.output_tokens ?? 0) + (delta.reasoning_output_tokens ?? 0);
    if (input + cached + output > 0) {
      state.entries.push({
        at,
        model: state.model ?? 'gpt-5',
        // Codex's input_tokens already includes cached; split so we don't
        // double-count in the total.
        input: Math.max(0, input - cached),
        output,
        cacheRead: cached,
        cacheWrite: 0,
      });
    }
  }

  const primary = payload.rate_limits?.primary;
  if (primary && (!state.window || at > state.window.at)) {
    const w = windowFromRateLimit(primary, 'Quota', at);
    if (w) state.window = w;
  }
}

// --- driver ---------------------------------------------------------------

const PARSERS: Record<
  LocalLogProvider,
  { roots: () => string[]; line: (line: string, state: FileScanState) => void }
> = {
  'claude-code': { roots: claudeRoots, line: parseClaudeLine },
  codex: { roots: codexRoots, line: parseCodexLine },
};

/**
 * Scan a provider's logs, reusing `cache` so only newly-appended bytes are read.
 * Returns the merged entries, the newest quota window, and the cache to persist.
 */
export async function scanProviderLogs(
  provider: LocalLogProvider,
  cache: ScanCache,
  sinceMs: number,
): Promise<ScanResult> {
  const parser = PARSERS[provider];
  const next: ScanCache = {};
  const entries: RawUsageEntry[] = [];
  let window: RawWindow | undefined;

  for (const root of parser.roots()) {
    for (const file of await collectLogFiles(root, sinceMs)) {
      const prev: FileScanState | undefined = cache[file.path];
      let state: FileScanState;

      if (prev && prev.mtimeMs === file.mtimeMs && prev.size === file.size) {
        // Untouched since the last scan — reuse what we already extracted.
        state = prev;
      } else {
        // Appended to: stream only the new tail. New file, or one that was
        // truncated/rotated behind our offset: read it from the start.
        const resumable = prev !== undefined && file.size >= prev.offset ? prev : null;
        state = resumable
          ? { ...resumable, mtimeMs: file.mtimeMs, size: file.size }
          : { offset: 0, mtimeMs: file.mtimeMs, size: file.size, entries: [] };
        try {
          state.offset = await readNewLines(file.path, resumable?.offset ?? 0, (l) =>
            parser.line(l, state),
          );
        } catch {
          continue; // unreadable / vanished mid-scan; skip rather than fail it all
        }
      }

      // Keep the cache bounded: events past the retention horizon can never be
      // reported again, so drop them rather than carry them forever.
      state.entries = state.entries.filter((e) => e.at >= sinceMs);
      next[file.path] = state;

      for (const entry of state.entries) entries.push(entry);
      if (state.window && (!window || state.window.at > window.at)) window = state.window;
    }
  }

  return { entries, window, cache: next };
}
