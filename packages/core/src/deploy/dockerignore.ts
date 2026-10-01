/**
 * Reads .dockerignore files the way Docker and BuildKit do on the Linux server that builds the
 * image: moby/patternmatcher's ignorefile.ReadAll and PatternMatcher (MatchesOrParentMatches),
 * which build on Go's filepath.Match. Written in-house (see the plan's no-new-dependency rule)
 * and tested against moby's own test tables and Docker's documented examples.
 *
 * - Lines starting with `#` in the first column are comments; others are trimmed, and blank ones
 *   skipped. A UTF-8 byte order mark on the first line is ignored.
 * - Each pattern is cleaned like filepath.Clean (`./a//b/` is `a/b`) and a leading `/` dropped,
 *   since the context root is both the working and the root folder.
 * - `*` matches within one path segment, `?` one character, `[...]` a class (`^` negates), `\`
 *   escapes, and `**` any number of folders, including none.
 * - A path is left out when it, or any folder above it, matches; lines starting with `!` put
 *   matching paths back; the last line that matches wins.
 *
 * Where Docker's two readers disagree with each other (moby turns a pattern into a Go regular
 * expression after checking it with filepath.Match, so `\d` or a `^` outside brackets mean one
 * thing to the check and another to the match), the pattern is refused with a reason instead of
 * guessing, so this matcher never quietly leaves out a file the server would keep, or the reverse.
 */

export interface DockerignoreRule {
  /** The cleaned pattern, without the leading `!`. */
  pattern: string;
  /** A `!` line: matching paths are put back into the context. */
  exception: boolean;
  /** 1-based line in the file, or position in the list given. */
  line: number;
}

export interface DockerignoreMatcher {
  readonly rules: readonly DockerignoreRule[];
  /**
   * True when the path, relative to the context root with `/` separators, is left out of the
   * build context.
   */
  excludes(path: string): boolean;
  /**
   * For a folder that is left out: true when no `!` line could put anything inside it back, so
   * a walker need not read it at all. The same shortcut BuildKit takes.
   */
  canSkipFolder(path: string): boolean;
}

export type DockerignoreParse =
  | { ok: true; matcher: DockerignoreMatcher }
  | { ok: false; reason: string; line: number };

type MatchType = 'exact' | 'prefix' | 'suffix' | 'regexp';

interface CompiledRule extends DockerignoreRule {
  type: MatchType;
  regexp: RegExp | null;
}

/** Go's strings.TrimSpace: the Unicode White_Space characters. */
const GO_SPACE = new Set([
  '\t',
  '\n',
  '\v',
  '\f',
  '\r',
  ' ',
  '\u0085',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  '　',
]);

function goTrimSpace(text: string): string {
  const chars = [...text];
  let start = 0;
  let end = chars.length;
  while (start < end && GO_SPACE.has(chars[start])) start++;
  while (end > start && GO_SPACE.has(chars[end - 1])) end--;
  return chars.slice(start, end).join('');
}

/** Go's path.Clean for `/`-separated paths. */
export function dockerCleanPath(path: string): string {
  if (path === '') return '.';
  const rooted = path.startsWith('/');
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') parts.pop();
      else if (!rooted) parts.push('..');
      continue;
    }
    parts.push(part);
  }
  const joined = parts.join('/');
  if (rooted) return `/${joined}`;
  return joined === '' ? '.' : joined;
}

/** Go's path.Dir: everything but the last element, cleaned. */
function goDir(path: string): string {
  const slash = path.lastIndexOf('/');
  return dockerCleanPath(path.slice(0, slash + 1));
}

/** Reads a .dockerignore file. On a bad line, says which and why. */
export function parseDockerignore(text: string): DockerignoreParse {
  const lines = text.split('\n');
  const patterns: { pattern: string; line: number }[] = [];
  for (const [index, raw] of lines.entries()) {
    // bufio.Scanner splits on \n and drops a \r before it.
    let line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (index === 0 && line.startsWith('﻿')) line = line.slice(1);
    if (line.startsWith('#')) continue;
    let pattern = goTrimSpace(line);
    if (pattern === '') continue;
    const exception = pattern.startsWith('!');
    if (exception) pattern = goTrimSpace(pattern.slice(1));
    if (pattern.length > 0) {
      pattern = dockerCleanPath(pattern);
      if (pattern.length > 1 && pattern.startsWith('/')) pattern = pattern.slice(1);
    }
    patterns.push({ pattern: exception ? `!${pattern}` : pattern, line: index + 1 });
  }
  return compile(patterns);
}

/** Compiles patterns the way moby's patternmatcher.New does, numbering them from 1. */
export function compileDockerignorePatterns(patterns: readonly string[]): DockerignoreParse {
  return compile(patterns.map((pattern, index) => ({ pattern, line: index + 1 })));
}

function compile(patterns: readonly { pattern: string; line: number }[]): DockerignoreParse {
  const rules: CompiledRule[] = [];
  for (const { pattern: raw, line } of patterns) {
    let pattern = goTrimSpace(raw);
    if (pattern === '') continue;
    pattern = dockerCleanPath(pattern);
    const exception = pattern.startsWith('!');
    if (exception) {
      if (pattern.length === 1) {
        return {
          ok: false,
          line,
          reason: 'A "!" with nothing after it has no pattern to make an exception for.',
        };
      }
      pattern = pattern.slice(1);
    }
    const compiled = compilePattern(pattern);
    if (typeof compiled === 'string') {
      return { ok: false, line, reason: `The pattern ${JSON.stringify(pattern)} ${compiled}` };
    }
    rules.push({ pattern, exception, line, ...compiled });
  }
  return { ok: true, matcher: createMatcher(rules) };
}

/** Escapes a character for a JavaScript regular expression in unicode mode. */
function literal(char: string): string {
  return /[\\^$.*+?()[\]{}|/]/.test(char) ? `\\${char}` : char;
}

/** Escapes a character inside a character class in unicode mode. */
function classLiteral(char: string): string {
  return /[\\\]^-]/.test(char) ? `\\${char}` : char;
}

/**
 * moby's Pattern.compile, read with `/` as the separator: decides how a pattern is matched
 * (exact, prefix, suffix, or as a regular expression) and builds the expression, refusing the
 * syntax filepath.Match refuses plus the few forms whose meaning differs between the two.
 */
function compilePattern(pattern: string): { type: MatchType; regexp: RegExp | null } | string {
  const chars = [...pattern];
  let source = '^';
  let type: MatchType = 'exact';
  let at = 0;
  for (let step = 0; at < chars.length; step++) {
    const char = chars[at++];
    if (char === '*') {
      if (chars[at] === '*') {
        at++;
        if (chars[at] === '/') at++;
        if (at >= chars.length) {
          if (type === 'exact') {
            type = 'prefix';
          } else {
            source += '[^\\n]*';
            type = 'regexp';
          }
        } else {
          source += '([^\\n]*/)?';
          type = 'regexp';
        }
        if (step === 0) type = 'suffix';
      } else {
        source += '[^/]*';
        type = 'regexp';
      }
    } else if (char === '?') {
      source += '[^/]';
      type = 'regexp';
    } else if (char === '\\') {
      const next = chars[at++];
      if (next === undefined) return 'ends with a backslash, which escapes nothing.';
      if (/[\p{L}\p{N}]/u.test(next) || next > '\u007f') {
        return 'has a backslash before a letter or digit. Docker reads that two different ways; escape only punctuation.';
      }
      source += literal(next);
      type = 'regexp';
    } else if (char === '[') {
      const parsed = characterClass(chars, at);
      if (typeof parsed === 'string') return parsed;
      source += parsed.source;
      at = parsed.next;
      type = 'regexp';
    } else if (char === ']') {
      source += '\\]';
      type = 'regexp';
    } else if (char === '^') {
      return 'has a ^ outside brackets, which Docker reads two different ways. Write \\^ for the character.';
    } else {
      source += literal(char);
    }
  }
  if (type !== 'regexp') return { type, regexp: null };
  try {
    return { type, regexp: new RegExp(`${source}$`, 'u') };
  } catch {
    return 'is not a valid pattern.';
  }
}

/**
 * One `[...]` class, read with filepath.Match's rules (getEsc): at least one item, `-` and `]`
 * only escaped, `\` escaping the next character, and a closing `]`. `*` and `?` inside brackets
 * mean different things to Docker's check and its match, so they must be escaped too.
 */
function characterClass(
  chars: readonly string[],
  start: number,
): { source: string; next: number } | string {
  const unclosed = 'has a [ that is never closed with ].';
  let at = start;
  let negated = false;
  if (chars[at] === '^') {
    negated = true;
    at++;
  }
  const items: string[] = [];
  const item = (): string | { char: string } => {
    const char = chars[at];
    if (char === undefined) return unclosed;
    if (char === '-' || char === ']') {
      return 'has a [...] with a - or ] that needs a backslash before it.';
    }
    if (char === '*' || char === '?') {
      return `has a ${char} inside [...], which Docker reads two different ways. Write \\${char} for the character.`;
    }
    at++;
    let value = char;
    if (char === '\\') {
      const next = chars[at++];
      if (next === undefined) return unclosed;
      if (/[\p{L}\p{N}]/u.test(next) || next > '\u007f') {
        return 'has a backslash before a letter or digit inside [...]. Escape only punctuation.';
      }
      value = next;
    }
    if (at >= chars.length) return unclosed;
    return { char: value };
  };
  for (;;) {
    if (chars[at] === ']' && items.length > 0) {
      at++;
      break;
    }
    const low = item();
    if (typeof low === 'string') return low;
    let high = low;
    if (chars[at] === '-') {
      at++;
      const read = item();
      if (typeof read === 'string') return read;
      high = read;
    }
    if ((high.char.codePointAt(0) ?? 0) < (low.char.codePointAt(0) ?? 0)) {
      return `has the range ${low.char}-${high.char}, which runs backwards.`;
    }
    items.push(
      high.char === low.char
        ? classLiteral(low.char)
        : `${classLiteral(low.char)}-${classLiteral(high.char)}`,
    );
  }
  return { source: `[${negated ? '^' : ''}${items.join('')}]`, next: at };
}

function matchesRule(rule: CompiledRule, path: string): boolean {
  switch (rule.type) {
    case 'exact':
      return path === rule.pattern;
    case 'prefix':
      return path.startsWith(rule.pattern.slice(0, -2));
    case 'suffix': {
      const suffix = rule.pattern.slice(2);
      return path.endsWith(suffix) || (suffix.startsWith('/') && path === suffix.slice(1));
    }
    case 'regexp':
      return rule.regexp?.test(path) ?? false;
  }
}

/** BuildKit's patternWithoutTrailingGlob: `a/b/**` and `a/b/*` both reach only into `a/b`. */
function withoutTrailingGlob(pattern: string): string {
  let trimmed = pattern;
  if (trimmed.endsWith('/**')) trimmed = trimmed.slice(0, -3);
  if (trimmed.endsWith('/*')) trimmed = trimmed.slice(0, -2);
  return trimmed;
}

function createMatcher(rules: readonly CompiledRule[]): DockerignoreMatcher {
  const exceptions = rules.filter((rule) => rule.exception);
  const prefixOnly = exceptions.every((rule) => !/[*?[\\]/.test(withoutTrailingGlob(rule.pattern)));
  return {
    rules: rules.map(({ pattern, exception, line }) => ({ pattern, exception, line })),
    excludes(path: string): boolean {
      const file = dockerCleanPath(path);
      if (file === '.') return false;
      const parent = goDir(file);
      const parentParts = parent.split('/');
      let excluded = false;
      for (const rule of rules) {
        if (rule.exception !== excluded) continue;
        let match = matchesRule(rule, file);
        if (!match && parent !== '.') {
          for (let depth = 1; depth <= parentParts.length && !match; depth++) {
            match = matchesRule(rule, parentParts.slice(0, depth).join('/'));
          }
        }
        if (match) excluded = !rule.exception;
      }
      return excluded;
    },
    canSkipFolder(path: string): boolean {
      if (exceptions.length === 0) return true;
      if (!prefixOnly) return false;
      const folder = `${dockerCleanPath(path)}/`;
      return !exceptions.some((rule) => `${rule.pattern}/`.startsWith(folder));
    },
  };
}
