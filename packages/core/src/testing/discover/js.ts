import type { DiscoveredTest } from '../types.js';
import { pruneEmptySuites } from './shared.js';

/**
 * Finds `describe`/`it`/`test` style calls by scanning source text. It is not a parser: it skips
 * comments, strings, templates and regex literals so braces and lookalike calls inside them do not
 * count, and follows brace depth to know which suite a test sits in. That is enough for the
 * shapes real test files use, and it runs without the project's dependencies being installed.
 */

interface Dialect {
  suites: ReadonlySet<string>;
  tests: ReadonlySet<string>;
  /** Members allowed between the callee and its arguments, like `.skip` or `.each`. */
  modifiers: ReadonlySet<string>;
  /** Modifiers that take their own arguments before the real call: `it.each([...])('name')`. */
  factories: ReadonlySet<string>;
  dart: boolean;
}

const JS: Dialect = {
  suites: new Set(['describe', 'suite', 'context']),
  tests: new Set(['it', 'test', 'specify', 'bench']),
  modifiers: new Set([
    'only',
    'skip',
    'todo',
    'fails',
    'fail',
    'fixme',
    'slow',
    'concurrent',
    'sequential',
    'serial',
    'parallel',
    'shuffle',
    'describe',
    'each',
    'for',
    'runIf',
    'skipIf',
  ]),
  factories: new Set(['each', 'for', 'runIf', 'skipIf']),
  dart: false,
};

const DART: Dialect = {
  suites: new Set(['group']),
  tests: new Set(['test', 'testWidgets', 'testGoldens']),
  modifiers: new Set(),
  factories: new Set(),
  dart: true,
};

export function discoverJsTests(source: string): DiscoveredTest[] {
  return scan(source, JS);
}

export function discoverDartTests(source: string): DiscoveredTest[] {
  return scan(source, DART);
}

const REGEX_BEFORE = new Set([
  '',
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '~',
  '^',
]);
const REGEX_AFTER_WORDS = new Set([
  'return',
  'typeof',
  'case',
  'do',
  'else',
  'in',
  'of',
  'yield',
  'await',
]);

function scan(source: string, dialect: Dialect): DiscoveredTest[] {
  const out: DiscoveredTest[] = [];
  const stack: { name: string; depth: number }[] = [];
  let pending: { name: string; parenDepth: number } | null = null;
  let braceDepth = 0;
  let parenDepth = 0;
  let line = 1;
  let i = 0;
  /** Last significant character outside literals, or the last word for regex detection. */
  let last = '';
  let lastWord = '';

  const countLines = (from: number, to: number): void => {
    for (let k = from; k < to; k += 1) if (source.charCodeAt(k) === 10) line += 1;
  };

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '\n') {
      line += 1;
      i += 1;
      continue;
    }
    if (char === ' ' || char === '\t' || char === '\r') {
      i += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      countLines(i, stop);
      i = stop;
      continue;
    }
    const literal = readString(source, i, dialect);
    if (literal) {
      countLines(i, literal.end);
      i = literal.end;
      last = '"';
      lastWord = '';
      continue;
    }
    if (
      !dialect.dart &&
      char === '/' &&
      (REGEX_BEFORE.has(last) || REGEX_AFTER_WORDS.has(lastWord))
    ) {
      const end = skipRegex(source, i);
      if (end > 0) {
        i = end;
        last = '/';
        lastWord = '';
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(char)) {
      const word = /^[A-Za-z_$][\w$]*/.exec(source.slice(i, i + 64))?.[0] ?? char;
      if (last !== '.' && (dialect.suites.has(word) || dialect.tests.has(word))) {
        const call = readCall(source, i, word, dialect);
        if (call) {
          const startLine = line;
          const kind = call.kind;
          const path = [...stack.map((entry) => entry.name), call.name];
          out.push({ kind, path, line: startLine });
          countLines(i, call.end);
          i = call.end;
          parenDepth += 1;
          if (kind === 'suite') pending = { name: call.name, parenDepth };
          last = '"';
          lastWord = '';
          continue;
        }
      }
      i += word.length;
      last = 'a';
      lastWord = word;
      continue;
    }

    if (char === '=' && next === '>') {
      last = '>';
      lastWord = '';
      i += 2;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      if (pending && (last === ')' || last === '>')) {
        stack.push({ name: pending.name, depth: braceDepth });
        pending = null;
      }
    } else if (char === '}') {
      braceDepth -= 1;
      while (stack.length > 0 && stack[stack.length - 1].depth > braceDepth) stack.pop();
    } else if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (pending && parenDepth < pending.parenDepth) pending = null;
    }
    last = char;
    lastWord = '';
    i += 1;
  }

  return pruneEmptySuites(out);
}

/**
 * Reads `callee[.modifier...][(factory args)](name` starting at the callee. Returns the decoded
 * name and the index just past the name literal, or null when this is not a test call.
 */
function readCall(
  source: string,
  start: number,
  callee: string,
  dialect: Dialect,
): { kind: 'suite' | 'test'; name: string; end: number } | null {
  let i = start + callee.length;
  let kind: 'suite' | 'test' = dialect.suites.has(callee) ? 'suite' : 'test';
  const skipSpace = (): void => {
    while (i < source.length && /\s/.test(source[i])) i += 1;
  };

  for (;;) {
    skipSpace();
    if (source[i] !== '.') break;
    i += 1;
    skipSpace();
    const member = /^[A-Za-z_$][\w$]*/.exec(source.slice(i, i + 32))?.[0];
    if (!member || !dialect.modifiers.has(member)) return null;
    i += member.length;
    if (member === 'describe') kind = 'suite';
    if (dialect.factories.has(member)) {
      skipSpace();
      if (source[i] === '`') {
        const literal = readString(source, i, dialect);
        if (!literal) return null;
        i = literal.end;
      } else if (source[i] === '(') {
        const end = skipBalanced(source, i, dialect);
        if (end < 0) return null;
        i = end;
      } else return null;
    }
  }

  skipSpace();
  if (source[i] !== '(') return null;
  i += 1;
  skipSpace();
  const literal = readString(source, i, dialect);
  if (!literal) return null;
  return { kind, name: literal.value, end: literal.end };
}

function readString(
  source: string,
  start: number,
  dialect: Dialect,
): { value: string; end: number } | null {
  let i = start;
  let raw = false;
  if (dialect.dart && source[i] === 'r' && (source[i + 1] === "'" || source[i + 1] === '"')) {
    raw = true;
    i += 1;
  }
  const quote = source[i];
  if (quote !== "'" && quote !== '"' && !(quote === '`' && !dialect.dart)) return null;

  if (dialect.dart && source.startsWith(quote.repeat(3), i)) {
    const end = source.indexOf(quote.repeat(3), i + 3);
    if (end < 0) return null;
    return { value: source.slice(i + 3, end), end: end + 3 };
  }

  let value = '';
  let j = i + 1;
  while (j < source.length) {
    const char = source[j];
    if (char === '\\' && !raw) {
      const escaped = source[j + 1] ?? '';
      value +=
        quote === '`' ? char + escaped : escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
      j += 2;
      continue;
    }
    if (quote === '`' && char === '$' && source[j + 1] === '{') {
      // Keep the interpolation as written; the runner will report the evaluated name.
      const end = skipBalanced(source, j + 1, dialect, '{', '}');
      if (end < 0) return null;
      value += source.slice(j, end);
      j = end;
      continue;
    }
    if (char === quote) return { value, end: j + 1 };
    if (char === '\n' && quote !== '`') return null;
    value += char;
    j += 1;
  }
  return null;
}

/** Index just past the bracket matching the one at `start`, skipping literals and comments. */
function skipBalanced(
  source: string,
  start: number,
  dialect: Dialect,
  open = '(',
  close = ')',
): number {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const char = source[i];
    if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) return -1;
      i = end + 2;
      continue;
    }
    const literal = readString(source, i, dialect);
    if (literal) {
      i = literal.end;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return -1;
}

function skipRegex(source: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const char = source[i];
    if (char === '\n') return -1;
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) {
      let end = i + 1;
      while (end < source.length && /[a-z]/i.test(source[end])) end += 1;
      return end;
    }
  }
  return -1;
}
