import { TEST_FRAMEWORKS } from './frameworks.js';
import { matchesAnyGlob } from './glob.js';
import { baseOf, dirOf, isWithin, joinRel, relativeTo } from './paths.js';
import type { TestFrameworkId, TestProject } from './types.js';

/**
 * Works out which test frameworks a workspace uses and where each one is rooted, from the file
 * list and the text of a handful of manifests. Nothing here reads the disk: the caller asks
 * `manifestPathsToRead` which files it needs, reads them, and passes both in.
 */

export interface DetectionSnapshot {
  /** Every file in the workspace, relative with forward slashes. */
  files: readonly string[];
  /** Text of the files `manifestPathsToRead` picked. Missing entries count as unreadable. */
  contents: Readonly<Record<string, string>>;
}

const MANIFEST_NAMES = new Set([
  'package.json',
  'pyproject.toml',
  'pytest.ini',
  'setup.cfg',
  'tox.ini',
  'conftest.py',
  'go.mod',
  'Cargo.toml',
  'pubspec.yaml',
  'composer.json',
  'phpunit.xml',
  'phpunit.xml.dist',
  'Gemfile',
  '.rspec',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'pom.xml',
]);

const MANIFEST_PATTERNS = [
  /^(vitest|vite)\.(config|workspace)\.[cm]?[jt]s$/,
  /^jest\.config\.[cm]?[jt]s(on)?$/,
  /^playwright\.config\.[cm]?[jt]s$/,
  /^\.mocharc\.(c?js|json|ya?ml)$/,
  /^requirements.*\.txt$/,
  /\.(cs|fs|vb)proj$/,
];

export function manifestPathsToRead(files: readonly string[]): string[] {
  return files.filter((file) => {
    const name = baseOf(file);
    return MANIFEST_NAMES.has(name) || MANIFEST_PATTERNS.some((pattern) => pattern.test(name));
  });
}

export function detectTestProjects(snapshot: DetectionSnapshot): TestProject[] {
  const manifests = manifestPathsToRead(snapshot.files);
  const text = (path: string): string => snapshot.contents[path] ?? '';
  const found: TestProject[] = [];
  const add = (framework: TestFrameworkId, root: string, meta?: Record<string, string>): void => {
    if (found.some((project) => project.framework === framework && project.root === root)) return;
    const label = TEST_FRAMEWORKS[framework].label;
    found.push({
      id: `${framework}:${root}`,
      framework,
      root,
      label: root ? `${label} · ${root}` : label,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    });
  };

  detectJs(manifests, text, add);
  detectPython(snapshot.files, manifests, text, add);

  for (const path of manifests) {
    const name = baseOf(path);
    const root = dirOf(path);
    const body = text(path);
    if (name === 'go.mod') {
      const module = /^\s*module\s+(\S+)/m.exec(body)?.[1];
      add('go', root, module ? { module } : undefined);
    } else if (name === 'Cargo.toml') {
      if (/^\s*\[package\]/m.test(body)) add('cargo', root);
    } else if (/\.(cs|fs|vb)proj$/.test(name)) {
      if (
        /Include\s*=\s*"(xunit|xunit\.v3|NUnit|MSTest\.TestFramework|MSTest|Microsoft\.NET\.Test\.Sdk|TUnit)"/i.test(
          body,
        ) ||
        /<IsTestProject>\s*true/i.test(body) ||
        /Sdk\s*=\s*"MSTest\.Sdk/i.test(body)
      ) {
        add('dotnet', root);
      }
    } else if (name === 'pubspec.yaml') {
      if (/sdk:\s*flutter/.test(body) && /^\s+flutter_test\s*:/m.test(body)) add('flutter', root);
      else if (/^\s+test\s*:/m.test(body)) add('dart', root);
    } else if (name === 'composer.json') {
      if (/"phpunit\/phpunit"\s*:/.test(body)) add('phpunit', root);
    } else if (name === 'phpunit.xml' || name === 'phpunit.xml.dist') {
      add('phpunit', root);
    } else if (name === 'Gemfile') {
      if (/^\s*gem\s+['"]rspec/m.test(body)) add('rspec', root);
    } else if (name === '.rspec') {
      add('rspec', root);
    } else if (/^(build|settings)\.gradle(\.kts)?$/.test(name)) {
      if (hasAncestorWith(manifests, root, /^(build|settings)\.gradle(\.kts)?$/)) continue;
      const wrapper = snapshot.files.some(
        (file) => dirOf(file) === root && /^gradlew(\.bat)?$/.test(baseOf(file)),
      );
      add('gradle', root, wrapper ? { wrapper: 'true' } : undefined);
    } else if (name === 'pom.xml') {
      if (hasAncestorWith(manifests, root, /^pom\.xml$/)) continue;
      add('maven', root);
    }
  }

  return found.sort((a, b) =>
    a.root === b.root ? a.framework.localeCompare(b.framework) : a.root.localeCompare(b.root),
  );
}

type Add = (framework: TestFrameworkId, root: string, meta?: Record<string, string>) => void;

function detectJs(manifests: string[], text: (path: string) => string, add: Add): void {
  const packageRoots = manifests.filter((path) => baseOf(path) === 'package.json').map(dirOf);
  /** The package a config file belongs to: the nearest package.json at or above it. */
  const ownerOf = (path: string): string | undefined =>
    packageRoots
      .filter((root) => isWithin(dirOf(path), root))
      .sort((a, b) => b.length - a.length)[0];
  const configsOf = (root: string, pattern: RegExp): string[] =>
    manifests.filter((path) => pattern.test(baseOf(path)) && ownerOf(path) === root);

  for (const root of packageRoots) {
    const pkg = parseJson(text(joinRel(root, 'package.json')));
    if (!pkg) continue;
    const deps = {
      ...(isRecord(pkg.dependencies) ? pkg.dependencies : {}),
      ...(isRecord(pkg.devDependencies) ? pkg.devDependencies : {}),
    };

    const playwrightConfig = configsOf(root, /^playwright\.config\./)[0];
    if ('@playwright/test' in deps || playwrightConfig) {
      const meta: Record<string, string> = {};
      if (playwrightConfig) {
        const body = testSettings(text(playwrightConfig));
        meta.config = relativeTo(playwrightConfig, root);
        const testDir = stringOption(body, 'testDir');
        meta.testDir = relativeTo(joinRel(dirOf(playwrightConfig), testDir ?? ''), root);
        const testMatch =
          stringOption(body, 'testMatch') ?? stringList(body, 'testMatch')?.join('\n');
        if (testMatch) meta.testMatch = testMatch;
      }
      add('playwright', root, meta);
    }

    const vitestConfig = configsOf(root, /^vitest\.(config|workspace)\./)[0];
    if ('vitest' in deps || vitestConfig) {
      const meta: Record<string, string> = {};
      const config = vitestConfig ?? configsOf(root, /^vite\.config\./)[0];
      if (config) {
        const body = testSettings(text(config));
        const include = stringList(body, 'include');
        const exclude = stringList(body, 'exclude');
        if (vitestConfig || include) meta.config = relativeTo(config, root);
        if (include) meta.include = include.join('\n');
        if (exclude) meta.exclude = exclude.join('\n');
      }
      add('vitest', root, meta);
    }

    const jestConfig = configsOf(root, /^jest\.config\./)[0];
    if ('jest' in deps || jestConfig || isRecord(pkg.jest)) {
      const meta: Record<string, string> = {};
      const testMatch = jestConfig
        ? stringList(testSettings(text(jestConfig)), 'testMatch')
        : undefined;
      if (jestConfig) meta.config = relativeTo(jestConfig, root);
      if (testMatch) meta.testMatch = testMatch.join('\n');
      add('jest', root, meta);
    }

    if ('mocha' in deps || configsOf(root, /^\.mocharc\./).length > 0) add('mocha', root);
  }
}

function detectPython(
  files: readonly string[],
  manifests: string[],
  text: (path: string) => string,
  add: Add,
): void {
  const rootMarkers =
    /^(pyproject\.toml|pytest\.ini|setup\.cfg|tox\.ini|setup\.py|requirements.*\.txt)$/;
  const roots = [
    ...new Set(
      [...manifests, ...files.filter((file) => baseOf(file) === 'setup.py')]
        .filter((path) => rootMarkers.test(baseOf(path)))
        .map(dirOf),
    ),
  ];
  const rootOf = (path: string): string =>
    roots.filter((root) => isWithin(dirOf(path), root)).sort((a, b) => b.length - a.length)[0] ??
    '';

  const pytestRoots = new Set<string>();
  for (const path of manifests) {
    const name = baseOf(path);
    const body = text(path);
    const says =
      name === 'pytest.ini' ||
      name === 'conftest.py' ||
      (name === 'pyproject.toml' &&
        (/^\s*\[tool\.pytest/m.test(body) || /["'\s]pytest\s*([<>=~!\]",'\s]|$)/m.test(body))) ||
      (name === 'setup.cfg' && /^\s*\[tool:pytest\]/m.test(body)) ||
      (name === 'tox.ini' && /^\s*\[pytest\]/m.test(body)) ||
      (/^requirements.*\.txt$/.test(name) && /^\s*pytest\s*([<>=~![;#]|$)/m.test(body));
    if (says) pytestRoots.add(name === 'conftest.py' ? rootOf(path) : dirOf(path));
  }
  for (const root of pytestRoots) add('pytest', root);

  const pythonTests = files.filter((file) =>
    matchesAnyGlob(file, TEST_FRAMEWORKS.pytest.testFiles),
  );
  for (const file of pythonTests) {
    const root = rootOf(file);
    const coveredByPytest = [...pytestRoots].some((pytestRoot) => isWithin(file, pytestRoot));
    if (!coveredByPytest) add('unittest', root);
  }
}

function hasAncestorWith(manifests: string[], root: string, pattern: RegExp): boolean {
  return manifests.some((path) => {
    const dir = dirOf(path);
    return pattern.test(baseOf(path)) && dir !== root && isWithin(root, dir);
  });
}

function parseJson(body: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(body);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `key: 'value'` in a config file, when the value is a plain string literal. */
function stringOption(body: string, key: string): string | undefined {
  return new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`).exec(body)?.[2];
}

/**
 * Every `key: ['a', 'b']` in a config file, folded into one list. A config that splits its suites
 * over `projects: [...]` or `defineWorkspace([...])` gives each of them its own patterns, and the
 * panel wants the union: all of them run together.
 */
function stringList(body: string, key: string): string[] | undefined {
  const values: string[] = [];
  for (const match of body.matchAll(new RegExp(`\\b${key}\\s*:\\s*\\[([^\\]]*)\\]`, 'g'))) {
    for (const entry of match[1].matchAll(/(['"`])([^'"`]*)\1/g)) values.push(entry[2]);
  }
  return values.length > 0 ? [...new Set(values)] : undefined;
}

/**
 * Settings blocks that carry their own `include` and `exclude` about something other than which
 * files hold tests. `coverage` is the one that hurts: it lists source globs, and nearly always
 * excludes the test files themselves, which would leave the project owning nothing at all.
 */
const NON_TEST_BLOCKS = [
  'coverage',
  'optimizeDeps',
  'deps',
  'typecheck',
  'build',
  'server',
  'resolve',
];

/** The config text with those blocks cut out, so only the test selection is left to read. */
function testSettings(body: string): string {
  return NON_TEST_BLOCKS.reduce(dropBlock, body);
}

function dropBlock(body: string, key: string): string {
  const pattern = new RegExp(`\\b${key}\\s*:\\s*\\{`, 'g');
  let kept = '';
  let from = 0;
  for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
    const end = closingBrace(body, match.index + match[0].length - 1);
    if (end < 0) continue;
    kept += body.slice(from, match.index);
    from = end + 1;
    pattern.lastIndex = from;
  }
  return kept + body.slice(from);
}

/**
 * The `}` that closes the `{` at `open`, or -1 when it is never closed. Strings and comments are
 * stepped over, since a glob like `'**\/*.{ts,tsx}'` has braces of its own.
 */
function closingBrace(body: string, open: number): number {
  let depth = 0;
  for (let i = open; i < body.length; i += 1) {
    const char = body[i];
    if (char === "'" || char === '"' || char === '`') {
      i = endOfString(body, i);
      continue;
    }
    if (char === '/' && (body[i + 1] === '/' || body[i + 1] === '*')) {
      i = endOfComment(body, i);
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}' && (depth -= 1) === 0) return i;
  }
  return -1;
}

function endOfString(body: string, start: number): number {
  const quote = body[start];
  for (let i = start + 1; i < body.length; i += 1) {
    if (body[i] === '\\') i += 1;
    else if (body[i] === quote) return i;
  }
  return body.length;
}

function endOfComment(body: string, start: number): number {
  if (body[start + 1] === '/') {
    const end = body.indexOf('\n', start);
    return end < 0 ? body.length : end;
  }
  const end = body.indexOf('*/', start + 2);
  return end < 0 ? body.length : end + 1;
}
