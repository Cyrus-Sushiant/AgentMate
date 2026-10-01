import { describe, expect, it } from 'vitest';
import { checkPurgeUrls, PURGE_URL_LIMIT, sslAdvice } from './zone';

describe('sslAdvice', () => {
  it('steers a proxied domain towards Full (strict)', () => {
    expect(sslAdvice('strict')).toMatchObject({ level: 'ok', recommended: 'strict' });
    expect(sslAdvice('origin_pull')).toMatchObject({ level: 'ok', recommended: 'origin_pull' });
    expect(sslAdvice('full')).toMatchObject({ level: 'improve', recommended: 'strict' });
    expect(sslAdvice('flexible')).toMatchObject({ level: 'warning', recommended: 'strict' });
    expect(sslAdvice('off')).toMatchObject({ level: 'warning', recommended: 'strict' });
  });

  it('explains why in words, without leaning on colour', () => {
    expect(sslAdvice('flexible').message).toMatch(/plain HTTP/);
    expect(sslAdvice('full').message).toMatch(/not checked/);
    expect(sslAdvice('off').message).toMatch(/no HTTPS/);
    expect(sslAdvice('strict').message).toMatch(/checks the server's certificate/);
  });
});

describe('checkPurgeUrls', () => {
  it('takes one URL per line, skipping blank lines and repeats', () => {
    expect(checkPurgeUrls('https://example.com/app.css\n\n  https://example.com/a.js \n')).toEqual({
      ok: true,
      urls: ['https://example.com/app.css', 'https://example.com/a.js'],
    });
    expect(checkPurgeUrls('https://example.com/a\nhttps://example.com/a')).toEqual({
      ok: true,
      urls: ['https://example.com/a'],
    });
  });

  it('refuses anything that is not a web address, an empty list and too many at once', () => {
    expect(checkPurgeUrls('  \n ')).toEqual({
      ok: false,
      problem: 'Enter at least one URL to purge.',
    });
    expect(checkPurgeUrls('example.com/app.css')).toEqual({
      ok: false,
      problem: 'example.com/app.css is not a full web address. Start it with https://.',
    });
    expect(checkPurgeUrls('ftp://example.com/file')).toMatchObject({ ok: false });
    expect(checkPurgeUrls(`https://example.com/${'a'.repeat(3000)}`)).toMatchObject({
      ok: false,
    });
    const many = Array.from(
      { length: PURGE_URL_LIMIT + 1 },
      (_, index) => `https://example.com/${index}`,
    );
    expect(checkPurgeUrls(many.join('\n'))).toEqual({
      ok: false,
      problem: `Cloudflare purges up to ${PURGE_URL_LIMIT} URLs at a time.`,
    });
  });
});
