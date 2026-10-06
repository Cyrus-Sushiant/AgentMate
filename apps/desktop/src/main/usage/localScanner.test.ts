import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The local-log driver for Codex, from rollout files on disk to the card's plan limits. The scan
 * runs in-process here (there is no bundled worker in a test run), which is the fallback the app
 * takes when its worker cannot start. What matters is that Codex gets a subscription block built
 * from its newest rate-limit snapshot, and that a scan cache written before limits were kept is
 * thrown away rather than leaving the weekly window missing until Codex touches every file.
 */

const paths = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => paths.userData } }));
vi.mock('./claudeAccount', () => ({
  readClaudeAccount: async () => ({ mode: 'api' }),
  getLiveWindows: async () => null,
}));

const HOUR_MS = 3_600_000;
let root: string;
let now: number;

function codexLine(at: number, rateLimits: Record<string, unknown> | null): string {
  return `${JSON.stringify({
    timestamp: new Date(at).toISOString(),
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: { last_token_usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 2 } },
      rate_limits: rateLimits,
    },
  })}\n`;
}

function writeRollout(lines: string[]): string {
  const dir = join(root, 'codex', 'sessions', '2026', '10', '05');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'rollout.jsonl');
  writeFileSync(file, lines.join(''), 'utf-8');
  return file;
}

/** A fresh module graph each time, since the scan cache is loaded once per process. */
async function scanCodex() {
  vi.resetModules();
  const { scanLocalProvider } = await import('./localScanner');
  return scanLocalProvider('codex');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'agentmate-local-scanner-'));
  paths.userData = join(root, 'userData');
  mkdirSync(paths.userData, { recursive: true });
  now = Date.UTC(2026, 9, 5, 12, 0, 0);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.stubEnv('CODEX_HOME', join(root, 'codex'));
  vi.stubEnv('CLAUDE_CONFIG_DIR', join(root, 'claude'));
  vi.stubEnv('HOME', join(root, 'home'));
  vi.stubEnv('USERPROFILE', join(root, 'home'));
  // The missing worker is reported once per scan; it is expected here.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('scanLocalProvider for Codex', () => {
  it("gives a ChatGPT plan's session and weekly limits to the card", async () => {
    const sessionReset = Math.floor((now + 2 * HOUR_MS) / 1000);
    const weekReset = Math.floor((now + 50 * HOUR_MS) / 1000);
    writeRollout([
      codexLine(now - HOUR_MS, {
        primary: { used_percent: 22, window_minutes: 300, resets_at: sessionReset },
        secondary: { used_percent: 41, window_minutes: 10080, resets_at: weekReset },
        plan_type: 'plus',
      }),
    ]);

    const usage = await scanCodex();

    expect(usage.subscription).toEqual({
      mode: 'subscription',
      plan: { id: 'plus', label: 'Plus' },
      windows: [
        {
          key: 'session',
          label: 'Session (5h)',
          percent: 22,
          resetAt: new Date(sessionReset * 1000).toISOString(),
        },
        {
          key: 'week',
          label: 'Weekly',
          percent: 41,
          resetAt: new Date(weekReset * 1000).toISOString(),
        },
      ],
      source: 'account',
    });
    // The token view's quota bar still reads the primary window, as it did before.
    expect(usage.window).toMatchObject({ label: 'Quota', percent: 22 });
  });

  it('gives an API key login no plan limits', async () => {
    writeRollout([codexLine(now - HOUR_MS, null)]);

    const usage = await scanCodex();

    expect(usage.subscription).toBeUndefined();
    expect(usage.today.tokens.total).toBeGreaterThan(0);
  });

  it('rereads a log cached by a build that did not keep the limits', async () => {
    const file = writeRollout([
      codexLine(now - HOUR_MS, {
        primary: { used_percent: 21, window_minutes: 43200 },
        secondary: null,
        plan_type: 'free',
      }),
    ]);
    const info = statSync(file);
    // What the previous build left behind: the file fully read, but no `limits` kept. Reused as
    // is, it would hide Codex's limits until Codex next wrote to this file.
    writeFileSync(
      join(paths.userData, 'usage-scan-cache.json'),
      JSON.stringify({
        version: 1,
        providers: {
          codex: {
            [file]: { offset: info.size, mtimeMs: info.mtimeMs, size: info.size, entries: [] },
          },
        },
      }),
    );

    const usage = await scanCodex();

    expect(usage.subscription?.windows).toEqual([
      { key: 'month', label: 'Monthly', percent: 21, resetAt: null },
    ]);
    const saved = JSON.parse(readFileSync(join(paths.userData, 'usage-scan-cache.json'), 'utf-8'));
    expect(saved.version).toBe(2);
    expect(saved.providers.codex[file].limits.planType).toBe('free');
  });
});
