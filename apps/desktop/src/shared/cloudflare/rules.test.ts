import { describe, expect, it } from 'vitest';
import { accessRuleTarget, buildRule, describeRule } from './rules';

/**
 * The custom rule builder writes Cloudflare's rules language for the user. Everything it puts in
 * an expression is checked first, rather than escaped, so a path or address can never close a
 * string early and add a clause of its own.
 */

describe('buildRule', () => {
  it('blocks a list of countries', () => {
    expect(buildRule({ kind: 'block-countries', countries: ['cn', ' RU', 'CN'] })).toEqual({
      ok: true,
      rule: { expression: '(ip.src.country in {"CN" "RU"})', action: 'block', first: false },
    });
  });

  it('challenges one path, or every path under it', () => {
    expect(
      buildRule({ kind: 'challenge-path', path: '/wp-login.php', match: 'exact' }),
    ).toMatchObject({
      ok: true,
      rule: {
        expression: '(http.request.uri.path eq "/wp-login.php")',
        action: 'managed_challenge',
      },
    });
    expect(buildRule({ kind: 'challenge-path', path: '/admin', match: 'prefix' })).toMatchObject({
      ok: true,
      rule: { expression: '(starts_with(http.request.uri.path, "/admin"))' },
    });
  });

  it('allows addresses by skipping the remaining custom rules, placed first', () => {
    expect(
      buildRule({ kind: 'allow-ips', ips: ['203.0.113.10', '2001:DB8::/32', '203.0.113.10'] }),
    ).toEqual({
      ok: true,
      rule: {
        expression: '(ip.src in {203.0.113.10 2001:db8::/32})',
        action: 'skip',
        actionParameters: { ruleset: 'current' },
        first: true,
      },
    });
  });

  it('refuses input that is not what the rule takes', () => {
    expect(buildRule({ kind: 'block-countries', countries: [] })).toMatchObject({ ok: false });
    expect(buildRule({ kind: 'block-countries', countries: ['USA'] })).toEqual({
      ok: false,
      problem: 'USA is not a two-letter country code, such as US or DE.',
    });
    expect(buildRule({ kind: 'block-countries', countries: ['C"N'] })).toMatchObject({
      ok: false,
    });
    for (const path of ['admin', '/a"b', '/a\\b', '/a b', `/a${String.fromCharCode(7)}`, '']) {
      expect(buildRule({ kind: 'challenge-path', path, match: 'exact' }), path).toMatchObject({
        ok: false,
      });
    }
    expect(
      buildRule({ kind: 'challenge-path', path: `/${'a'.repeat(600)}`, match: 'exact' }),
    ).toMatchObject({ ok: false });
    expect(buildRule({ kind: 'allow-ips', ips: [] })).toMatchObject({ ok: false });
    expect(buildRule({ kind: 'allow-ips', ips: ['203.0.113.5/24'] })).toEqual({
      ok: false,
      problem: '203.0.113.5/24 is not the start of its range. Use 203.0.113.0/24.',
    });
    expect(buildRule({ kind: 'allow-ips', ips: ['example.com'] })).toEqual({
      ok: false,
      problem: 'example.com is not an IP address or a range like 203.0.113.0/24.',
    });
    expect(
      buildRule({ kind: 'allow-ips', ips: Array.from({ length: 101 }, (_, i) => `10.0.0.${i}`) }),
    ).toMatchObject({ ok: false });
    expect(buildRule({ kind: 'nope' } as never)).toMatchObject({ ok: false });
  });
});

describe('describeRule', () => {
  it('suggests a description from what the rule does', () => {
    expect(describeRule({ kind: 'block-countries', countries: ['cn', 'RU'] })).toBe('Block CN, RU');
    expect(describeRule({ kind: 'challenge-path', path: '/admin', match: 'prefix' })).toBe(
      'Challenge /admin and below',
    );
    expect(describeRule({ kind: 'challenge-path', path: '/login', match: 'exact' })).toBe(
      'Challenge /login',
    );
    expect(describeRule({ kind: 'allow-ips', ips: ['203.0.113.10'] })).toBe('Allow 203.0.113.10');
  });
});

describe('accessRuleTarget', () => {
  it('works out what kind of value an access rule is about', () => {
    expect(accessRuleTarget('203.0.113.10')).toEqual({
      ok: true,
      target: 'ip',
      value: '203.0.113.10',
    });
    expect(accessRuleTarget(' 2001:DB8::1 ')).toEqual({
      ok: true,
      target: 'ip6',
      value: '2001:db8::1',
    });
    expect(accessRuleTarget('203.0.113.0/24')).toEqual({
      ok: true,
      target: 'ip_range',
      value: '203.0.113.0/24',
    });
    expect(accessRuleTarget('2001:db8:1::/48')).toMatchObject({ ok: true, target: 'ip_range' });
    expect(accessRuleTarget('de')).toEqual({ ok: true, target: 'country', value: 'DE' });
    expect(accessRuleTarget('as13335')).toEqual({ ok: true, target: 'asn', value: 'AS13335' });
  });

  it('refuses ranges Cloudflare does not take and values that are none of these', () => {
    expect(accessRuleTarget('203.0.0.0/8')).toEqual({
      ok: false,
      problem: 'IP access rules take /16 or /24 ranges for IPv4, and /32, /48 or /64 for IPv6.',
    });
    expect(accessRuleTarget('2001:db8::/56')).toMatchObject({ ok: false });
    expect(accessRuleTarget('203.0.113.7/24')).toMatchObject({ ok: false });
    expect(accessRuleTarget('nowhere')).toMatchObject({ ok: false });
    expect(accessRuleTarget('')).toMatchObject({ ok: false });
  });
});
