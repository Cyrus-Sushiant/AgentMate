import { describe, expect, it } from 'vitest';
import { displayUrl, isLocalUrl, normalizeAddress } from './address';

describe('normalizeAddress', () => {
  it.each([
    ['localhost:3000', 'http://localhost:3000/'],
    ['localhost', 'http://localhost/'],
    ['127.0.0.1:8080/app', 'http://127.0.0.1:8080/app'],
    ['0.0.0.0:5173', 'http://localhost:5173/'],
    ['[::1]:4000', 'http://[::1]:4000/'],
    ['myapp.localhost:3000', 'http://myapp.localhost:3000/'],
    ['192.168.1.20:5173', 'http://192.168.1.20:5173/'],
  ])('opens local address %s over http', (input, expected) => {
    expect(normalizeAddress(input)).toBe(expected);
  });

  it.each([
    ['example.com', 'https://example.com/'],
    ['docs.github.com/en', 'https://docs.github.com/en'],
    ['http://example.com', 'http://example.com/'],
    ['https://example.com/a?b=1#c', 'https://example.com/a?b=1#c'],
  ])('opens a site %s, adding https when the scheme is missing', (input, expected) => {
    expect(normalizeAddress(input)).toBe(expected);
  });

  it('trims what was typed', () => {
    expect(normalizeAddress('  example.com  ')).toBe('https://example.com/');
  });

  it('keeps about:blank', () => {
    expect(normalizeAddress('about:blank')).toBe('about:blank');
  });

  it.each(['how to center a div', 'tailwind', 'react useEffect'])('searches for %s', (input) => {
    const url = new URL(normalizeAddress(input) ?? '');
    expect(url.origin).toBe('https://duckduckgo.com');
    expect(url.searchParams.get('q')).toBe(input);
  });

  it.each(['', '   ', 'javascript:alert(1)', 'file:///C:/secret.txt', 'chrome://settings'])(
    'refuses %j',
    (input) => {
      expect(normalizeAddress(input)).toBeNull();
    },
  );
});

describe('isLocalUrl', () => {
  it.each([
    ['http://localhost:3000/', true],
    ['http://127.0.0.1/', true],
    ['http://[::1]:4000/', true],
    ['http://app.localhost:3000/', true],
    ['https://example.com/', false],
    ['not a url', false],
  ])('%s is local: %s', (url, expected) => {
    expect(isLocalUrl(url)).toBe(expected);
  });
});

describe('displayUrl', () => {
  it('drops the scheme and a bare trailing slash', () => {
    expect(displayUrl('http://localhost:5173/')).toBe('localhost:5173');
    expect(displayUrl('https://example.com/pricing?plan=pro')).toBe('example.com/pricing?plan=pro');
  });

  it('leaves other addresses alone', () => {
    expect(displayUrl('about:blank')).toBe('about:blank');
    expect(displayUrl('')).toBe('');
  });
});
