import { appendFileSync, mkdirSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tempDir } from '../../test/main/fixtures';
import { retentionSinceMs, type ScanCache, scanProviderLogs } from './logParsers';

/**
 * Token usage is read straight out of the CLIs' own session logs, which are append-only JSONL
 * files that reach hundreds of megabytes. The scan therefore remembers a byte offset per file and
 * only reads what was appended since last time, so these tests care as much about the resume
 * bookkeeping as about the parsing itself.
 *
 * The providers are located through environment variables (CLAUDE_CONFIG_DIR, CODEX_HOME), which
 * is what lets a test point them at a temp folder.
 */

const HOUR_MS = 3_600_000;

let root = '';
let now = 0;

function claudeLine(fields: {
  at: number;
  model: string;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  id?: string;
}): string {
  return `${JSON.stringify({
    type: 'assistant',
    timestamp: new Date(fields.at).toISOString(),
    message: {
      id: fields.id,
      model: fields.model,
      usage: {
        input_tokens: fields.input ?? 0,
        output_tokens: fields.output ?? 0,
        cache_read_input_tokens: fields.cacheRead ?? 0,
        cache_creation_input_tokens: fields.cacheWrite ?? 0,
      },
    },
  })}\n`;
}

function codexTurnContext(model: string, at: number): string {
  return `${JSON.stringify({
    timestamp: new Date(at).toISOString(),
    type: 'turn_context',
    payload: { type: 'turn_context', model },
  })}\n`;
}

function codexTokenCount(fields: {
  at: number;
  input?: number;
  cached?: number;
  output?: number;
  reasoning?: number;
  usedPercent?: number;
  resetsAt?: number;
}): string {
  return `${JSON.stringify({
    timestamp: new Date(fields.at).toISOString(),
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: fields.input ?? 0,
          cached_input_tokens: fields.cached ?? 0,
          output_tokens: fields.output ?? 0,
          reasoning_output_tokens: fields.reasoning ?? 0,
        },
      },
      rate_limits:
        fields.usedPercent === undefined
          ? null
          : { primary: { used_percent: fields.usedPercent, resets_at: fields.resetsAt } },
    },
  })}\n`;
}

/** Writes a Claude session transcript and returns its path. */
function writeClaudeLog(name: string, lines: string[]): string {
  const dir = join(root, 'claude', 'projects', 'demo');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, lines.join(''), 'utf-8');
  return file;
}

function writeCodexLog(name: string, lines: string[]): string {
  const dir = join(root, 'codex', 'sessions', '2026', '09', '17');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, lines.join(''), 'utf-8');
  return file;
}

async function scanClaude(cache: ScanCache = {}, sinceMs = now - 7 * 24 * HOUR_MS) {
  return scanProviderLogs('claude-code', cache, sinceMs);
}

async function scanCodex(cache: ScanCache = {}, sinceMs = now - 7 * 24 * HOUR_MS) {
  return scanProviderLogs('codex', cache, sinceMs);
}

beforeEach(() => {
  root = tempDir('agentmate-usage-logs-');
  now = Date.UTC(2026, 8, 17, 12, 0, 0);
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv('CLAUDE_CONFIG_DIR', join(root, 'claude'));
  vi.stubEnv('CODEX_HOME', join(root, 'codex'));
  // homedir() is the fallback root, and it must not be reached during a test.
  vi.stubEnv('HOME', join(root, 'home'));
  vi.stubEnv('USERPROFILE', join(root, 'home'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('retentionSinceMs', () => {
  it('keeps a day of slack over the 30 days that get reported', () => {
    // A boundary event must not vanish between the scan and the report.
    expect(retentionSinceMs()).toBe(now - 31 * 24 * HOUR_MS);
  });
});

describe('Claude Code logs', () => {
  it('reads token counts, the model and the message id', async () => {
    writeClaudeLog('session.jsonl', [
      claudeLine({
        at: now - HOUR_MS,
        model: 'test-model',
        input: 100,
        output: 20,
        cacheRead: 5,
        cacheWrite: 7,
        id: 'msg_1',
      }),
    ]);

    const result = await scanClaude();

    expect(result.entries).toEqual([
      {
        at: now - HOUR_MS,
        model: 'test-model',
        input: 100,
        output: 20,
        cacheRead: 5,
        cacheWrite: 7,
        id: 'msg_1',
      },
    ]);
  });

  it('ignores lines with no usage block, malformed JSON and unusable timestamps', async () => {
    writeClaudeLog('session.jsonl', [
      `${JSON.stringify({ type: 'user', timestamp: new Date(now).toISOString() })}\n`,
      '{ not json at all\n',
      '\n',
      `${JSON.stringify({ timestamp: 'not-a-date', message: { model: 'test-model', usage: { input_tokens: 5 } } })}\n`,
      // A usage block with no model cannot be priced, so it is not an event.
      `${JSON.stringify({ timestamp: new Date(now).toISOString(), message: { usage: { input_tokens: 5 } } })}\n`,
      claudeLine({ at: now, model: 'test-model', input: 1 }),
    ]);

    const result = await scanClaude();

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.input).toBe(1);
  });

  it('finds logs in nested project folders', async () => {
    const deep = join(root, 'claude', 'projects', 'a', 'b', 'c');
    mkdirSync(deep, { recursive: true });
    writeFileSync(
      join(deep, 'deep.jsonl'),
      claudeLine({ at: now, model: 'test-model', input: 3 }),
      'utf-8',
    );

    const result = await scanClaude();

    expect(result.entries).toHaveLength(1);
  });

  it('leaves non-jsonl files alone', async () => {
    const dir = join(root, 'claude', 'projects', 'demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'notes.json'), claudeLine({ at: now, model: 'test-model' }), 'utf-8');

    expect((await scanClaude()).entries).toEqual([]);
  });

  it('resolves to nothing when the provider was never installed', async () => {
    const result = await scanClaude();

    expect(result.entries).toEqual([]);
    expect(result.cache).toEqual({});
  });

  it('only parses the bytes appended since the last scan', async () => {
    const file = writeClaudeLog('session.jsonl', [
      claudeLine({ at: now - 2 * HOUR_MS, model: 'test-model', input: 10, id: 'a' }),
    ]);

    const first = await scanClaude();
    expect(first.entries).toHaveLength(1);
    const offsetAfterFirst = first.cache[file]?.offset;
    expect(offsetAfterFirst).toBeGreaterThan(0);

    // The CLI appends another turn, and the mtime moves with it.
    appendFileSync(
      file,
      claudeLine({ at: now - HOUR_MS, model: 'test-model', input: 20, id: 'b' }),
    );
    vi.setSystemTime(now + 1_000);

    const second = await scanClaude(first.cache);

    // Both events are reported, and the new one was read from the stored offset.
    expect(second.entries.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(second.cache[file]?.offset).toBeGreaterThan(offsetAfterFirst ?? 0);
  });

  it('reuses what it already extracted when a file has not changed', async () => {
    const file = writeClaudeLog('session.jsonl', [
      claudeLine({ at: now, model: 'test-model', input: 10, id: 'a' }),
    ]);

    const first = await scanClaude();
    // Rewriting the file's content without touching size or mtime would be invisible, which is
    // exactly the shortcut being asserted: an untouched file is not re-read.
    writeFileSync(
      file,
      claudeLine({ at: now, model: 'other-model', input: 99, id: 'zz' }),
      'utf-8',
    );
    const stateBefore = { ...first.cache[file], mtimeMs: first.cache[file]?.mtimeMs ?? 0 };
    const cache: ScanCache = { [file]: { ...stateBefore } as ScanCache[string] };

    const second = await scanProviderLogs('claude-code', cache, now - 7 * 24 * HOUR_MS);

    expect(second.entries.map((entry) => entry.id)).toEqual(['a']);
  });

  it('holds back a half-written last line until it is complete', async () => {
    const complete = claudeLine({ at: now - HOUR_MS, model: 'test-model', input: 10, id: 'a' });
    const partial = claudeLine({ at: now, model: 'test-model', input: 20, id: 'b' }).slice(0, 40);
    const file = writeClaudeLog('session.jsonl', [complete, partial]);

    const first = await scanClaude();

    // The truncated tail is not an event yet, and the offset stopped at the line boundary.
    expect(first.entries.map((entry) => entry.id)).toEqual(['a']);
    expect(first.cache[file]?.offset).toBe(Buffer.byteLength(complete, 'utf-8'));

    // The CLI finishes writing that line.
    writeFileSync(
      file,
      complete + claudeLine({ at: now, model: 'test-model', input: 20, id: 'b' }),
      'utf-8',
    );
    vi.setSystemTime(now + 1_000);

    const second = await scanClaude(first.cache);
    expect(second.entries.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('starts over when a log was rotated behind the stored offset', async () => {
    const file = writeClaudeLog('session.jsonl', [
      claudeLine({ at: now - 2 * HOUR_MS, model: 'test-model', input: 10, id: 'a' }),
      claudeLine({ at: now - 2 * HOUR_MS, model: 'test-model', input: 10, id: 'b' }),
    ]);
    const first = await scanClaude();
    expect(first.entries).toHaveLength(2);

    // A shorter file cannot be a continuation of the one that was read.
    truncateSync(file, 0);
    writeFileSync(
      file,
      claudeLine({ at: now, model: 'test-model', input: 1, id: 'fresh' }),
      'utf-8',
    );
    vi.setSystemTime(now + 1_000);

    const second = await scanClaude(first.cache);

    expect(second.entries.map((entry) => entry.id)).toEqual(['fresh']);
  });

  it('drops events that fell past the retention horizon', async () => {
    writeClaudeLog('session.jsonl', [
      claudeLine({ at: now - 60 * 24 * HOUR_MS, model: 'test-model', input: 10, id: 'old' }),
      claudeLine({ at: now - HOUR_MS, model: 'test-model', input: 10, id: 'recent' }),
    ]);

    const result = await scanClaude({}, now - 31 * 24 * HOUR_MS);

    expect(result.entries.map((entry) => entry.id)).toEqual(['recent']);
    // The cache does not carry them either, or it would grow without bound.
    const cached = Object.values(result.cache)[0];
    expect(cached?.entries.map((entry) => entry.id)).toEqual(['recent']);
  });

  it('skips a file whose mtime is older than the horizon without reading it', async () => {
    writeClaudeLog('stale.jsonl', [
      claudeLine({ at: now, model: 'test-model', input: 10, id: 'in-stale-file' }),
    ]);

    // A horizon past the file's mtime excludes it before a single byte is read. The mtime comes
    // from the filesystem, so it follows the real clock rather than the faked one.
    const result = await scanClaude({}, vi.getRealSystemTime() + 24 * HOUR_MS);

    expect(result.entries).toEqual([]);
    expect(result.cache).toEqual({});
  });
});

describe('Codex logs', () => {
  it('splits cached tokens out of the input count', async () => {
    // Codex reports input_tokens with the cached ones already included, so adding both would
    // double-count them in the total.
    writeCodexLog('rollout.jsonl', [
      codexTurnContext('test-model', now - 2 * HOUR_MS),
      codexTokenCount({ at: now - HOUR_MS, input: 1_000, cached: 400, output: 50, reasoning: 25 }),
    ]);

    const result = await scanCodex();

    expect(result.entries).toEqual([
      {
        at: now - HOUR_MS,
        model: 'test-model',
        input: 600,
        output: 75,
        cacheRead: 400,
        cacheWrite: 0,
      },
    ]);
  });

  it('applies the model from the turn context to the events that follow', async () => {
    writeCodexLog('rollout.jsonl', [
      codexTurnContext('first-model', now - 3 * HOUR_MS),
      codexTokenCount({ at: now - 3 * HOUR_MS, input: 10, output: 1 }),
      codexTurnContext('second-model', now - 2 * HOUR_MS),
      codexTokenCount({ at: now - HOUR_MS, input: 20, output: 2 }),
    ]);

    const result = await scanCodex();

    expect(result.entries.map((entry) => entry.model)).toEqual(['first-model', 'second-model']);
  });

  it('remembers the model across a resumed read', async () => {
    // The model line stays in the part already consumed, so without carry-over state the next
    // chunk's events would be attributed to the fallback model.
    const file = writeCodexLog('rollout.jsonl', [
      codexTurnContext('test-model', now - 3 * HOUR_MS),
      codexTokenCount({ at: now - 3 * HOUR_MS, input: 10, output: 1 }),
    ]);

    const first = await scanCodex();
    expect(first.cache[file]?.model).toBe('test-model');

    appendFileSync(file, codexTokenCount({ at: now - HOUR_MS, input: 20, output: 2 }));
    vi.setSystemTime(now + 1_000);

    const second = await scanCodex(first.cache);

    expect(second.entries.map((entry) => entry.model)).toEqual(['test-model', 'test-model']);
  });

  it('ignores a token count with nothing in it', async () => {
    writeCodexLog('rollout.jsonl', [
      codexTurnContext('test-model', now),
      codexTokenCount({ at: now }),
    ]);

    expect((await scanCodex()).entries).toEqual([]);
  });

  it('reports the newest quota window and its reset time', async () => {
    const resetsAt = Math.floor((now + 4 * HOUR_MS) / 1000);
    writeCodexLog('rollout.jsonl', [
      codexTurnContext('test-model', now - 3 * HOUR_MS),
      codexTokenCount({ at: now - 3 * HOUR_MS, input: 10, output: 1, usedPercent: 12.4 }),
      codexTokenCount({ at: now - HOUR_MS, input: 10, output: 1, usedPercent: 63.7, resetsAt }),
    ]);

    const result = await scanCodex();

    expect(result.window).toMatchObject({
      label: 'Quota',
      used: 64,
      total: 100,
      percent: 63.7,
      resetAt: new Date(resetsAt * 1000).toISOString(),
      at: now - HOUR_MS,
    });
  });

  it('keeps a percentage inside 0 to 100 and allows a missing reset time', async () => {
    writeCodexLog('rollout.jsonl', [
      codexTokenCount({ at: now, input: 10, output: 1, usedPercent: 140 }),
    ]);

    const result = await scanCodex();

    expect(result.window?.percent).toBe(100);
    expect(result.window?.resetAt).toBeNull();
  });

  it('prefers the newest window across several session files', async () => {
    writeCodexLog('older.jsonl', [
      codexTokenCount({ at: now - 5 * HOUR_MS, input: 10, output: 1, usedPercent: 10 }),
    ]);
    writeCodexLog('newer.jsonl', [
      codexTokenCount({ at: now - HOUR_MS, input: 10, output: 1, usedPercent: 80 }),
    ]);

    const result = await scanCodex();

    expect(result.window?.percent).toBe(80);
  });
});
