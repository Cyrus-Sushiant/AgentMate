import { describe, expect, it } from 'vitest';
import {
  type DeployValidation,
  validateCidr,
  validateDomain,
  validateEnvKey,
  validateIpAddress,
  validateIpOrCidr,
  validatePort,
  validatePortRange,
  validateStackName,
} from './validation.js';

function reason<T>(result: DeployValidation<T>): string {
  if (result.ok) throw new Error(`expected a refusal, got ${JSON.stringify(result.value)}`);
  return result.reason;
}

function value<T>(result: DeployValidation<T>): T {
  if (!result.ok) throw new Error(`expected a pass, got "${result.reason}"`);
  return result.value;
}

describe('validateStackName', () => {
  it('accepts what Compose accepts as a project name', () => {
    for (const name of ['shop', 'my-app', 'api_2', '0day', 'a']) {
      expect(value(validateStackName(name))).toBe(name);
    }
  });

  it('explains each way a name can be wrong', () => {
    expect(reason(validateStackName(''))).toMatch(/Enter a name/);
    expect(reason(validateStackName('MyApp'))).toMatch(/lowercase/);
    expect(reason(validateStackName('-app'))).toMatch(/Start the name/);
    expect(reason(validateStackName('_app'))).toMatch(/Start the name/);
    expect(reason(validateStackName('my.app'))).toMatch(/only lowercase letters, digits/);
    expect(reason(validateStackName('app/../etc'))).toMatch(/only lowercase letters, digits/);
    expect(reason(validateStackName('../etc'))).toMatch(/Start the name/);
    expect(reason(validateStackName('a'.repeat(64)))).toMatch(/63 characters/);
  });
});

describe('validateDomain', () => {
  it('returns the ASCII form, lowercased', () => {
    expect(value(validateDomain('Example.COM'))).toBe('example.com');
    expect(value(validateDomain('api.example.co.uk'))).toBe('api.example.co.uk');
    expect(value(validateDomain('xn--bcher-kva.de'))).toBe('xn--bcher-kva.de');
  });

  it('converts international names to punycode with the platform URL parser', () => {
    expect(value(validateDomain('bücher.de'))).toBe('xn--bcher-kva.de');
    expect(value(validateDomain('BÜCHER.de'))).toBe('xn--bcher-kva.de');
    expect(value(validateDomain('пример.рф'))).toBe('xn--e1afmkfd.xn--p1ai');
    expect(value(validateDomain('例え.テスト'))).toBe('xn--r8jz45g.xn--zckzah');
    expect(value(validateDomain('münchen.xn--p1ai'))).toBe('xn--mnchen-3ya.xn--p1ai');
  });

  it('refuses what the URL parser would quietly repair or pass through', () => {
    // new URL() strips line breaks and tabs, decodes %-escapes, and keeps ; { } and quotes.
    expect(reason(validateDomain('exa\nmple.com'))).toMatch(/spaces or line breaks/);
    expect(reason(validateDomain('exa\tmple.com'))).toMatch(/spaces or line breaks/);
    expect(reason(validateDomain('ex%61mple.com'))).toMatch(/"%" isn't allowed/);
    expect(reason(validateDomain('a;b.com'))).toMatch(/";" isn't allowed/);
    expect(reason(validateDomain('a{b}.com'))).toMatch(/"\{" isn't allowed/);
    expect(reason(validateDomain('a"b.com'))).toMatch(/isn't allowed/);
    expect(reason(validateDomain("a'b.com"))).toMatch(/isn't allowed/);
    // Full-width punctuation maps to its ASCII twin under IDNA, after the first check has run.
    expect(reason(validateDomain('example；.com'))).toMatch(/can't contain/);
    expect(reason(validateDomain('example｛x｝.com'))).toMatch(/can't contain/);
  });

  it('refuses addresses dressed up as domains', () => {
    expect(reason(validateDomain('1.2.3.4'))).toMatch(/IP address/);
    // The URL parser would turn this one into 127.0.0.1.
    expect(reason(validateDomain('0x7f.1'))).toMatch(/last part of a domain is letters/);
    expect(reason(validateDomain('１.２.３.４'))).toMatch(/IP address/);
    expect(reason(validateDomain('example.123'))).toMatch(/last part of a domain is letters/);
    expect(reason(validateDomain('example.0x1f'))).toMatch(/last part of a domain is letters/);
  });

  it('refuses URLs and paths with a hint', () => {
    expect(reason(validateDomain('https://example.com'))).toMatch(/without http/);
    expect(reason(validateDomain('example.com/path'))).toMatch(/without http/);
    expect(reason(validateDomain('example.com:8080'))).toMatch(/without http/);
    expect(reason(validateDomain('user@example.com'))).toMatch(/"@" isn't allowed/);
  });

  it('explains label and length rules', () => {
    expect(reason(validateDomain(''))).toMatch(/Enter a domain/);
    expect(reason(validateDomain('localhost'))).toMatch(/full domain/);
    expect(reason(validateDomain('example.com.'))).toMatch(/trailing dot/);
    expect(reason(validateDomain('.example.com'))).toMatch(/dot/);
    expect(reason(validateDomain('exa..mple.com'))).toMatch(/two dots/);
    expect(reason(validateDomain('-shop.example.com'))).toMatch(/hyphen/);
    expect(reason(validateDomain('shop-.example.com'))).toMatch(/hyphen/);
    expect(reason(validateDomain('ab--cd.example.com'))).toMatch(/xn--/);
    expect(reason(validateDomain(`${'a'.repeat(64)}.com`))).toMatch(/63 characters/);
    expect(value(validateDomain(`${'a'.repeat(63)}.com`))).toBe(`${'a'.repeat(63)}.com`);
    const long = Array.from({ length: 5 }, () => 'a'.repeat(50)).join('.');
    expect(reason(validateDomain(`${long}.com`))).toMatch(/253 characters/);
    expect(reason(validateDomain('xn--zz.com'))).toMatch(/international/);
    expect(reason(validateDomain('a‍b.com'))).toMatch(/international/);
  });

  it('allows a wildcard only where asked, and only as the whole first label', () => {
    expect(reason(validateDomain('*.example.com'))).toMatch(/Wildcards/);
    expect(value(validateDomain('*.example.com', { allowWildcard: true }))).toBe('*.example.com');
    expect(value(validateDomain('*.BÜCHER.de', { allowWildcard: true }))).toBe(
      '*.xn--bcher-kva.de',
    );
    expect(reason(validateDomain('a.*.com', { allowWildcard: true }))).toMatch(/first part/);
    expect(reason(validateDomain('*a.example.com', { allowWildcard: true }))).toMatch(/first part/);
    expect(reason(validateDomain('*.com', { allowWildcard: true }))).toMatch(/full domain/);
  });
});

describe('validatePort and validatePortRange', () => {
  it('accepts whole numbers from 1 to 65535, as text or numbers', () => {
    expect(value(validatePort('80'))).toBe(80);
    expect(value(validatePort(65535))).toBe(65535);
    expect(value(validatePort('1'))).toBe(1);
  });

  it('refuses everything else with a reason', () => {
    expect(reason(validatePort('0'))).toMatch(/1 to 65535/);
    expect(reason(validatePort('65536'))).toMatch(/1 to 65535/);
    expect(reason(validatePort(80.5))).toMatch(/whole number/);
    expect(reason(validatePort(Number.NaN))).toMatch(/whole number/);
    expect(reason(validatePort('8080 '))).toMatch(/whole number/);
    expect(reason(validatePort('+80'))).toMatch(/whole number/);
    expect(reason(validatePort('0x50'))).toMatch(/whole number/);
    expect(reason(validatePort('080'))).toMatch(/leading zeros/);
    expect(reason(validatePort(''))).toMatch(/Enter a port/);
    expect(reason(validatePort('9'.repeat(400)))).toMatch(/1 to 65535/);
  });

  it('reads ranges and single ports', () => {
    expect(value(validatePortRange('8000-8010'))).toEqual({ start: 8000, end: 8010 });
    expect(value(validatePortRange('443'))).toEqual({ start: 443, end: 443 });
    expect(value(validatePortRange(53))).toEqual({ start: 53, end: 53 });
    expect(value(validatePortRange('60000-61000'))).toEqual({ start: 60000, end: 61000 });
  });

  it('explains broken ranges', () => {
    expect(reason(validatePortRange('8010-8000'))).toMatch(/can't be higher/);
    expect(reason(validatePortRange('8000-'))).toMatch(/Enter a port/);
    expect(reason(validatePortRange('8000-8001-8002'))).toMatch(/one dash/);
    expect(reason(validatePortRange('8000:8010'))).toMatch(/whole number/);
    expect(reason(validatePortRange('0-10'))).toMatch(/1 to 65535/);
  });
});

describe('validateIpAddress', () => {
  it('reads IPv4 strictly', () => {
    expect(value(validateIpAddress('192.168.1.10'))).toEqual({
      address: '192.168.1.10',
      version: 4,
    });
    expect(value(validateIpAddress('0.0.0.0'))).toEqual({ address: '0.0.0.0', version: 4 });
    expect(reason(validateIpAddress('192.168.01.1'))).toMatch(/leading zeros/);
    expect(reason(validateIpAddress('256.1.1.1'))).toMatch(/0 to 255/);
    expect(reason(validateIpAddress('1.2.3'))).toMatch(/four numbers/);
    expect(reason(validateIpAddress('1.2.3.4.5'))).toMatch(/four numbers/);
    expect(reason(validateIpAddress('0x7f.0.0.1'))).toMatch(/four numbers|0 to 255/);
    expect(reason(validateIpAddress(' 1.2.3.4'))).toMatch(/isn't an IP address|spaces/);
  });

  it('reads IPv6 and gives it back in its canonical short form', () => {
    expect(value(validateIpAddress('::1'))).toEqual({ address: '::1', version: 6 });
    expect(value(validateIpAddress('::'))).toEqual({ address: '::', version: 6 });
    expect(value(validateIpAddress('2001:0DB8:0000:0000:0000:0000:0000:0001')).address).toBe(
      '2001:db8::1',
    );
    expect(value(validateIpAddress('2001:db8:0:0:1:0:0:1')).address).toBe('2001:db8::1:0:0:1');
    expect(value(validateIpAddress('2001:db8:0:1:1:1:1:1')).address).toBe('2001:db8:0:1:1:1:1:1');
    expect(value(validateIpAddress('fe80::')).address).toBe('fe80::');
    expect(value(validateIpAddress('::ffff:192.0.2.1')).address).toBe('::ffff:192.0.2.1');
    expect(value(validateIpAddress('::FFFF:C000:0201')).address).toBe('::ffff:192.0.2.1');
    expect(value(validateIpAddress('64:ff9b::192.0.2.33')).address).toBe('64:ff9b::c000:221');
  });

  it('refuses broken IPv6 and the forms that do not belong in config', () => {
    expect(reason(validateIpAddress('fe80::1%eth0'))).toMatch(/zone/);
    expect(reason(validateIpAddress('[::1]'))).toMatch(/brackets/);
    expect(reason(validateIpAddress('1::2::3'))).toMatch(/IPv6/);
    expect(reason(validateIpAddress('1:2:3:4:5:6:7'))).toMatch(/IPv6/);
    expect(reason(validateIpAddress('1:2:3:4:5:6:7:8:9'))).toMatch(/IPv6/);
    expect(reason(validateIpAddress('12345::'))).toMatch(/IPv6/);
    expect(reason(validateIpAddress('::g'))).toMatch(/IPv6/);
    expect(reason(validateIpAddress(':1:2:3:4:5:6:7'))).toMatch(/IPv6/);
    expect(reason(validateIpAddress('::1.2.3.04'))).toMatch(/IPv6|leading zeros/);
  });

  it('can insist on one version', () => {
    expect(reason(validateIpAddress('::1', { version: 4 }))).toMatch(/IPv4/);
    expect(reason(validateIpAddress('10.0.0.1', { version: 6 }))).toMatch(/IPv6/);
  });
});

describe('validateCidr and validateIpOrCidr', () => {
  it('reads networks in both families', () => {
    expect(value(validateCidr('10.0.0.0/8'))).toEqual({
      network: '10.0.0.0',
      prefix: 8,
      version: 4,
      value: '10.0.0.0/8',
    });
    expect(value(validateCidr('2001:DB8::/32')).value).toBe('2001:db8::/32');
    expect(value(validateCidr('0.0.0.0/0')).value).toBe('0.0.0.0/0');
    expect(value(validateCidr('::/0')).value).toBe('::/0');
    expect(value(validateCidr('192.0.2.7/32')).value).toBe('192.0.2.7/32');
  });

  it('points out host bits, with the network that was probably meant', () => {
    expect(reason(validateCidr('10.0.0.5/24'))).toMatch(/The network is 10\.0\.0\.0\/24/);
    expect(reason(validateCidr('2001:db8::1/64'))).toMatch(/The network is 2001:db8::\/64/);
    expect(reason(validateCidr('10.1.2.3/9'))).toMatch(/10\.0\.0\.0\/9/);
  });

  it('refuses broken prefixes', () => {
    expect(reason(validateCidr('10.0.0.0'))).toMatch(/\/ and a prefix/);
    expect(reason(validateCidr('10.0.0.0/33'))).toMatch(/0 to 32/);
    expect(reason(validateCidr('::/129'))).toMatch(/0 to 128/);
    expect(reason(validateCidr('10.0.0.0/08'))).toMatch(/0 to 32/);
    expect(reason(validateCidr('10.0.0.0/8/8'))).toMatch(/one \//);
    expect(reason(validateCidr('10.0.0.0/'))).toMatch(/0 to 32/);
  });

  it('takes a bare address as a single-host network when asked', () => {
    expect(value(validateIpOrCidr('203.0.113.4')).value).toBe('203.0.113.4/32');
    expect(value(validateIpOrCidr('2001:db8::7')).value).toBe('2001:db8::7/128');
    expect(value(validateIpOrCidr('203.0.113.0/24')).value).toBe('203.0.113.0/24');
  });
});

describe('validateEnvKey', () => {
  it('accepts the keys the Environments tab reads', () => {
    for (const key of ['DATABASE_URL', '_private', 'next.public.url', 'my-key', 'A1']) {
      expect(value(validateEnvKey(key))).toBe(key);
    }
  });

  it('explains what a key may contain', () => {
    expect(reason(validateEnvKey(''))).toMatch(/Enter a key/);
    expect(reason(validateEnvKey('1KEY'))).toMatch(/Start a key/);
    expect(reason(validateEnvKey('-KEY'))).toMatch(/Start a key/);
    expect(reason(validateEnvKey('MY KEY'))).toMatch(/only letters, digits/);
    expect(reason(validateEnvKey('KEY=1'))).toMatch(/only letters, digits/);
    expect(reason(validateEnvKey('KÉY'))).toMatch(/only letters, digits/);
    expect(reason(validateEnvKey('K'.repeat(256)))).toMatch(/255 characters/);
  });
});

/**
 * mulberry32: a small seeded generator, so every run tries the same "random" inputs and a failure
 * reproduces.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

const word = (random: () => number, alphabet: string, min: number, max: number): string =>
  Array.from({ length: min + Math.floor(random() * (max - min + 1)) }, () =>
    pick(random, [...alphabet]),
  ).join('');

/**
 * Characters that change the meaning of the configs these values end up in (nginx, compose, .env,
 * shell): line breaks, statement and block delimiters, quotes, escapes, interpolation, comments,
 * whitespace, and their Unicode look-alikes and full-width twins.
 */
const DANGEROUS = [
  '\r',
  '\n',
  ';',
  '{',
  '}',
  "'",
  '"',
  '`',
  '$',
  '\\',
  ' ',
  '\t',
  '\0',
  '#',
  '%',
  '/',
  '\u0085',
  ' ',
  ' ',
  ' ',
  '　',
  '﻿',
  '；',
  '｛',
  '｝',
  '＂',
  '＇',
  '＄',
  '＼',
];

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

/** A passing value as it would be written into a config file. */
const rendered = <T>(
  result: DeployValidation<T>,
  render: (value: T) => string,
): DeployValidation<string> => (result.ok ? { ok: true, value: render(result.value) } : result);

interface Subject {
  valid: (random: () => number) => string;
  check: (input: string) => DeployValidation<string>;
  /** What every rendered value must look like, beyond carrying no dangerous character. */
  shape: RegExp;
}

const SUBJECTS: Record<string, Subject> = {
  'stack name': {
    valid: (r) => word(r, LOWER + DIGITS, 1, 1) + word(r, `${LOWER + DIGITS}_-`, 0, 20),
    check: (s) => validateStackName(s),
    shape: /^[a-z0-9][a-z0-9_-]*$/,
  },
  domain: {
    valid: (r) =>
      `${Array.from({ length: 1 + Math.floor(r() * 3) }, () => word(r, LOWER + DIGITS, 1, 10)).join('.')}.${word(r, LOWER, 2, 6)}`,
    check: (s) => validateDomain(s, { allowWildcard: true }),
    shape: /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/,
  },
  port: {
    valid: (r) => String(1 + Math.floor(r() * 65535)),
    check: (s) => rendered(validatePort(s), String),
    shape: /^[1-9][0-9]*$/,
  },
  'port range': {
    valid: (r) => `${1 + Math.floor(r() * 30000)}-${30001 + Math.floor(r() * 35000)}`,
    check: (s) => rendered(validatePortRange(s), (v) => `${v.start}-${v.end}`),
    shape: /^[1-9][0-9]*-[1-9][0-9]*$/,
  },
  'IPv4 address': {
    valid: (r) => Array.from({ length: 4 }, () => String(Math.floor(r() * 256))).join('.'),
    check: (s) => rendered(validateIpAddress(s), (v) => v.address),
    shape: /^[0-9a-f.:]+$/,
  },
  'IPv6 address': {
    valid: (r) => Array.from({ length: 8 }, () => Math.floor(r() * 65536).toString(16)).join(':'),
    check: (s) => rendered(validateIpAddress(s), (v) => v.address),
    shape: /^[0-9a-f.:]+$/,
  },
  CIDR: {
    valid: (r) => `10.${Math.floor(r() * 256)}.0.0/16`,
    check: (s) => rendered(validateIpOrCidr(s), (v) => v.value),
    shape: /^[0-9a-f.:]+\/[0-9]+$/,
  },
  'env key': {
    valid: (r) => word(r, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_', 1, 1) + word(r, `ABCXYZ${DIGITS}_`, 0, 15),
    check: (s) => validateEnvKey(s),
    shape: /^[A-Za-z_][A-Za-z0-9_.-]*$/,
  },
};

describe('nothing that is rendered into config can carry a dangerous character', () => {
  for (const [name, { valid, check }] of Object.entries(SUBJECTS)) {
    it(`a valid ${name} with any dangerous character added anywhere is refused`, () => {
      const random = seeded(name.length * 7919);
      for (let round = 0; round < 300; round++) {
        const base = valid(random);
        expect(check(base).ok, `${name} ${JSON.stringify(base)}`).toBe(true);
        const bad = pick(random, DANGEROUS);
        const at = Math.floor(random() * (base.length + 1));
        const input = base.slice(0, at) + bad + base.slice(at);
        expect(check(input).ok, `${name} ${JSON.stringify(input)}`).toBe(false);
      }
    });
  }

  it('whatever passes, from any jumble of characters, renders safely', () => {
    const random = seeded(20261001);
    const alphabet = [...`${LOWER}ABC${DIGITS}.-_:*/[]`, ...DANGEROUS, 'ü', 'ж', '例', '。', '．'];
    for (let round = 0; round < 4000; round++) {
      const length = Math.floor(random() * 24);
      const input = Array.from({ length }, () => pick(random, alphabet)).join('');
      for (const [name, { check, shape }] of Object.entries(SUBJECTS)) {
        const result = check(input);
        const label = `${name} ${JSON.stringify(input)}`;
        if (!result.ok) {
          expect(result.reason.length, label).toBeGreaterThan(0);
          continue;
        }
        expect(result.value, label).not.toMatch(/[\s;{}'"`$\\#%\0]/u);
        expect(result.value, label).toMatch(shape);
      }
    }
  });
});
