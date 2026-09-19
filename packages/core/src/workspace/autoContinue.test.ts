import { describe, expect, it } from 'vitest';
import { detectAutoContinueSignal, parseLimitReset, terminalPlainText } from './autoContinue.js';

/** 2026-09-19 10:00 UTC. */
const NOW = Date.UTC(2026, 8, 19, 10, 0);

describe('terminalPlainText', () => {
  it('drops colors without splitting words and turns cursor moves into spaces', () => {
    expect(terminalPlainText('\x1b[1m5-hour\x1b[22m limit\x1b[2Creached')).toBe(
      '5-hour limit reached',
    );
  });

  it('drops window title sequences', () => {
    expect(terminalPlainText('\x1b]0;claude\x07API Error: Connection error.')).toBe(
      'API Error: Connection error.',
    );
  });
});

describe('parseLimitReset', () => {
  it('reads a clock time in a named zone as its next occurrence', () => {
    expect(parseLimitReset('resets 3pm (UTC)', NOW)).toBe(Date.UTC(2026, 8, 19, 15, 0));
    expect(parseLimitReset('resets 9am (UTC)', NOW)).toBe(Date.UTC(2026, 8, 20, 9, 0));
    expect(parseLimitReset('resets 12:30pm (Europe/Istanbul)', NOW)).toBe(
      Date.UTC(2026, 8, 19, 9, 30) + 24 * 60 * 60 * 1000,
    );
    expect(parseLimitReset('resets 3pm (America/Los_Angeles)', NOW)).toBe(
      Date.UTC(2026, 8, 19, 22, 0),
    );
  });

  it('keeps a time that just turned over as today', () => {
    expect(parseLimitReset('resets 10am (UTC)', NOW + 30_000)).toBe(NOW);
  });

  it('reads a date and time', () => {
    expect(parseLimitReset('resets Oct 9, 10am (UTC)', NOW)).toBe(Date.UTC(2026, 9, 9, 10, 0));
    expect(parseLimitReset('try again at Sep 21st, 2026 5:34 PM', NOW)).toBe(
      new Date(2026, 8, 21, 17, 34).getTime(),
    );
  });

  it('rolls a date that has passed into next year', () => {
    expect(parseLimitReset('resets Jan 2, 10am (UTC)', NOW)).toBe(Date.UTC(2027, 0, 2, 10, 0));
  });

  it('reads a local clock time when no zone is given', () => {
    const at = parseLimitReset('Your limit will reset at 11:45 pm', NOW);
    const local = new Date(at ?? 0);
    expect([local.getHours(), local.getMinutes()]).toEqual([23, 45]);
    expect(at).toBeGreaterThan(NOW);
  });

  it('reads a relative wait', () => {
    expect(parseLimitReset('or try again in 2 hours 13 minutes.', NOW)).toBe(
      NOW + (2 * 60 + 13) * 60_000,
    );
    expect(parseLimitReset('try again in 4 days, 1 hour and 5 mins', NOW)).toBe(
      NOW + ((4 * 24 + 1) * 60 + 5) * 60_000,
    );
  });

  it('reads the epoch form', () => {
    expect(parseLimitReset('Claude AI usage limit reached|1790000000', NOW)).toBe(
      1_790_000_000_000,
    );
  });

  it('gives up on text with no usable time', () => {
    expect(parseLimitReset('resets soon', NOW)).toBeNull();
    expect(parseLimitReset('resets 3', NOW)).toBeNull();
    expect(parseLimitReset('resets 13pm', NOW)).toBeNull();
  });
});

describe('detectAutoContinueSignal', () => {
  it('spots Claude Code limit messages', () => {
    expect(detectAutoContinueSignal('5-hour limit reached ∙ resets 3pm (UTC)', NOW)).toEqual({
      kind: 'limit',
      resetAt: Date.UTC(2026, 8, 19, 15, 0),
    });
    expect(
      detectAutoContinueSignal("You've hit your limit · resets 3pm (UTC) /upgrade", NOW),
    ).toEqual({ kind: 'limit', resetAt: Date.UTC(2026, 8, 19, 15, 0) });
    expect(detectAutoContinueSignal('Weekly limit reached', NOW)).toEqual({
      kind: 'limit',
      resetAt: null,
    });
  });

  it('spots Codex limit messages', () => {
    expect(
      detectAutoContinueSignal(
        "■ You've hit your usage limit. Upgrade to Pro, or try again in 32 minutes.",
        NOW,
      ),
    ).toEqual({ kind: 'limit', resetAt: NOW + 32 * 60_000 });
  });

  it('spots network failures the CLIs stop on', () => {
    for (const line of [
      '⎿ API Error: Connection error.',
      '⎿ API Error: Request timed out.',
      'API Error (fetch failed)',
      'API Error: 529 {"type":"error","error":{"type":"overloaded_error"}}',
      'Unable to connect to API due to poor internet connection',
      '■ stream disconnected before completion: error sending request',
      'exceeded retry limit, last status: 502 Bad Gateway',
      'getaddrinfo ENOTFOUND api.anthropic.com',
    ]) {
      expect(detectAutoContinueSignal(line, NOW), line).toEqual({ kind: 'network' });
    }
  });

  it('ignores ordinary output that mentions the same words', () => {
    for (const line of [
      'Added a retry when the socket emits ECONNRESET',
      'The rate limiter allows 5 requests per second',
      'Build succeeded',
      'The limit is reached when the queue is full',
      'Max retries limit reached, giving up',
    ]) {
      expect(detectAutoContinueSignal(line, NOW), line).toBeNull();
    }
  });
});
