import type { DiscoveredTest } from '../types.js';
import { cleanCLike, countBraces, pruneEmptySuites } from './shared.js';

/**
 * Line based test finders for the non-JS languages. Each one knows the handful of shapes its
 * frameworks use to declare a test and tracks just enough nesting (indentation or braces) to name
 * the class or module a test belongs to.
 */

export function discoverPythonTests(source: string): DiscoveredTest[] {
  const out: DiscoveredTest[] = [];
  const stack: { indent: number; kind: 'class' | 'def'; name: string; isTestClass: boolean }[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    const match = /^(\s*)(?:async\s+)?(class|def)\s+(\w+)\s*(\([^)]*\))?/.exec(text);
    if (!match) return;
    const indent = match[1].replace(/\t/g, '    ').length;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const [, , keyword, name, bases = ''] = match;
    const parent = stack[stack.length - 1];
    const classes = stack.map((entry) => entry.name);
    const line = index + 1;

    if (keyword === 'class') {
      const insideTests = !parent || (parent.kind === 'class' && parent.isTestClass);
      const isTestClass = insideTests && (name.startsWith('Test') || /TestCase\b/.test(bases));
      stack.push({ indent, kind: 'class', name, isTestClass });
      if (isTestClass) out.push({ kind: 'suite', path: [...classes, name], line });
      return;
    }
    const isTest =
      name.startsWith('test') && (!parent || (parent.kind === 'class' && parent.isTestClass));
    stack.push({ indent, kind: 'def', name, isTestClass: false });
    if (isTest) out.push({ kind: 'test', path: [...classes, name], line });
  });
  return pruneEmptySuites(out);
}

export function discoverGoTests(source: string): DiscoveredTest[] {
  const out: DiscoveredTest[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    const match = /^func\s+(Test(?:[^a-z\W]\w*)?)\s*\(\s*\w+\s+\*testing\.T\s*\)/.exec(text);
    if (match) out.push({ kind: 'test', path: [match[1]], line: index + 1 });
  });
  return out;
}

/**
 * `file` is relative to the crate root. Test names in `cargo test` start from the crate root, so a
 * test in `src/net/http.rs` is `net::http::name`, while `src/lib.rs`, `src/main.rs` and every
 * integration test file under `tests/` are crate roots of their own.
 */
export function discoverRustTests(source: string, file: string): DiscoveredTest[] {
  const out: DiscoveredTest[] = [];
  const fileModules = rustFileModules(file);
  const stack: { name: string; depth: number }[] = [];
  let depth = 0;
  let pendingAttribute = false;

  for (const { line, code } of cleanCLike(source, { singleQuoteStrings: false })) {
    const trimmed = code.trim();
    if (/^#\[\s*(?:[\w:]+::)?(test|rstest|test_case|quickcheck)\b/.test(trimmed)) {
      pendingAttribute = true;
    }
    const fn = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/.exec(
      trimmed.replace(/^(#\[[^\]]*\]\s*)+/, ''),
    );
    if (fn && pendingAttribute) {
      const modules = [...fileModules, ...stack.map((entry) => entry.name)];
      out.push({
        kind: 'test',
        path: [...modules, fn[1]],
        line,
        selector: [...modules, fn[1]].join('::'),
      });
      pendingAttribute = false;
    } else if (fn) {
      pendingAttribute = false;
    }
    const mod = /^(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*\{/.exec(trimmed);
    const { open, close } = countBraces(code);
    if (mod) stack.push({ name: mod[1], depth: depth + 1 });
    depth += open - close;
    while (stack.length > 0 && stack[stack.length - 1].depth > depth) stack.pop();
  }
  return out;
}

function rustFileModules(file: string): string[] {
  const parts = file.replace(/\\/g, '/').split('/');
  if (parts[0] !== 'src') return [];
  const rest = parts.slice(1);
  if (rest[0] === 'bin') return [];
  const last = rest.pop() ?? '';
  const stem = last.replace(/\.rs$/, '');
  if (rest.length === 0 && (stem === 'lib' || stem === 'main')) return [];
  return stem === 'mod' ? rest : [...rest, stem];
}

interface Scope {
  kind: 'namespace' | 'class';
  name: string;
  depth: number;
}

/**
 * Brace tracking shared by C#, Java/Kotlin and PHP: remembers the namespace or package, the
 * enclosing classes, and whether a test marker was seen since the last declaration.
 */
function scanClassLanguage(
  source: string,
  options: {
    singleQuoteStrings: boolean;
    isTestMarker: (raw: string, code: string) => boolean;
    method: (code: string, pending: boolean) => string | null;
    namespace: (code: string) => { name: string; block: boolean } | null;
    selector: (namespace: string, classes: string[], method: string) => string;
  },
): DiscoveredTest[] {
  const out: DiscoveredTest[] = [];
  const scopes: Scope[] = [];
  let fileNamespace = '';
  let depth = 0;
  let pending = false;
  let pendingScope: Omit<Scope, 'depth'> | null = null;

  for (const { line, raw, code } of cleanCLike(source, {
    singleQuoteStrings: options.singleQuoteStrings,
  })) {
    const namespace = options.namespace(code);
    if (namespace && !namespace.block) fileNamespace = namespace.name;
    if (namespace?.block) pendingScope = { kind: 'namespace', name: namespace.name };

    const classMatch = /\b(?:class|record|object)\s+(\w+)/.exec(code);
    if (classMatch && !/^\s*(?:\/\/|\*)/.test(raw)) {
      pendingScope = { kind: 'class', name: classMatch[1] };
      const classes = scopes.filter((scope) => scope.kind === 'class').map((scope) => scope.name);
      out.push({ kind: 'suite', path: [...classes, classMatch[1]], line });
      pending = false;
      // `class Foo {` opens on the same line more often than not.
    }

    if (options.isTestMarker(raw, code)) pending = true;
    const method = classMatch ? null : options.method(code, pending);
    if (method) {
      const classes = scopes.filter((scope) => scope.kind === 'class').map((scope) => scope.name);
      if (classes.length > 0) {
        const ns = [
          fileNamespace,
          ...scopes.filter((scope) => scope.kind === 'namespace').map((scope) => scope.name),
        ]
          .filter(Boolean)
          .join('.');
        out.push({
          kind: 'test',
          path: [...classes, method],
          line,
          selector: options.selector(ns, classes, method),
        });
      }
      pending = false;
    }

    for (const char of code) {
      if (char === '{') {
        depth += 1;
        if (pendingScope) {
          scopes.push({ ...pendingScope, depth });
          pendingScope = null;
        }
      } else if (char === '}') {
        depth -= 1;
        while (scopes.length > 0 && scopes[scopes.length - 1].depth > depth) scopes.pop();
      }
    }
  }
  return pruneEmptySuites(out);
}

const CSHARP_TEST_ATTRIBUTE =
  /\[[^\]]*\b(Fact|Theory|Test|TestCase|TestCaseSource|TestMethod|DataTestMethod|SkippableFact|SkippableTheory)\b/;

export function discoverCsharpTests(source: string): DiscoveredTest[] {
  return scanClassLanguage(source, {
    singleQuoteStrings: false,
    isTestMarker: (_raw, code) => CSHARP_TEST_ATTRIBUTE.test(code),
    method: (code, pending) => {
      if (!pending) return null;
      const rest = code.replace(/^\s*(\[[^\]]*\]\s*)+/, '');
      if (rest.trim() === '' || rest.trim().startsWith('[')) return null;
      return /(\w+)\s*(?:<[^>]*>)?\s*\(/.exec(rest)?.[1] ?? null;
    },
    namespace: (code) => {
      const match = /^\s*namespace\s+([\w.]+)\s*(;|\{|$)/.exec(code);
      return match ? { name: match[1], block: match[2] !== ';' } : null;
    },
    selector: (ns, classes, method) =>
      [ns, `${classes.join('+')}.${method}`].filter(Boolean).join('.'),
  });
}

const JVM_TEST_ANNOTATION = /@(Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)\b/;

export function discoverJvmTests(source: string): DiscoveredTest[] {
  return scanClassLanguage(source, {
    singleQuoteStrings: false,
    isTestMarker: (_raw, code) => JVM_TEST_ANNOTATION.test(code),
    method: (code, pending) => {
      if (!pending) return null;
      const rest = code.replace(/^\s*(@\w+(\([^)]*\))?\s*)+/, '');
      if (rest.trim() === '') return null;
      const kotlin = /\bfun\s+(`[^`]+`|\w+)\s*\(/.exec(rest);
      if (kotlin) return kotlin[1].replace(/`/g, '');
      return /(\w+)\s*\(/.exec(rest)?.[1] ?? null;
    },
    namespace: (code) => {
      const match = /^\s*package\s+([\w.]+)/.exec(code);
      return match ? { name: match[1], block: false } : null;
    },
    selector: (ns, classes, method) =>
      [ns, `${classes.join('$')}.${method}`].filter(Boolean).join('.'),
  });
}

export function discoverPhpTests(source: string): DiscoveredTest[] {
  return scanClassLanguage(source, {
    singleQuoteStrings: true,
    isTestMarker: (raw, code) => /@test\b/.test(raw) || /#\[\s*(?:\\?[\w\\]*\\)?Test\b/.test(code),
    method: (code, pending) => {
      const match = /\bfunction\s+(\w+)\s*\(/.exec(code);
      if (!match || /\b(private|protected)\b/.test(code)) return null;
      return pending || match[1].startsWith('test') ? match[1] : null;
    },
    namespace: (code) => {
      const match = /^\s*namespace\s+([\w\\]+)\s*(;|\{)/.exec(code);
      return match ? { name: match[1], block: match[2] === '{' } : null;
    },
    selector: (ns, classes, method) =>
      `${[ns.replace(/\./g, '\\'), classes.join('\\')].filter(Boolean).join('\\')}::${method}`,
  });
}

export function discoverRubyTests(source: string): DiscoveredTest[] {
  const out: DiscoveredTest[] = [];
  const stack: { indent: number; name: string }[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    const suite =
      /^(\s*)(?:RSpec\.)?(?:describe|context|feature|shared_examples|shared_context)\s*\(?\s*(?:(['"])(.*?)\2|([A-Z][\w:]*))/.exec(
        text,
      );
    const test = /^(\s*)(?:it|specify|example|scenario|its)\s*\(?\s*(['"])(.*?)\2/.exec(text);
    const match = suite ?? test;
    if (!match) return;
    const indent = match[1].length;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parents = stack.map((entry) => entry.name);
    if (suite) {
      const name = suite[3] ?? suite[4];
      out.push({ kind: 'suite', path: [...parents, name], line: index + 1 });
      stack.push({ indent, name });
    } else if (test) {
      out.push({ kind: 'test', path: [...parents, test[3]], line: index + 1 });
    }
  });
  return pruneEmptySuites(out);
}
