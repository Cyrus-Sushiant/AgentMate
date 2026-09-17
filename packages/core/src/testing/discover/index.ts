import { IGNORED_TEST_DIRS, TEST_FRAMEWORKS } from '../frameworks.js';
import { matchesAnyGlob } from '../glob.js';
import { isWithin, joinRel, relativeTo } from '../paths.js';
import type { DiscoveredTest, TestNode, TestProject } from '../types.js';
import { discoverDartTests, discoverJsTests } from './js.js';
import {
  discoverCsharpTests,
  discoverGoTests,
  discoverJvmTests,
  discoverPhpTests,
  discoverPythonTests,
  discoverRubyTests,
  discoverRustTests,
} from './languages.js';

export { discoverDartTests, discoverJsTests } from './js.js';
export * from './languages.js';

const IGNORED = new Set(IGNORED_TEST_DIRS);

/**
 * Decides which files each test project owns. A file goes to the deepest project of its language
 * whose patterns match it, so a monorepo package keeps its own tests and a nested Go module is not
 * counted twice. Projects that own nothing are left out.
 */
export function testFilesFor(
  projects: readonly TestProject[],
  files: readonly string[],
): Record<string, string[]> {
  const owned: Record<string, string[]> = {};
  for (const file of files) {
    const byLanguage = new Map<string, TestProject[]>();
    for (const project of projects) {
      if (!isWithin(file, project.root) || !ownsFile(project, relativeTo(file, project.root)))
        continue;
      const language = TEST_FRAMEWORKS[project.framework].language;
      byLanguage.set(language, [...(byLanguage.get(language) ?? []), project]);
    }
    for (const candidates of byLanguage.values()) {
      const deepest = Math.max(...candidates.map((project) => project.root.length));
      const atRoot = candidates.filter((project) => project.root.length === deepest);
      const winner = pickAtSameRoot(atRoot);
      owned[winner.id] = [...(owned[winner.id] ?? []), file];
    }
  }
  return owned;
}

function pickAtSameRoot(projects: TestProject[]): TestProject {
  if (projects.length === 1) return projects[0];
  const playwright = projects.find((project) => project.framework === 'playwright');
  // Playwright claims its own folder. When it is rooted at the package with no pattern of its own,
  // its defaults overlap the unit runner's, and unit tests are far more common, so they win.
  if (playwright && (playwright.meta?.testDir || playwright.meta?.testMatch)) return playwright;
  return projects.find((project) => project.framework !== 'playwright') ?? projects[0];
}

function ownsFile(project: TestProject, rel: string): boolean {
  const segments = rel.split('/');
  if (segments.slice(0, -1).some((segment) => IGNORED.has(segment))) return false;
  const info = TEST_FRAMEWORKS[project.framework];
  if (info.ignore && segments.slice(0, -1).some((segment) => info.ignore?.includes(segment))) {
    return false;
  }
  const lines = (value?: string): string[] | undefined =>
    value
      ?.split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

  switch (project.framework) {
    case 'vitest': {
      const include = lines(project.meta?.include) ?? info.testFiles;
      const exclude = lines(project.meta?.exclude) ?? [];
      return matchesAnyGlob(rel, include) && !matchesAnyGlob(rel, exclude);
    }
    case 'jest':
      return matchesAnyGlob(rel, lines(project.meta?.testMatch) ?? info.testFiles);
    case 'playwright': {
      const testDir = project.meta?.testDir ?? '';
      if (!isWithin(rel, testDir)) return false;
      return matchesAnyGlob(
        relativeTo(rel, testDir),
        lines(project.meta?.testMatch) ?? info.testFiles,
      );
    }
    default:
      return matchesAnyGlob(rel, info.testFiles);
  }
}

export function discoverInFile(
  project: TestProject,
  file: string,
  source: string,
): DiscoveredTest[] {
  const rel = relativeTo(file, project.root);
  switch (TEST_FRAMEWORKS[project.framework].language) {
    case 'js':
      return discoverJsTests(source);
    case 'dart':
      return discoverDartTests(source);
    case 'python':
      return discoverPythonTests(source).map((test) => ({
        ...test,
        selector:
          project.framework === 'unittest'
            ? [rel.replace(/\.py$/, '').replace(/\//g, '.'), ...test.path].join('.')
            : [rel, ...test.path].join('::'),
      }));
    case 'go':
      return discoverGoTests(source).map((test) => ({ ...test, selector: test.path.join('/') }));
    case 'rust':
      return discoverRustTests(source, rel);
    case 'csharp':
      return discoverCsharpTests(source);
    case 'php':
      return discoverPhpTests(source);
    case 'ruby':
      return discoverRubyTests(source);
    case 'jvm':
      return discoverJvmTests(source);
  }
}

export function testNodeId(testProjectId: string, file: string, path: readonly string[]): string {
  return path.length === 0
    ? `${testProjectId}::${file}`
    : `${testProjectId}::${file}::${path.join(' > ')}`;
}

/** Builds the panel's tree from the text of every candidate test file. */
export function buildTestTree(
  projects: readonly TestProject[],
  contents: Readonly<Record<string, string>>,
): TestNode[] {
  const owned = testFilesFor(projects, Object.keys(contents));
  return projects.map((project) => {
    const projectNode: TestNode = {
      id: project.id,
      kind: 'project',
      name: project.label,
      testProjectId: project.id,
      path: [],
      children: [],
    };
    for (const file of [...(owned[project.id] ?? [])].sort()) {
      const found = discoverInFile(project, file, contents[file] ?? '');
      if (!found.some((entry) => entry.kind === 'test')) continue;
      projectNode.children.push(buildFileNode(project, file, found));
    }
    return projectNode;
  });
}

function buildFileNode(project: TestProject, file: string, found: DiscoveredTest[]): TestNode {
  const fileNode: TestNode = {
    id: testNodeId(project.id, file, []),
    kind: 'file',
    name: relativeTo(file, project.root) || joinRel(file),
    testProjectId: project.id,
    file,
    path: [],
    children: [],
  };
  const byPath = new Map<string, TestNode>([['', fileNode]]);
  const ensure = (path: string[], kind: 'suite' | 'test', entry?: DiscoveredTest): TestNode => {
    const key = path.join('\u0000');
    const existing = byPath.get(key);
    if (existing) return existing;
    const parent = ensure(path.slice(0, -1), 'suite');
    const node: TestNode = {
      id: testNodeId(project.id, file, path),
      kind,
      name: path[path.length - 1],
      testProjectId: project.id,
      file,
      path,
      children: [],
      ...(entry ? { line: entry.line } : {}),
      ...(entry?.selector ? { selector: entry.selector } : {}),
    };
    parent.children.push(node);
    byPath.set(key, node);
    return node;
  };
  for (const entry of found) ensure(entry.path, entry.kind, entry);
  return fileNode;
}
