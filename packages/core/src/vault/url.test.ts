import { describe, expect, it } from 'vitest';
import { avatarHue, avatarLetter, hostOf, normalizeUrl } from './url.js';

describe('normalizeUrl', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeUrl('github.com/login')).toBe('https://github.com/login');
  });

  it('keeps an existing scheme', () => {
    expect(normalizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeUrl('ssh://git@host')).toBe('ssh://git@host');
  });

  it('trims whitespace and returns an empty string for blank input', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
    expect(normalizeUrl('   ')).toBe('');
  });
});

describe('hostOf', () => {
  it.each([
    ['https://www.github.com/login', 'github.com'],
    ['github.com', 'github.com'],
    ['http://localhost:3000/x', 'localhost'],
    ['https://192.168.1.10:8443', '192.168.1.10'],
    ['HTTPS://Mail.Google.COM', 'mail.google.com'],
    ['ssh://git@gitlab.example.org:2222/repo', 'gitlab.example.org'],
  ])('%s -> %s', (input, host) => {
    expect(hostOf(input)).toBe(host);
  });

  it('returns an empty string when there is nothing that looks like a host', () => {
    expect(hostOf('')).toBe('');
    expect(hostOf('not a url at all')).toBe('');
    expect(hostOf('http://')).toBe('');
  });
});

describe('avatar helpers', () => {
  it('gives the same hue for the same key and stays in range', () => {
    const hue = avatarHue('github.com');
    expect(hue).toBe(avatarHue('github.com'));
    for (const key of ['a', 'bank.example', 'zz', '']) {
      const value = avatarHue(key);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(360);
    }
  });

  it('spreads different keys across the wheel', () => {
    const hues = new Set(
      ['github.com', 'google.com', 'aws.amazon.com', 'bank.example'].map(avatarHue),
    );
    expect(hues.size).toBeGreaterThan(1);
  });

  it('picks the first letter or digit, uppercased, with a fallback', () => {
    expect(avatarLetter('github')).toBe('G');
    expect(avatarLetter('  #1 bank')).toBe('1');
    expect(avatarLetter('ایمیل')).toBe('ا');
    expect(avatarLetter('!!!')).toBe('?');
  });
});
