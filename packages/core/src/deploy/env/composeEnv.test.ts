import { describe, expect, it } from 'vitest';
import { MAX_ENV_FILE_BYTES } from '../../env/dotenv.js';
import {
  COMPOSE_ENV_HEADER,
  quoteComposeEnvValue,
  renderComposeEnv,
  renderComposeEnvFromDotenv,
} from './composeEnv.js';

function text(result: ReturnType<typeof renderComposeEnv>): string {
  if (!result.ok) throw new Error(`expected a file, got "${result.reason}"`);
  return result.text;
}

function refusal(result: ReturnType<typeof renderComposeEnv>): string {
  if (result.ok) throw new Error(`expected a refusal, got ${JSON.stringify(result.text)}`);
  return result.reason;
}

/**
 * How Compose reads one double-quoted value, ported from compose-go's dotenv/parser.go
 * (extractVarValue, expandEscapes) and its template package, so the renderer can be checked on
 * thousands of values without Docker. composeEnv.compose.test.ts checks the same values against
 * the real `docker compose`.
 */
function readLikeCompose(line: string): { key: string; value: string } {
  const equals = line.indexOf('=');
  const key = line.slice(0, equals);
  const source = line.slice(equals + 1);
  if (source[0] !== '"') throw new Error(`not double-quoted: ${line}`);
  let chars = '';
  let escaping = false;
  for (let i = 1; i < source.length; i++) {
    const char = source[i];
    if (char !== '"') {
      if (!escaping && char === '\\') {
        escaping = true;
        continue;
      }
      if (escaping) {
        escaping = false;
        chars += '\\';
      }
      chars += char;
      continue;
    }
    if (escaping) {
      escaping = false;
      chars += char;
      continue;
    }
    if (source.slice(i + 1) !== '') throw new Error(`text after the closing quote: ${line}`);
    const unescaped = chars.replace(/\\(?:[abcfnrtv$"\\]|0\d{0,3})/g, (match) => {
      if (match === '\\$') return '$$';
      if (match.startsWith('\\0')) {
        const digits = match.slice(2);
        return /^[0-7]{3}$/.test(digits) ? String.fromCharCode(Number.parseInt(digits, 8)) : match;
      }
      const simple: Record<string, string> = {
        a: '\u0007',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
        v: '\v',
        '"': '"',
        '\\': '\\',
      };
      return simple[match[1]];
    });
    // Template substitution: $$ is a literal $, and any other $ would start a variable.
    const value = unescaped.replace(/\$\$|\$/g, (match) => {
      if (match === '$') throw new Error(`a bare $ would be interpolated: ${line}`);
      return '$';
    });
    return { key, value };
  }
  throw new Error(`unterminated value: ${line}`);
}

function entryLines(rendered: string): string[] {
  return rendered.split('\n').filter((line) => line !== '' && !line.startsWith('#'));
}

describe('quoteComposeEnvValue', () => {
  it('escapes exactly what Compose would otherwise read differently', () => {
    expect(quoteComposeEnvValue('plain')).toBe('"plain"');
    expect(quoteComposeEnvValue('')).toBe('""');
    expect(quoteComposeEnvValue('cost $5 and ${HOME}')).toBe('"cost $$5 and $${HOME}"');
    expect(quoteComposeEnvValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(quoteComposeEnvValue('C:\\path\\')).toBe('"C:\\\\path\\\\"');
    expect(quoteComposeEnvValue('one\ntwo\r\nthree')).toBe('"one\\ntwo\\r\\nthree"');
    expect(quoteComposeEnvValue('a\tb')).toBe('"a\\tb"');
    expect(quoteComposeEnvValue('bell\u0007 esc\u001b del\u007f')).toBe(
      '"bell\\0007 esc\\0033 del\\0177"',
    );
    expect(quoteComposeEnvValue("it's # not a comment = fine")).toBe(
      '"it\'s # not a comment = fine"',
    );
    expect(quoteComposeEnvValue('ünïcødé 🚀 \u2028')).toBe('"ünïcødé 🚀 \u2028"');
  });
});

describe('renderComposeEnv', () => {
  it('writes one quoted line per key under a header', () => {
    const rendered = text(
      renderComposeEnv([
        { key: 'DATABASE_URL', value: 'postgres://app:p@ss$word@db/app' },
        { key: 'EMPTY', value: '' },
        { key: 'next.public.url', value: 'https://example.com' },
      ]),
    );
    expect(rendered).toBe(
      `${COMPOSE_ENV_HEADER}\n` +
        'DATABASE_URL="postgres://app:p@ss$$word@db/app"\n' +
        'EMPTY=""\n' +
        'next.public.url="https://example.com"\n',
    );
    expect(COMPOSE_ENV_HEADER.startsWith('# ')).toBe(true);
  });

  it('keeps the last value of a key set twice, as dotenv reads it', () => {
    const result = renderComposeEnv([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
      { key: 'A', value: '3' },
    ]);
    expect(entryLines(text(result))).toEqual(['A="3"', 'B="2"']);
    expect(result.ok && result.keys).toEqual(['A', 'B']);
  });

  it('refuses keys Compose cannot read, naming the key', () => {
    const reason = refusal(renderComposeEnv([{ key: '1BAD', value: 'x' }]));
    expect(reason).toMatch(/"1BAD"/);
    expect(reason).toMatch(/Start a key/);
    expect(refusal(renderComposeEnv([{ key: 'A=B', value: 'x' }]))).toMatch(/only letters/);
    expect(refusal(renderComposeEnv([{ key: 'A\nB', value: 'x' }]))).toMatch(/"A\\nB"/);
  });

  it('refuses values no environment variable can hold', () => {
    expect(refusal(renderComposeEnv([{ key: 'A', value: 'x\u0000y' }]))).toMatch(/NUL/);
    expect(refusal(renderComposeEnv([{ key: 'A', value: 'broken \ud800 half' }]))).toMatch(
      /Unicode/,
    );
    expect(refusal(renderComposeEnv([{ key: 'A', value: '\udc00' }]))).toMatch(/Unicode/);
  });

  it('refuses a file larger than the Environments tab would keep', () => {
    const big = 'x'.repeat(MAX_ENV_FILE_BYTES);
    expect(refusal(renderComposeEnv([{ key: 'A', value: big }]))).toMatch(/1 MB/);
  });

  it('round-trips any value through the way Compose reads it', () => {
    let state = 20261001;
    const random = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    const alphabet = [
      ...'abcXYZ019 =#\'"`$\\{}:;,.-_/!*?[]()<>|&~',
      '\n',
      '\r',
      '\t',
      '\u0001',
      '\u001b',
      '\u007f',
      '\u0085',
      '\u00a0',
      '\u2028',
      'é',
      'ж',
      '例',
      '🚀',
    ];
    for (let round = 0; round < 2000; round++) {
      const length = Math.floor(random() * 30);
      const value = Array.from(
        { length },
        () => alphabet[Math.floor(random() * alphabet.length)],
      ).join('');
      const [line] = entryLines(text(renderComposeEnv([{ key: 'K', value }])));
      expect(readLikeCompose(line), JSON.stringify(value)).toEqual({ key: 'K', value });
    }
  });
});

describe('renderComposeEnvFromDotenv', () => {
  it('passes on exactly the values the Environments tab reads from a project file', () => {
    const source = [
      '# database',
      'DB_HOST=localhost',
      'export DB_PASS = "p@ss$word"',
      "SINGLE='keep $THIS literal'",
      'MULTI="line one',
      'line two"',
      'URL=https://example.com/#anchor # trailing comment',
    ].join('\n');
    const rendered = text(renderComposeEnvFromDotenv(source));
    expect(entryLines(rendered).map(readLikeCompose)).toEqual([
      { key: 'DB_HOST', value: 'localhost' },
      { key: 'DB_PASS', value: 'p@ss$word' },
      { key: 'SINGLE', value: 'keep $THIS literal' },
      { key: 'MULTI', value: 'line one\nline two' },
      { key: 'URL', value: 'https://example.com/#anchor' },
    ]);
  });
});
