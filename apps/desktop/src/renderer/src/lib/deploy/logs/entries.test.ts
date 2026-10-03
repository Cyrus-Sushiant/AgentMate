import { describe, expect, it } from 'vitest';
import {
  auditEntries,
  containerEntries,
  detectLevel,
  entriesAsText,
  filterEntries,
  journalEntries,
  matchingEntries,
  mergeEntries,
  rangeStart,
  siteEntries,
  TIME_RANGES,
} from './entries';

describe('detectLevel', () => {
  it('reads the level from the words, an access status or journald’s priority', () => {
    expect(detectLevel('Error: connect ECONNREFUSED')).toBe('error');
    expect(detectLevel('[error] 29#29: open() failed')).toBe('error');
    expect(detectLevel('level=error msg="x"')).toBe('error');
    expect(detectLevel('warn: retrying database connection')).toBe('warn');
    expect(detectLevel('DEBUG cache hit')).toBe('debug');
    expect(detectLevel('processed job 4 in 40ms')).toBe('info');
    expect(detectLevel('1.2.3.4 - - [x] "GET / HTTP/1.1" 502 12 "-"')).toBe('error');
    expect(detectLevel('1.2.3.4 - - [x] "GET /a HTTP/1.1" 404 12 "-"')).toBe('warn');
    expect(detectLevel('1.2.3.4 - - [x] "GET /error HTTP/1.1" 200 12 "-"')).toBe('info');
    expect(detectLevel('anything', 2)).toBe('error');
    expect(detectLevel('anything', 4)).toBe('warn');
    expect(detectLevel('anything', 7)).toBe('debug');
    expect(detectLevel('fatal crash', 6)).toBe('error');
  });
});

describe('entries from each source', () => {
  it('keeps the time, origin and stream, without colour codes', () => {
    const container = containerEntries(
      [
        { stream: 'stderr', timestamp: 't1', atUnixMs: 20, text: '\u001b[31mError\u001b[0m: boom' },
        { stream: 'stdout', timestamp: 't2', atUnixMs: 30, text: 'ok' },
      ],
      'api',
    );
    expect(container[0]).toEqual({
      key: 'api:t1:0',
      atUnixMs: 20,
      origin: 'api',
      stream: 'err',
      level: 'error',
      text: 'Error: boom',
    });
    expect(container[1]?.stream).toBe('out');

    const journal = journalEntries([{ atUnixMs: 10, priority: 4, text: 'slow' }], 'nginx');
    expect(journal[0]).toMatchObject({ origin: 'nginx', level: 'warn', stream: null });

    const site = siteEntries(['"GET / HTTP/1.1" 500 0 '], 'blog access');
    expect(site[0]).toMatchObject({ atUnixMs: null, level: 'error' });

    const audit = auditEntries([
      {
        id: 2,
        atUnixMs: 5,
        action: 'exec.run',
        result: 'denied',
        parameters: '{"a":1}',
        actorUserName: 'maria',
      },
      { id: 1, atUnixMs: 4, action: 'auth.sign-in', result: 'success', target: 'dev' },
    ]);
    expect(audit.map((e) => [e.origin, e.level, e.text])).toEqual([
      ['the core', 'info', 'auth.sign-in success dev'],
      ['maria', 'warn', 'exec.run denied {"a":1}'],
    ]);
  });
});

describe('merging, filtering, searching and saving', () => {
  const api = containerEntries(
    [
      { stream: 'stdout', timestamp: 'a', atUnixMs: 1_000, text: 'info: one' },
      { stream: 'stderr', timestamp: 'b', atUnixMs: 3_000, text: 'error: three' },
    ],
    'api',
  );
  const web = containerEntries(
    [{ stream: 'stdout', timestamp: 'c', atUnixMs: 2_000, text: 'warn: two' }],
    'web',
  );
  const site = siteEntries(['no time'], 'site');

  it('merges by time with untimed lines last, and filters by level and time', () => {
    const merged = mergeEntries([api, web, site]);
    expect(merged.map((e) => e.text)).toEqual([
      'info: one',
      'warn: two',
      'error: three',
      'no time',
    ]);
    expect(filterEntries(merged, { minLevel: 'warn', since: null }).map((e) => e.text)).toEqual([
      'warn: two',
      'error: three',
    ]);
    expect(filterEntries(merged, { minLevel: 'debug', since: 2_500 }).map((e) => e.text)).toEqual([
      'error: three',
      'no time',
    ]);
    expect(rangeStart('all', 10)).toBeNull();
    expect(rangeStart('15m', 1_000_000)).toBe(100_000);
    expect(TIME_RANGES).toHaveLength(5);
  });

  it('finds matches in the text or the origin and saves the lines as text', () => {
    const merged = mergeEntries([api, web]);
    expect(matchingEntries(merged, 'TWO')).toEqual([1]);
    expect(matchingEntries(merged, 'web')).toEqual([1]);
    expect(matchingEntries(merged, '  ')).toEqual([]);
    expect(entriesAsText([...merged.slice(2), ...site])).toBe(
      '1970-01-01T00:00:03.000Z api ERROR err error: three\n- site INFO no time',
    );
  });
});
