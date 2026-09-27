import { spawn } from 'node:child_process';
import type {
  TextSearchFileMatches,
  TextSearchLine,
  TextSearchRequest,
  TextSearchSummary,
} from '../../shared/apiTypes';
import { buildTextSearchArgs } from './rgArgs';
import { createLineSplitter, parseRgMatch, toSearchLine } from './rgJson';
import { ripgrepPath } from './ripgrepPath';

/**
 * Past these a result list stops being something to read, and the window would be holding
 * megabytes of lines nobody scrolls to.
 */
export const MAX_TEXT_MATCHES = 2000;
export const MAX_TEXT_FILES = 500;
/** Results go to the window at least this often while ripgrep runs... */
const FLUSH_MS = 50;
/** ...or as soon as this many have piled up. */
const FLUSH_MATCHES = 200;
const MAX_STDERR = 4096;

export interface TextSearchLimits {
  maxMatches?: number;
  maxFiles?: number;
  flushMatches?: number;
}

export interface TextSearchJob {
  /** Who asked, usually a window. One search runs per owner; a new one stops the last. */
  ownerId: string | number;
  requestId: string;
  folder: string;
  request: TextSearchRequest;
  onBatch: (files: TextSearchFileMatches[]) => void;
  limits?: TextSearchLimits;
  /** Stands in for the bundled binary in tests. Null means it is missing. */
  rgPath?: string | null;
}

interface Running {
  requestId: string;
  cancel: () => void;
}

const running = new Map<string | number, Running>();

/** Stops a search by its id. False when it has already finished. */
export function cancelTextSearch(requestId: string): boolean {
  for (const job of running.values()) {
    if (job.requestId === requestId) {
      job.cancel();
      return true;
    }
  }
  return false;
}

/** Stops whatever an owner has running, such as when its window closes. */
export function cancelOwnerSearch(ownerId: string | number): void {
  running.get(ownerId)?.cancel();
}

/** ripgrep's complaint in one line the search box can show. */
export function describeRgError(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.some((line) => line.includes('regex parse error'))) {
    const reason = lines
      .find((line) => line.startsWith('error:'))
      ?.slice('error:'.length)
      .trim();
    return reason ? `Invalid regular expression: ${reason}` : 'Invalid regular expression.';
  }
  return (lines[0] ?? 'The search failed.').replace(/^rg:\s*/, '');
}

/**
 * Runs one text search with ripgrep, handing results over in batches while it runs, and
 * resolves with the totals once it stops. It never rejects: a failure is in the summary.
 */
export function runTextSearch(job: TextSearchJob): Promise<TextSearchSummary> {
  const started = Date.now();
  const maxMatches = Math.min(
    job.limits?.maxMatches ?? MAX_TEXT_MATCHES,
    job.request.maxMatches ?? Infinity,
  );
  const maxFiles = job.limits?.maxFiles ?? MAX_TEXT_FILES;
  const flushMatches = job.limits?.flushMatches ?? FLUSH_MATCHES;
  const summary = (extra: Partial<TextSearchSummary>): TextSearchSummary => ({
    requestId: job.requestId,
    matches: 0,
    files: 0,
    truncated: false,
    cancelled: false,
    elapsedMs: Date.now() - started,
    ...extra,
  });

  const rg = job.rgPath === undefined ? ripgrepPath() : job.rgPath;
  if (!rg)
    return Promise.resolve(
      summary({ unavailable: true, error: 'Text search is not available in this build.' }),
    );
  let args: string[];
  try {
    args = buildTextSearchArgs(job.request);
  } catch (error) {
    return Promise.resolve(summary({ error: (error as Error).message }));
  }

  cancelOwnerSearch(job.ownerId);

  return new Promise((resolve) => {
    const child = spawn(rg, args, {
      cwd: job.folder,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const seen = new Set<string>();
    let pending = new Map<string, TextSearchLine[]>();
    let pendingCount = 0;
    let matches = 0;
    let truncated = false;
    let cancelled = false;
    let stopped = false;
    let stderr = '';
    let timer: NodeJS.Timeout | null = null;
    let settled = false;

    function flush(): void {
      if (timer) clearTimeout(timer);
      timer = null;
      if (pendingCount === 0) return;
      const files = Array.from(pending, ([path, lines]) => ({ path, matches: lines }));
      pending = new Map();
      pendingCount = 0;
      job.onBatch(files);
    }

    function stop(): void {
      if (stopped) return;
      stopped = true;
      child.kill();
    }

    function finish(extra: Partial<TextSearchSummary>): void {
      if (settled) return;
      settled = true;
      if (running.get(job.ownerId)?.requestId === job.requestId) running.delete(job.ownerId);
      if (!cancelled) flush();
      if (timer) clearTimeout(timer);
      resolve(summary({ matches, files: seen.size, truncated, cancelled, ...extra }));
    }

    running.set(job.ownerId, {
      requestId: job.requestId,
      cancel: () => {
        cancelled = true;
        stop();
      },
    });

    const splitter = createLineSplitter((line) => {
      if (stopped) return;
      const match = parseRgMatch(line);
      if (!match) return;
      if (!seen.has(match.path)) {
        if (seen.size >= maxFiles) {
          truncated = true;
          stop();
          return;
        }
        seen.add(match.path);
      }
      const lines = pending.get(match.path);
      const found = toSearchLine(match.text, match.line, match.spans);
      if (lines) lines.push(found);
      else pending.set(match.path, [found]);
      pendingCount += 1;
      matches += 1;
      if (matches >= maxMatches) {
        truncated = true;
        stop();
      }
      if (pendingCount >= flushMatches) flush();
      else timer ??= setTimeout(flush, FLUSH_MS);
    });

    child.stdout.on('data', (chunk: Buffer) => splitter.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR) stderr += chunk.toString('utf-8');
    });
    child.on('error', (error) => finish({ error: error.message }));
    child.on('close', (code) => {
      if (!stopped) splitter.end();
      // ripgrep exits with 2 for any error, even an unreadable file among good results, so
      // only a run that found nothing is treated as a failure.
      const failed = code === 2 && matches === 0 && !stopped && stderr.trim();
      finish(failed ? { error: describeRgError(stderr) } : {});
    });
  });
}
