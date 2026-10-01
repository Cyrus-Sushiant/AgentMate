import { describe, expect, it } from 'vitest';
import type { CloudflareRecordInput } from '../cloudflareTypes';
import { isCloudflareId, normalizeHostname, recordName, recordProblem } from './dns';

describe('isCloudflareId', () => {
  it('accepts the 32 hex characters Cloudflare uses for zones, records and rules', () => {
    expect(isCloudflareId('023e105f4ecef8ad9ca31a8372d0c353')).toBe(true);
    expect(isCloudflareId('023E105F4ECEF8AD9CA31A8372D0C353')).toBe(false);
    expect(isCloudflareId('023e105f4ecef8ad9ca31a8372d0c35')).toBe(false);
    expect(isCloudflareId('../zones')).toBe(false);
    expect(isCloudflareId(42)).toBe(false);
  });
});

describe('normalizeHostname', () => {
  it('lowercases a name and drops the trailing dot', () => {
    expect(normalizeHostname('App.Example.COM.')).toBe('app.example.com');
    expect(normalizeHostname('_dmarc.example.com')).toBe('_dmarc.example.com');
    expect(normalizeHostname('localhost')).toBe('localhost');
  });

  it('writes an international name in Punycode, the way Cloudflare stores it', () => {
    expect(normalizeHostname('bücher.example')).toBe('xn--bcher-kva.example');
  });

  it('allows a wildcard only where asked, and only as the first label', () => {
    expect(normalizeHostname('*.example.com')).toBeNull();
    expect(normalizeHostname('*.example.com', { wildcard: true })).toBe('*.example.com');
    expect(normalizeHostname('app.*.example.com', { wildcard: true })).toBeNull();
  });

  it('refuses names DNS cannot hold', () => {
    for (const name of [
      '',
      '.',
      'a..b',
      '-app.example.com',
      'app-.example.com',
      'app example.com',
      'app/example.com',
      'app"example.com',
      `${'a'.repeat(64)}.example.com`,
      `${'abcdefghi.'.repeat(26)}com`,
    ]) {
      expect(normalizeHostname(name), name).toBeNull();
    }
  });
});

describe('recordName', () => {
  it('turns what the user typed into the full name inside the zone', () => {
    expect(recordName('@', 'example.com')).toBe('example.com');
    expect(recordName('', 'example.com')).toBe('example.com');
    expect(recordName('www', 'example.com')).toBe('www.example.com');
    expect(recordName('WWW.example.com', 'example.com')).toBe('www.example.com');
    expect(recordName('example.com.', 'example.com')).toBe('example.com');
    expect(recordName('*', 'example.com')).toBe('*.example.com');
    expect(recordName('_sip._tcp', 'example.com')).toBe('_sip._tcp.example.com');
  });

  it('refuses a name that is not valid', () => {
    expect(recordName('bad name', 'example.com')).toBeNull();
    expect(recordName('a..b', 'example.com')).toBeNull();
  });
});

function problem(input: Partial<CloudflareRecordInput> & { type: string }): string | null {
  return recordProblem({ name: 'app.example.com', ttl: 1, ...input } as CloudflareRecordInput);
}

describe('recordProblem', () => {
  it('passes a well-formed record of every type the page edits', () => {
    const good: CloudflareRecordInput[] = [
      { type: 'A', name: 'example.com', content: '203.0.113.10', ttl: 1, proxied: true },
      { type: 'AAAA', name: 'www.example.com', content: '2001:db8::10', ttl: 300, proxied: false },
      { type: 'CNAME', name: 'blog.example.com', content: 'example.net', ttl: 1, proxied: true },
      { type: 'TXT', name: '_dmarc.example.com', content: 'v=DMARC1; p=none', ttl: 3600 },
      { type: 'MX', name: 'example.com', content: 'mail.example.com', priority: 10, ttl: 1 },
      {
        type: 'CAA',
        name: 'example.com',
        caa: { flags: 0, tag: 'issue', value: 'letsencrypt.org' },
        ttl: 1,
      },
      {
        type: 'SRV',
        name: '_sip._tcp.example.com',
        srv: { priority: 10, weight: 5, port: 5060, target: 'sip.example.com' },
        ttl: 1,
      },
      { type: 'A', name: '*.example.com', content: '203.0.113.10', ttl: 86400, proxied: false },
    ];
    for (const record of good) expect(recordProblem(record), record.type).toBeNull();
  });

  it('says what is wrong with the content, per type', () => {
    expect(problem({ type: 'A', content: '2001:db8::1', proxied: false })).toMatch(/IPv4/);
    expect(problem({ type: 'AAAA', content: '203.0.113.10', proxied: false })).toMatch(/IPv6/);
    expect(problem({ type: 'CNAME', content: 'not a name', proxied: false })).toMatch(/name/);
    expect(problem({ type: 'TXT', content: '' })).toMatch(/text/);
    expect(problem({ type: 'TXT', content: 'x'.repeat(2049) })).toMatch(/2048/);
    expect(problem({ type: 'MX', content: 'mail.example.com', priority: 70000 })).toMatch(
      /priority/,
    );
    expect(problem({ type: 'MX', content: '', priority: 10 })).toMatch(/mail server/);
    expect(
      problem({ type: 'CAA', caa: { flags: 300, tag: 'issue', value: 'letsencrypt.org' } }),
    ).toMatch(/flag/);
    expect(
      problem({
        type: 'CAA',
        caa: { flags: 0, tag: 'nope' as 'issue', value: 'letsencrypt.org' },
      }),
    ).toMatch(/tag/);
    expect(problem({ type: 'CAA', caa: { flags: 0, tag: 'issue', value: '' } })).toMatch(/value/);
    expect(problem({ type: 'CAA', caa: { flags: 0, tag: 'issue', value: 'a"b' } })).toMatch(
      /value/,
    );
    expect(
      problem({
        type: 'SRV',
        name: 'sip.example.com',
        srv: { priority: 1, weight: 1, port: 5060, target: 'sip.example.com' },
      }),
    ).toMatch(/_service\._protocol/);
    expect(
      problem({
        type: 'SRV',
        name: '_sip._tcp.example.com',
        srv: { priority: 1, weight: 1, port: 70000, target: 'sip.example.com' },
      }),
    ).toMatch(/port/);
    expect(
      problem({
        type: 'SRV',
        name: '_sip._tcp.example.com',
        srv: { priority: 1, weight: 1, port: 5060, target: 'bad target' },
      }),
    ).toMatch(/target/);
  });

  it('checks the name, the TTL and the comment for every type', () => {
    expect(problem({ type: 'TXT', name: 'bad name', content: 'x' })).toMatch(/name/);
    expect(problem({ type: 'TXT', content: 'x', ttl: 30 })).toMatch(/TTL/);
    expect(problem({ type: 'TXT', content: 'x', ttl: 1.5 })).toMatch(/TTL/);
    expect(problem({ type: 'TXT', content: 'x', ttl: 90000 })).toMatch(/TTL/);
    expect(problem({ type: 'TXT', content: 'x', comment: 'x'.repeat(501) })).toMatch(/comment/);
    expect(problem({ type: 'NS' as 'TXT', content: 'x' })).toMatch(/type/);
  });
});
