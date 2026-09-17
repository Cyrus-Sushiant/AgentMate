import { compact } from './adapters/shared.js';
import type { ResolvedTarget } from './adapters/types.js';
import { testNodeId } from './discover/index.js';
import { dirOf, joinRel, workspaceRelative } from './paths.js';
import type {
  ParsedTestResult,
  TestNode,
  TestProject,
  TestRef,
  TestResult,
  TestStatus,
  TestTarget,
} from './types.js';

/**
 * Glue between what was discovered by reading files and what a runner reported: turning a picked
 * node into something a runner can select, and matching each reported result back to its node.
 */

function walk(node: TestNode, visit: (node: TestNode) => void): void {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

function testsUnder(node: TestNode): TestNode[] {
  const out: TestNode[] = [];
  walk(node, (entry) => {
    if (entry.kind === 'test') out.push(entry);
  });
  return out;
}

function refOf(node: TestNode): TestRef {
  return compact({
    file: node.file ?? '',
    path: node.path,
    line: node.line,
    selector: node.selector,
  });
}

const refKey = (ref: TestRef): string => `${ref.file}\n${ref.path.join('\n')}`;

function uniqueRefs(refs: TestRef[]): TestRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = refKey(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveTarget(projectNode: TestNode, target: TestTarget): ResolvedTarget {
  const files = target.files ?? [];
  const picked = target.tests ?? [];
  if (files.length === 0 && picked.length === 0) {
    return { all: true, files: [], tests: [], expanded: testsUnder(projectNode).map(refOf) };
  }

  const byKey = new Map<string, TestNode>();
  walk(projectNode, (node) => {
    if (node.file !== undefined) byKey.set(refKey({ file: node.file, path: node.path }), node);
  });

  const tests: TestRef[] = [];
  for (const ref of picked) {
    const node = byKey.get(refKey(ref));
    if (!node) tests.push(ref);
    else if (node.kind === 'test') tests.push(refOf(node));
    else tests.push(...testsUnder(node).map(refOf));
  }

  const inFiles = files.flatMap((file) => {
    const node = byKey.get(refKey({ file, path: [] }));
    return node ? testsUnder(node).map(refOf) : [];
  });

  return {
    all: false,
    files,
    tests: uniqueRefs(tests),
    expanded: uniqueRefs([...inFiles, ...tests]),
  };
}

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((segment, index) => segment === b[index]);

const endsWith = (long: readonly string[], short: readonly string[]): boolean =>
  short.length > 0 &&
  long.length >= short.length &&
  short.every((segment, index) => long[long.length - short.length + index] === segment);

/** Tests and suites that could be the result's node, before any name matching. */
function findNode(
  candidates: TestNode[],
  parsed: ParsedTestResult,
  file: string | null,
): TestNode | undefined {
  const inScope = candidates.filter((node) => node.kind === 'test' || node.kind === 'suite');
  const tests = inScope.filter((node) => node.kind === 'test');
  if (parsed.selector) {
    const bySelector = inScope.find((node) => node.selector === parsed.selector);
    if (bySelector) return bySelector;
  }
  if (parsed.line && file) {
    const byLine = tests.find((node) => node.file === file && node.line === parsed.line);
    if (
      byLine &&
      (samePath(byLine.path, parsed.path) || byLine.name === parsed.path[parsed.path.length - 1])
    ) {
      return byLine;
    }
  }
  const exact = inScope.find((node) => samePath(node.path, parsed.path));
  if (exact) return exact;
  if (parsed.fullName) {
    const byName = inScope.find((node) => node.path.join(' ') === parsed.fullName);
    if (byName) return byName;
  }
  const suffix = inScope.filter(
    (node) =>
      endsWith(node.path, parsed.path) ||
      (node.path.length >= 2 && endsWith(parsed.path, node.path)),
  );
  return suffix.length === 1 ? suffix[0] : undefined;
}

export function resolveResults(
  projectNode: TestNode,
  project: TestProject,
  parsed: readonly ParsedTestResult[],
  folderPath: string,
): TestResult[] {
  const fileNodes = projectNode.children.filter((node) => node.kind === 'file');
  const out: TestResult[] = [];

  for (const result of parsed) {
    const file = result.file ? workspaceRelative(result.file, folderPath, project.root) : null;
    let scope: TestNode[];
    if (file) scope = fileNodes.filter((node) => node.file === file);
    else if (result.dir !== undefined) {
      const dir = joinRel(project.root, result.dir);
      scope = fileNodes.filter((node) => dirOf(node.file ?? '') === dir);
    } else scope = fileNodes;

    const base = {
      testProjectId: project.id,
      status: result.status,
      durationMs: result.durationMs,
      message: result.message,
      stack: result.stack,
    };

    if (result.path.length === 0) {
      const targets = file
        ? [{ id: testNodeId(project.id, file, []), file }]
        : scope.map((node) => ({ id: node.id, file: node.file ?? '' }));
      for (const entry of targets)
        out.push(compact({ ...base, id: entry.id, file: entry.file, path: [] }));
      continue;
    }

    const candidates = scope.flatMap((node) => {
      const all: TestNode[] = [];
      walk(node, (entry) => all.push(entry));
      return all;
    });
    const node = findNode(candidates, result, file);
    if (node) {
      out.push(
        compact({
          ...base,
          id: node.id,
          file: node.file,
          path: node.path,
          line: result.line ?? node.line,
        }),
      );
      continue;
    }

    // A parameter variant or subtest of a known test hangs under it.
    const parent =
      result.path.length > 1
        ? findNode(
            candidates,
            {
              ...result,
              path: result.path.slice(0, -1),
              selector: undefined,
              fullName: undefined,
              line: undefined,
            },
            file,
          )
        : undefined;
    if (parent) {
      const path = [...parent.path, result.path[result.path.length - 1]];
      out.push(
        compact({
          ...base,
          id: testNodeId(project.id, parent.file ?? '', path),
          file: parent.file,
          path,
          line: result.line,
        }),
      );
      continue;
    }

    out.push(
      compact({
        ...base,
        id: testNodeId(project.id, file ?? '', result.path),
        file: file ?? undefined,
        path: result.path,
        line: result.line,
      }),
    );
  }
  return out;
}

function cloneNode(node: TestNode): TestNode {
  return { ...node, path: [...node.path], children: node.children.map(cloneNode) };
}

/** The tree with nodes added for results discovery did not know about. The input is not changed. */
export function attachResults(
  tree: readonly TestNode[],
  results: readonly TestResult[],
): TestNode[] {
  const copy = tree.map(cloneNode);
  const known = new Set<string>();
  for (const project of copy) walk(project, (node) => known.add(node.id));

  for (const result of results) {
    if (known.has(result.id)) continue;
    const project = copy.find((node) => node.id === result.testProjectId);
    if (!project) continue;
    const fileKey = result.file ?? '';
    const fileId = testNodeId(project.id, fileKey, []);
    let fileNode = project.children.find((node) => node.id === fileId);
    if (!fileNode) {
      const sibling = project.children.find(
        (node) => node.kind === 'file' && node.file && node.file.endsWith(node.name),
      );
      const prefix = sibling?.file
        ? sibling.file.slice(0, sibling.file.length - sibling.name.length)
        : '';
      fileNode = {
        id: fileId,
        kind: 'file',
        name: fileKey
          ? prefix && fileKey.startsWith(prefix)
            ? fileKey.slice(prefix.length)
            : fileKey
          : 'Other results',
        testProjectId: project.id,
        ...(result.file ? { file: result.file } : {}),
        path: [],
        children: [],
      };
      project.children.push(fileNode);
      known.add(fileId);
    }
    let parent = fileNode;
    result.path.forEach((segment, index) => {
      const path = result.path.slice(0, index + 1);
      const id = testNodeId(project.id, fileKey, path);
      let node = parent.children.find((entry) => entry.id === id);
      if (!node) {
        node = {
          id,
          kind: index === result.path.length - 1 ? 'test' : 'suite',
          name: segment,
          testProjectId: project.id,
          ...(result.file ? { file: result.file } : {}),
          ...(index === result.path.length - 1 && result.line ? { line: result.line } : {}),
          path,
          children: [],
        };
        parent.children.push(node);
        known.add(id);
      }
      parent = node;
    });
  }
  return copy;
}

const PRECEDENCE: TestStatus[] = ['running', 'queued', 'failed', 'passed', 'skipped'];

function combine(statuses: (TestStatus | undefined)[]): TestStatus | undefined {
  return PRECEDENCE.find((status) => statuses.includes(status));
}

/** A status for every node that has one of its own or below it. */
export function aggregateStatuses(
  tree: readonly TestNode[],
  results: readonly TestResult[],
): Map<string, TestStatus> {
  const own = new Map(results.map((result) => [result.id, result.status]));
  const out = new Map<string, TestStatus>();
  const visit = (node: TestNode): TestStatus | undefined => {
    const status = combine([own.get(node.id), ...node.children.map(visit)]);
    if (status) out.set(node.id, status);
    return status;
  };
  for (const project of tree) visit(project);
  return out;
}

export function countResults(results: readonly TestResult[]): {
  passed: number;
  failed: number;
  skipped: number;
  running: number;
} {
  const counts = { passed: 0, failed: 0, skipped: 0, running: 0 };
  for (const result of results) {
    if (result.path.length === 0) continue;
    if (result.status === 'queued' || result.status === 'running') counts.running += 1;
    else counts[result.status] += 1;
  }
  return counts;
}
