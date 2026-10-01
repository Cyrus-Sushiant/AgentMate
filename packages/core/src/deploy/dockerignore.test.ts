import { describe, expect, it } from 'vitest';
import {
  compileDockerignorePatterns,
  type DockerignoreMatcher,
  dockerCleanPath,
  parseDockerignore,
} from './dockerignore.js';

function matcher(text: string): DockerignoreMatcher {
  const parsed = parseDockerignore(text);
  if (!parsed.ok) throw new Error(`line ${parsed.line}: ${parsed.reason}`);
  return parsed.matcher;
}

function patterns(list: string[]): DockerignoreMatcher {
  const compiled = compileDockerignorePatterns(list);
  if (!compiled.ok) throw new Error(`pattern ${compiled.line}: ${compiled.reason}`);
  return compiled.matcher;
}

/**
 * The cases below are copied from moby/patternmatcher's patternmatcher_test.go (TestMatches, the
 * multi-pattern cases, and the filepath.Match cases it borrows from Go), which is the code
 * Docker and BuildKit use to read .dockerignore, run with Linux path rules, as on the server.
 */
describe('moby/patternmatcher TestMatches', () => {
  const cases: [string, string, boolean][] = [
    ['**', 'file', true],
    ['**', 'file/', true],
    ['**/', 'file', true],
    ['**/', 'file/', true],
    ['**', '/', true],
    ['**/', '/', true],
    ['**', 'dir/file', true],
    ['**/', 'dir/file', true],
    ['**', 'dir/file/', true],
    ['**/', 'dir/file/', true],
    ['**/**', 'dir/file', true],
    ['**/**', 'dir/file/', true],
    ['dir/**', 'dir/file', true],
    ['dir/**', 'dir/file/', true],
    ['dir/**', 'dir/dir2/file', true],
    ['dir/**', 'dir/dir2/file/', true],
    ['**/dir', 'dir', true],
    ['**/dir', 'dir/file', true],
    ['**/dir2/*', 'dir/dir2/file', true],
    ['**/dir2/*', 'dir/dir2/file/', true],
    ['**/dir2/**', 'dir/dir2/dir3/file', true],
    ['**/dir2/**', 'dir/dir2/dir3/file/', true],
    ['**file', 'file', true],
    ['**file', 'dir/file', true],
    ['**/file', 'dir/file', true],
    ['**file', 'dir/dir/file', true],
    ['**/file', 'dir/dir/file', true],
    ['**/file*', 'dir/dir/file', true],
    ['**/file*', 'dir/dir/file.txt', true],
    ['**/file*txt', 'dir/dir/file.txt', true],
    ['**/file*.txt', 'dir/dir/file.txt', true],
    ['**/file*.txt*', 'dir/dir/file.txt', true],
    ['**/**/*.txt', 'dir/dir/file.txt', true],
    ['**/**/*.txt2', 'dir/dir/file.txt', false],
    ['**/*.txt', 'file.txt', true],
    ['**/**/*.txt', 'file.txt', true],
    ['a**/*.txt', 'a/file.txt', true],
    ['a**/*.txt', 'a/dir/file.txt', true],
    ['a**/*.txt', 'a/dir/dir/file.txt', true],
    ['a/*.txt', 'a/dir/file.txt', false],
    ['a/*.txt', 'a/file.txt', true],
    ['a/*.txt**', 'a/file.txt', true],
    ['a[b-d]e', 'ae', false],
    ['a[b-d]e', 'ace', true],
    ['a[b-d]e', 'aae', false],
    ['a[^b-d]e', 'aze', true],
    ['.*', '.foo', true],
    ['.*', 'foo', false],
    ['abc.def', 'abcdef', false],
    ['abc.def', 'abc.def', true],
    ['abc.def', 'abcZdef', false],
    ['abc?def', 'abcZdef', true],
    ['abc?def', 'abcdef', false],
    ['a\\\\', 'a\\', true],
    ['**/foo/bar', 'foo/bar', true],
    ['**/foo/bar', 'dir/foo/bar', true],
    ['**/foo/bar', 'dir/dir2/foo/bar', true],
    ['abc/**', 'abc', false],
    ['abc/**', 'abc/def', true],
    ['abc/**', 'abc/def/ghi', true],
    ['**/.foo', '.foo', true],
    ['**/.foo', 'bar.foo', false],
    ['a(b)c/def', 'a(b)c/def', true],
    ['a(b)c/def', 'a(b)c/xyz', false],
    ['a.|)$(}+{bc', 'a.|)$(}+{bc', true],
    [
      'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
      'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
      true,
    ],
    ['dist/*.whl', 'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl', true],
    // Linux only in moby, which is where these patterns are read.
    ['a\\*b', 'a*b', true],
  ];

  it.each(cases)('%s against %s gives %s', (pattern, path, excluded) => {
    expect(patterns([pattern]).excludes(path)).toBe(excluded);
  });

  const multi: [string[], string, boolean][] = [
    [['**', '!util/docker/web'], 'util/docker/web/foo', false],
    [['**', '!util/docker/web', 'util/docker/web/foo'], 'util/docker/web/foo', true],
    [
      ['**', '!dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl'],
      'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl',
      false,
    ],
    [['**', '!dist/*.whl'], 'dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl', false],
  ];

  it.each(multi)('%j against %s gives %s', (list, path, excluded) => {
    expect(patterns(list).excludes(path)).toBe(excluded);
  });

  it('keeps the simple cases moby checks one by one', () => {
    expect(patterns(['*']).excludes('fileutils.go')).toBe(true);
    expect(patterns(['*.go']).excludes('fileutils.go')).toBe(true);
    expect(patterns(['!fileutils.go', '*.go']).excludes('fileutils.go')).toBe(true);
    expect(patterns(['docs', '!docs/README.md']).excludes('docs/README.md')).toBe(false);
    expect(patterns(['docs/', '!docs/README.md']).excludes('docs/README.md')).toBe(false);
    expect(patterns(['docs/*', '!docs/README.md']).excludes('docs/README.md')).toBe(false);
    expect(patterns(['*.go', '!fileutils.go']).excludes('fileutils.go')).toBe(false);
    expect(patterns(['*.go']).excludes('.')).toBe(false);
    expect(patterns([]).excludes('/any/path/there')).toBe(false);
    expect(patterns(['docs', 'config', '']).rules).toHaveLength(2);
    expect(patterns(['docs', '  !docs/README.md']).rules[1].exception).toBe(true);
    expect(patterns(['docs', '!docs/README.md  ']).rules[1].exception).toBe(true);
  });

  it('refuses a lone ! and malformed patterns', () => {
    expect(compileDockerignorePatterns(['!'])).toMatchObject({ ok: false, line: 1 });
    expect(compileDockerignorePatterns(['['])).toMatchObject({ ok: false, line: 1 });
    // moby accepts this one, then fails on every match: the range l-O runs backwards.
    expect(compileDockerignorePatterns(['[Local-Only]/'])).toMatchObject({ ok: false });
  });
});

describe("Go's filepath.Match cases, as moby/patternmatcher runs them", () => {
  const cases: [string, string, boolean][] = [
    ['abc', 'abc', true],
    ['*', 'abc', true],
    ['*c', 'abc', true],
    ['a*', 'a', true],
    ['a*', 'abc', true],
    ['a*', 'ab/c', true],
    ['a*/b', 'abc/b', true],
    ['a*/b', 'a/c/b', false],
    ['a*b*c*d*e*/f', 'axbxcxdxe/f', true],
    ['a*b*c*d*e*/f', 'axbxcxdxexxx/f', true],
    ['a*b*c*d*e*/f', 'axbxcxdxe/xxx/f', false],
    ['a*b*c*d*e*/f', 'axbxcxdxexxx/fff', false],
    ['a*b?c*x', 'abxbbxdbxebxczzx', true],
    ['a*b?c*x', 'abxbbxdbxebxczzy', false],
    ['ab[c]', 'abc', true],
    ['ab[b-d]', 'abc', true],
    ['ab[e-g]', 'abc', false],
    ['ab[^c]', 'abc', false],
    ['ab[^b-d]', 'abc', false],
    ['ab[^e-g]', 'abc', true],
    ['a\\*b', 'a*b', true],
    ['a\\*b', 'ab', false],
    ['a?b', 'a☺b', true],
    ['a[^a]b', 'a☺b', true],
    ['a???b', 'a☺b', false],
    ['a[^a][^a][^a]b', 'a☺b', false],
    ['[a-ζ]*', 'α', true],
    ['*[a-ζ]', 'A', false],
    ['a?b', 'a/b', false],
    ['a*b', 'a/b', false],
    ['[\\]a]', ']', true],
    ['[\\-]', '-', true],
    ['[x\\-]', 'x', true],
    ['[x\\-]', '-', true],
    ['[x\\-]', 'z', false],
    ['[\\-x]', 'x', true],
    ['[\\-x]', '-', true],
    ['[\\-x]', 'a', false],
    ['*x', 'xxx', true],
  ];

  it.each(cases)('%s against %s gives %s', (pattern, path, excluded) => {
    expect(patterns([pattern]).excludes(path)).toBe(excluded);
  });

  it.each(['[]a]', '[-]', '[x-]', '[-x]', '\\', '[a-b-c]', '[', '[^', '[^bc', 'a['])(
    'refuses the malformed pattern %s',
    (pattern) => {
      const compiled = compileDockerignorePatterns([pattern]);
      expect(compiled.ok).toBe(false);
    },
  );
});

describe("the examples in Docker's .dockerignore documentation", () => {
  it('reads comments and the documented wildcard examples', () => {
    const ignore = matcher('# comment\n*/temp*\n*/*/temp*\ntemp?\n');
    expect(ignore.rules.map((rule) => rule.pattern)).toEqual(['*/temp*', '*/*/temp*', 'temp?']);
    // */temp*: names starting with temp in any immediate subdirectory of the root.
    expect(ignore.excludes('somedir/temporary.txt')).toBe(true);
    expect(ignore.excludes('somedir/temp')).toBe(true);
    // */*/temp*: the same two levels below the root.
    expect(ignore.excludes('somedir/subdir/temporary.txt')).toBe(true);
    // temp?: a one-character extension of temp, in the root.
    expect(ignore.excludes('tempa')).toBe(true);
    expect(ignore.excludes('tempb')).toBe(true);
    expect(ignore.excludes('temp')).toBe(false);
    expect(ignore.excludes('temporary.txt')).toBe(false);
    expect(ignore.excludes('a/b/c/temp.txt')).toBe(false);
  });

  it('treats ** as any number of folders, including none', () => {
    const ignore = matcher('**/*.go');
    expect(ignore.excludes('main.go')).toBe(true);
    expect(ignore.excludes('cmd/server/main.go')).toBe(true);
    expect(ignore.excludes('main.go.txt')).toBe(false);
  });

  it('makes exceptions with !, the last matching line winning', () => {
    const readme = matcher('*.md\n!README.md');
    expect(readme.excludes('CHANGELOG.md')).toBe(true);
    expect(readme.excludes('README.md')).toBe(false);
    // Markdown files under subdirectories are still included.
    expect(readme.excludes('docs/guide.md')).toBe(false);

    const secret = matcher('*.md\n!README*.md\nREADME-secret.md');
    expect(secret.excludes('README-secret.md')).toBe(true);
    expect(secret.excludes('README.md')).toBe(false);
    expect(secret.excludes('README-public.md')).toBe(false);
    expect(secret.excludes('notes.md')).toBe(true);

    const all = matcher('*.md\nREADME-secret.md\n!README*.md');
    expect(all.excludes('README-secret.md')).toBe(false);
    expect(all.excludes('notes.md')).toBe(true);
  });

  it('treats the context root as both the working and the root folder', () => {
    for (const text of ['/foo/bar', 'foo/bar']) {
      const ignore = matcher(text);
      expect(ignore.excludes('foo/bar')).toBe(true);
      expect(ignore.excludes('foo/bar/inside.txt')).toBe(true);
      expect(ignore.excludes('foo')).toBe(false);
      expect(ignore.excludes('bar')).toBe(false);
      expect(ignore.excludes('x/foo/bar')).toBe(false);
    }
  });

  it('cleans each pattern the way filepath.Clean does', () => {
    expect(matcher('./node_modules/').rules[0].pattern).toBe('node_modules');
    expect(matcher('a/../b//c/.').rules[0].pattern).toBe('b/c');
    expect(matcher('!./keep/').rules[0]).toMatchObject({ pattern: 'keep', exception: true });
    expect(matcher('node_modules/').excludes('node_modules/left-pad/index.js')).toBe(true);
  });

  it('only treats # in the first column as a comment, and skips blank lines', () => {
    const ignore = matcher(
      '﻿# first line comment despite the BOM\r\n\r\n   \n  # kept\r\n*.log\r\n',
    );
    expect(ignore.rules.map((rule) => rule.pattern)).toEqual(['# kept', '*.log']);
    expect(ignore.rules[1].line).toBe(5);
    expect(ignore.excludes('debug.log')).toBe(true);
  });
});

describe('patterns Docker would read inconsistently are refused with a reason', () => {
  it.each([
    ['a^b*', /\^/],
    ['a\\d', /backslash/],
    ['[*]', /inside \[/],
    ['[z-a]', /backwards/],
    ['!', /nothing after/],
  ])('%s', (pattern, why) => {
    const parsed = parseDockerignore(`ok\n${pattern}\n`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.line).toBe(2);
      expect(parsed.reason).toMatch(why);
    }
  });

  it('accepts escaped punctuation, which both readers agree on', () => {
    const ignore = matcher('a\\^b*\nweird\\[name\\]\n[\\*]');
    expect(ignore.excludes('a^bc')).toBe(true);
    expect(ignore.excludes('weird[name]')).toBe(true);
    expect(ignore.excludes('*')).toBe(true);
  });
});

describe('canSkipFolder', () => {
  it('lets the walker skip a left-out folder unless an exception reaches inside it', () => {
    const plain = matcher('node_modules\n.git');
    expect(plain.excludes('node_modules')).toBe(true);
    expect(plain.canSkipFolder('node_modules')).toBe(true);

    const exception = matcher('docs\nnode_modules\n!docs/README.md');
    expect(exception.canSkipFolder('docs')).toBe(false);
    expect(exception.canSkipFolder('node_modules')).toBe(true);
    expect(exception.excludes('docs/README.md')).toBe(false);
    expect(exception.excludes('docs/other.md')).toBe(true);

    const trailing = matcher('docs\nother\n!docs/*');
    expect(trailing.canSkipFolder('docs')).toBe(false);
    expect(trailing.canSkipFolder('other')).toBe(true);
  });

  it('never skips when an exception has a wildcard, since it could match anywhere', () => {
    const wildcard = matcher('docs\nvendor\n!**/*.md');
    expect(wildcard.canSkipFolder('docs')).toBe(false);
    expect(wildcard.canSkipFolder('vendor')).toBe(false);
    expect(wildcard.excludes('vendor/pkg/README.md')).toBe(false);
    expect(wildcard.excludes('vendor/pkg/main.go')).toBe(true);
  });
});

describe('dockerCleanPath', () => {
  it.each([
    ['', '.'],
    ['.', '.'],
    ['a/', 'a'],
    ['./a//b/./c/', 'a/b/c'],
    ['a/b/../c', 'a/c'],
    ['a/../..', '..'],
    ['../../a', '../../a'],
    ['/../a', '/a'],
    ['/', '/'],
    ['//a', '/a'],
  ])('%s cleans to %s', (path, cleaned) => {
    expect(dockerCleanPath(path)).toBe(cleaned);
  });
});
