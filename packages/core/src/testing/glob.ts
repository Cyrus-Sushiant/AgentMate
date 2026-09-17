/**
 * Just enough glob matching for test file patterns: `**`, `*`, `?`, `{a,b}`, `[abc]` and the
 * `@(a|b)` / `?(a|b)` groups runner defaults use. Paths are workspace relative with forward slashes.
 */

const cache = new Map<string, RegExp>();

export function globToRegExp(glob: string): RegExp {
  const cached = cache.get(glob);
  if (cached) return cached;
  const source = translate(glob.replace(/^\.\//, ''));
  const regex = new RegExp(`^${source}$`);
  cache.set(glob, regex);
  return regex;
}

export function matchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path.replace(/^\.\//, ''));
}

export function matchesAnyGlob(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}

function translate(glob: string): string {
  let out = '';
  let i = 0;
  while (i < glob.length) {
    const char = glob[i];
    const next = glob[i + 1];
    if (char === '*' && next === '*') {
      // `**/` may match no folders at all, so `**/*.ts` also matches `a.ts` at the top.
      if (glob[i + 2] === '/') {
        out += '(?:.*/)?';
        i += 3;
      } else {
        out += '.*';
        i += 2;
      }
      continue;
    }
    if (
      (char === '@' || char === '?' || char === '!' || char === '+' || char === '*') &&
      next === '('
    ) {
      const close = findClose(glob, i + 1, '(', ')');
      if (close > 0) {
        const alternatives = splitTop(glob.slice(i + 2, close), '|').map(translate);
        const group = `(?:${alternatives.join('|')})`;
        out +=
          char === '?'
            ? `${group}?`
            : char === '+'
              ? `${group}+`
              : char === '*'
                ? `${group}*`
                : group;
        i = close + 1;
        continue;
      }
    }
    if (char === '*') {
      out += '[^/]*';
    } else if (char === '?') {
      out += '[^/]';
    } else if (char === '{') {
      const close = findClose(glob, i, '{', '}');
      if (close > 0) {
        out += `(?:${splitTop(glob.slice(i + 1, close), ',')
          .map(translate)
          .join('|')})`;
        i = close + 1;
        continue;
      }
      out += '\\{';
    } else if (char === '[') {
      const close = glob.indexOf(']', i + 1);
      if (close > 0) {
        out += `[${glob.slice(i + 1, close).replace(/\\/g, '\\\\')}]`;
        i = close + 1;
        continue;
      }
      out += '\\[';
    } else {
      out += char.replace(/[.+^${}()|\\\]]/g, '\\$&');
    }
    i += 1;
  }
  return out;
}

function findClose(text: string, openAt: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openAt; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits on a separator that is not nested inside braces or parentheses. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '{' || char === '(') depth += 1;
    else if (char === '}' || char === ')') depth -= 1;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}
