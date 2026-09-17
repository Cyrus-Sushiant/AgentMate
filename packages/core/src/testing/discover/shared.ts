import type { DiscoveredTest } from '../types.js';

/** Drops suites with no tests below them, like a helper class or an empty describe. */
export function pruneEmptySuites(found: DiscoveredTest[]): DiscoveredTest[] {
  const tests = found.filter((entry) => entry.kind === 'test');
  return found.filter(
    (entry) =>
      entry.kind === 'test' ||
      tests.some(
        (test) =>
          test.path.length > entry.path.length &&
          entry.path.every((segment, index) => test.path[index] === segment),
      ),
  );
}

export interface CleanLine {
  /** 1-based. */
  line: number;
  /** The raw text, for things that live in comments such as a PHP `@test` docblock. */
  raw: string;
  /** String and char literals emptied, comments removed, so braces can be counted safely. */
  code: string;
}

/**
 * Splits C-family source into lines with literals and comments blanked out. Block comments and
 * multi-line strings carry over between lines. `charQuotes` lists quote characters that delimit
 * short literals (like `'a'` in Rust or Java) rather than full strings.
 */
export function cleanCLike(
  source: string,
  options: { singleQuoteStrings: boolean; hashComments?: boolean },
): CleanLine[] {
  const lines = source.split(/\r?\n/);
  const out: CleanLine[] = [];
  let inBlockComment = false;
  let inString: string | null = null;
  lines.forEach((raw, index) => {
    let code = '';
    let i = 0;
    while (i < raw.length) {
      const char = raw[i];
      const next = raw[i + 1];
      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          i += 2;
        } else i += 1;
        continue;
      }
      if (inString) {
        if (char === '\\') i += 2;
        else if (char === inString) {
          code += inString;
          inString = null;
          i += 1;
        } else i += 1;
        continue;
      }
      if (char === '/' && next === '/') break;
      if (options.hashComments && char === '#' && next !== '[') break;
      if (char === '/' && next === '*') {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (char === '"' || (char === "'" && options.singleQuoteStrings)) {
        code += char;
        inString = char;
        i += 1;
        continue;
      }
      if (char === "'" && !options.singleQuoteStrings) {
        // A char literal ('a', '\n', '}') or a Rust lifetime ('a with no closing quote).
        const literal = /^'(?:\\.[^']*|[^\\'])'/.exec(raw.slice(i));
        if (literal) {
          code += "''";
          i += literal[0].length;
          continue;
        }
      }
      code += char;
      i += 1;
    }
    // A plain string cannot span lines in these languages; do not let a stray quote eat the file.
    if (inString === "'" || (inString === '"' && !raw.trimEnd().endsWith('\\'))) inString = null;
    out.push({ line: index + 1, raw, code });
  });
  return out;
}

export function countBraces(code: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  for (const char of code) {
    if (char === '{') open += 1;
    else if (char === '}') close += 1;
  }
  return { open, close };
}
