import { afterEach, describe, expect, it } from 'vitest';
import { clearHistorySources, historySource, rememberHistorySource } from './historySources';

/**
 * The map from a listed conversation to where it lives on disk. It is keyed by agent and id
 * together, because two agents can hand out the same id.
 */

afterEach(clearHistorySources);

describe('history sources', () => {
  it('finds what was remembered by agent and id', () => {
    rememberHistorySource('claude-code', 'abc', { path: '/p/abc.jsonl', mtimeMs: 5 });
    expect(historySource('claude-code', 'abc')).toEqual({ path: '/p/abc.jsonl', mtimeMs: 5 });
  });

  it('knows nothing of an id it was not given', () => {
    expect(historySource('claude-code', 'abc')).toBeUndefined();
  });

  it('keeps the same id under two agents apart', () => {
    rememberHistorySource('claude-code', 'abc', { path: '/claude/abc.jsonl', mtimeMs: 1 });
    rememberHistorySource('codex', 'abc', { path: '/codex/abc.jsonl', mtimeMs: 2 });

    expect(historySource('claude-code', 'abc')?.path).toBe('/claude/abc.jsonl');
    expect(historySource('codex', 'abc')?.path).toBe('/codex/abc.jsonl');
    expect(historySource('opencode', 'abc')).toBeUndefined();
  });

  it('is not fooled by an agent and id that run together into another pair', () => {
    rememberHistorySource('codex', 'xabc', { path: '/codex/xabc.jsonl', mtimeMs: 1 });
    expect(historySource('codexx', 'abc')).toBeUndefined();
    expect(historySource('codex', 'xabc')).toBeDefined();
  });

  it('replaces a source when the same conversation is listed again', () => {
    rememberHistorySource('opencode', 'ses_1', { path: '/db#ses_1', mtimeMs: 1, dbPath: '/db' });
    rememberHistorySource('opencode', 'ses_1', { path: '/db#ses_1', mtimeMs: 9, dbPath: '/db' });
    expect(historySource('opencode', 'ses_1')).toEqual({
      path: '/db#ses_1',
      mtimeMs: 9,
      dbPath: '/db',
    });
  });

  it('forgets everything on request', () => {
    rememberHistorySource('claude-code', 'abc', { path: '/p/abc.jsonl', mtimeMs: 5 });
    clearHistorySources();
    expect(historySource('claude-code', 'abc')).toBeUndefined();
  });
});
