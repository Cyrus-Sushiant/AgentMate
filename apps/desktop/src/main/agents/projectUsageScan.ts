import { stat } from 'node:fs/promises';
import {
  collectLogFiles,
  type LocalLogProvider,
  type LogFile,
  type RawUsageEntry,
  type ScanCache,
  scanLogFile,
} from '../usage/logParsers';

// The parsing half of the project usage report. It reads the transcripts of many conversations
// and returns plain token buckets, nothing priced and nothing rendered, so the whole result is
// small enough to cross a worker boundary. It runs on a worker thread (projectUsageWorker.ts):
// a long-lived project is hundreds of MB of JSONL, and parsing that on the main process froze
// every other IPC handler (see usageScanWorker.ts, which learned the same lesson). It must not
// import `electron`.

/** One conversation to read. */
export interface ScanJob {
  /** Names the conversation in the buckets. */
  key: string;
  parser: LocalLogProvider;
  /** The conversation's own transcript. */
  path: string;
  /** Claude Code keeps subagent transcripts in a folder named after the conversation. */
  subagentDir?: string;
  /**
   * Which conversation gets the credit for a message that appears in two of them. Lower wins, so
   * give it the start time: a resumed conversation copies earlier messages from the original.
   */
  order: number;
}

/** Tokens one conversation spent on one model on one local day. */
export interface UsageBucket {
  key: string;
  /** `YYYY-MM-DD` in the local time zone. */
  day: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ScanInput {
  jobs: readonly ScanJob[];
  /** Events before this (epoch ms) are left out; 0 reads everything. */
  sinceMs: number;
  /** Parse state kept from an earlier look, so a repeat only reads what was appended. */
  cache: ScanCache;
}

export interface ScanOutput {
  buckets: UsageBucket[];
  /** The files read this time, to merge into the caller's cache. */
  cache: ScanCache;
  /** Conversations whose transcript could not be read; they are not the same as empty ones. */
  unreadable: string[];
}

/** The calendar day of a moment in the local time zone, like `2026-09-17`. */
export function localDay(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function statLogFile(path: string): Promise<LogFile | null> {
  try {
    const info = await stat(path);
    return info.isFile() ? { path, mtimeMs: info.mtimeMs, size: info.size } : null;
  } catch {
    return null;
  }
}

/**
 * Reads every job and folds its events into buckets.
 *
 * A message is counted once however many files hold it (Claude Code writes a line per content
 * block, and a resumed conversation repeats the messages it continues), and goes to the job with
 * the lowest `order`. A transcript not touched since before `sinceMs` cannot hold an event inside
 * the period, so it is not even opened.
 */
export async function scanProjectBuckets(input: ScanInput): Promise<ScanOutput> {
  const { sinceMs } = input;
  const jobs = [...input.jobs].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const cache: ScanCache = {};
  const seen = new Set<string>();
  const buckets = new Map<string, UsageBucket>();
  const unreadable: string[] = [];

  const add = (key: string, entry: RawUsageEntry): void => {
    if (entry.at < sinceMs) return;
    if (entry.id) {
      if (seen.has(entry.id)) return;
      seen.add(entry.id);
    }
    // Placeholder messages (Claude's "<synthetic>" ones) carry no tokens.
    if (entry.input + entry.output + entry.cacheRead + entry.cacheWrite === 0) return;
    const day = localDay(entry.at);
    const id = `${key}|${day}|${entry.model}`;
    const bucket = buckets.get(id) ?? {
      key,
      day,
      model: entry.model,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    };
    bucket.input += entry.input;
    bucket.output += entry.output;
    bucket.cacheRead += entry.cacheRead;
    bucket.cacheWrite += entry.cacheWrite;
    buckets.set(id, bucket);
  };

  for (const job of jobs) {
    const main = await statLogFile(job.path);
    if (!main) {
      unreadable.push(job.key);
      continue;
    }
    const files: LogFile[] = main.mtimeMs >= sinceMs ? [main] : [];
    if (job.subagentDir) files.push(...(await collectLogFiles(job.subagentDir, sinceMs)));

    for (const file of files) {
      const state = await scanLogFile(job.parser, file, input.cache[file.path]);
      if (!state) {
        if (file === main) unreadable.push(job.key);
        continue; // a subagent log that vanished mid-read
      }
      cache[file.path] = state;
      for (const entry of state.entries) add(job.key, entry);
    }
  }

  return { buckets: [...buckets.values()], cache, unreadable };
}

/**
 * Keeps the most recently written files whose events fit the budget, so remembering every
 * project's history cannot grow without bound. The newest file stays even when it alone is over.
 */
export function trimScanCache(cache: ScanCache, maxEntries: number): ScanCache {
  const newestFirst = Object.entries(cache).sort(([, a], [, b]) => b.mtimeMs - a.mtimeMs);
  const kept: ScanCache = {};
  let used = 0;
  for (const [path, state] of newestFirst) {
    if (used > 0 && used + state.entries.length > maxEntries) break;
    kept[path] = state;
    used += state.entries.length;
  }
  return kept;
}
