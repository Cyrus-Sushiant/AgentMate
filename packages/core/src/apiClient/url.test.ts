import { describe, expect, it } from 'vitest';
import { buildRawUrl, parseQuery, parseRawUrl, replaceQuery, syncParamsFromUrl } from './url.js';

/**
 * The URL bar and the Params table edit the same thing. These check that each side can be
 * rebuilt from the other without losing what the user typed, including `{{variables}}`, which
 * must never be encoded or split.
 */

describe('parseQuery', () => {
  it('reads key and value pairs after the first question mark', () => {
    expect(parseQuery('https://api.test/users?page=2&sort=name')).toEqual([
      { key: 'page', value: '2' },
      { key: 'sort', value: 'name' },
    ]);
  });

  it('keeps a key with no value, and splits only on the first equals sign', () => {
    expect(parseQuery('/x?flag&token=a=b')).toEqual([
      { key: 'flag', value: '' },
      { key: 'token', value: 'a=b' },
    ]);
  });

  it('leaves variables and percent escapes exactly as typed', () => {
    expect(parseQuery('{{base}}/x?q={{term}}&s=a%20b')).toEqual([
      { key: 'q', value: '{{term}}' },
      { key: 's', value: 'a%20b' },
    ]);
  });

  it('stops at the fragment and ignores empty pieces', () => {
    expect(parseQuery('/x?a=1&&b=2#section?c=3')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('answers an empty list when there is no query', () => {
    expect(parseQuery('https://api.test/users')).toEqual([]);
    expect(parseQuery('')).toEqual([]);
  });
});

describe('replaceQuery', () => {
  it('writes the enabled pairs in place of the old query', () => {
    expect(
      replaceQuery('https://api.test/users?old=1', [
        { key: 'page', value: '2', enabled: true },
        { key: 'skip', value: 'x', enabled: false },
        { key: 'flag', value: '', enabled: true },
      ]),
    ).toBe('https://api.test/users?page=2&flag');
  });

  it('drops the question mark when nothing is enabled', () => {
    expect(replaceQuery('https://api.test/users?a=1', [])).toBe('https://api.test/users');
  });

  it('keeps the fragment at the end', () => {
    expect(replaceQuery('/x?a=1#top', [{ key: 'b', value: '2', enabled: true }])).toBe(
      '/x?b=2#top',
    );
  });

  it('skips rows whose key and value are both empty', () => {
    expect(replaceQuery('/x', [{ key: '', value: '', enabled: true }])).toBe('/x');
  });
});

describe('syncParamsFromUrl', () => {
  const row = (id: string, key: string, value: string, enabled = true, description = '') => ({
    id,
    key,
    value,
    enabled,
    description,
  });

  it('replaces enabled rows with what the URL now says, keeping ids and descriptions in order', () => {
    const next = syncParamsFromUrl('/x?a=10&b=2', [
      row('1', 'a', '1', true, 'first'),
      row('2', 'b', '2'),
    ]);
    expect(next).toEqual([row('1', 'a', '10', true, 'first'), row('2', 'b', '2')]);
  });

  it('keeps disabled rows where they were', () => {
    const next = syncParamsFromUrl('/x?a=1&c=3', [
      row('1', 'a', '1'),
      row('2', 'b', '2', false),
      row('3', 'c', '0'),
    ]);
    expect(next.map((r) => [r.key, r.value, r.enabled])).toEqual([
      ['a', '1', true],
      ['b', '2', false],
      ['c', '3', true],
    ]);
  });

  it('adds new rows for extra pairs and drops enabled rows the URL no longer has', () => {
    const next = syncParamsFromUrl('/x?z=9', [row('1', 'a', '1'), row('2', 'b', '2')]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: '1', key: 'z', value: '9', enabled: true });

    const grown = syncParamsFromUrl('/x?a=1&b=2', [row('1', 'a', '1')]);
    expect(grown).toHaveLength(2);
    expect(grown[1]?.id).toBeTruthy();
    expect(grown[1]?.id).not.toBe('1');
  });
});

describe('parseRawUrl', () => {
  it('splits protocol, host, port, path, query and hash', () => {
    expect(parseRawUrl('https://api.example.com:8443/v1/users?id=5#frag')).toEqual({
      raw: 'https://api.example.com:8443/v1/users?id=5#frag',
      protocol: 'https',
      host: ['api', 'example', 'com'],
      port: '8443',
      path: ['v1', 'users'],
      query: [{ key: 'id', value: '5' }],
      hash: 'frag',
    });
  });

  it('keeps a variable host whole', () => {
    expect(parseRawUrl('{{baseUrl}}/users/:id')).toEqual({
      raw: '{{baseUrl}}/users/:id',
      host: ['{{baseUrl}}'],
      path: ['users', ':id'],
      variable: [{ key: 'id', value: '' }],
    });
  });

  it('keeps a trailing slash as an empty path segment, like Postman', () => {
    expect(parseRawUrl('http://localhost/api/').path).toEqual(['api', '']);
  });

  it('treats an empty string as an empty URL', () => {
    expect(parseRawUrl('')).toEqual({ raw: '' });
  });
});

describe('buildRawUrl', () => {
  it('prefers the raw text when it is there', () => {
    expect(buildRawUrl({ raw: 'https://a.test/x', host: ['b'] })).toBe('https://a.test/x');
  });

  it('rebuilds a URL from parts when raw is missing', () => {
    expect(
      buildRawUrl({
        protocol: 'https',
        host: ['api', 'test'],
        port: '8080',
        path: ['v1', 'items'],
        query: [
          { key: 'a', value: '1' },
          { key: 'off', value: '2', disabled: true },
        ],
      }),
    ).toBe('https://api.test:8080/v1/items?a=1');
  });

  it('accepts a plain string, which v2.1 allows for url', () => {
    expect(buildRawUrl('https://a.test')).toBe('https://a.test');
    expect(buildRawUrl(undefined)).toBe('');
  });
});
