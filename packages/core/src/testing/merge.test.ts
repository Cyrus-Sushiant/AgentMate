import { describe, expect, it } from 'vitest';
import { buildTestTree } from './discover/index.js';
import {
  aggregateStatuses,
  attachResults,
  countResults,
  resolveResults,
  resolveTarget,
} from './merge.js';
import type { ParsedTestResult, TestNode, TestProject, TestResult } from './types.js';

const vitest: TestProject = {
  id: 'vitest:web',
  framework: 'vitest',
  root: 'web',
  label: 'Vitest · web',
};
const go: TestProject = {
  id: 'go:',
  framework: 'go',
  root: '',
  label: 'Go',
  meta: { module: 'example.com/fx' },
};
const dotnet: TestProject = { id: 'dotnet:t', framework: 'dotnet', root: 't', label: '.NET · t' };
const rspec: TestProject = { id: 'rspec:', framework: 'rspec', root: '', label: 'RSpec' };

const [webTree, goTree, dotnetTree, rspecTree] = buildTestTree([vitest, go, dotnet, rspec], {
  'web/src/math.test.ts': [
    "describe('math', () => {",
    "  it('adds', () => {});",
    "  describe('nested', () => {",
    "    it('fails', () => {});",
    '  });',
    '});',
    "it('top', () => {});",
  ].join('\n'),
  'web/src/other.test.ts': "it('adds', () => {});\n",
  'calc/calc_test.go':
    'package calc\n\nfunc TestAdd(t *testing.T) {}\nfunc TestSub(t *testing.T) {}\n',
  'calc/more_test.go': 'package calc\n\nfunc TestMore(t *testing.T) {}\n',
  'api/api_test.go': 'package api\n\nfunc TestGet(t *testing.T) {}\n',
  't/MathTests.cs': [
    'namespace Fx.Tests;',
    'public class MathTests',
    '{',
    '    [Fact]',
    '    public void Adds() { }',
    '    [Theory]',
    '    public void Small(int n) { }',
    '}',
  ].join('\n'),
  'spec/user_spec.rb': "describe User do\n  it 'works' do\n  end\n  it 'works' do\n  end\nend\n",
});

const ids = (results: TestResult[]) => results.map((result) => `${result.status} ${result.id}`);

describe('resolveTarget', () => {
  it('runs everything when nothing is picked', () => {
    const target = resolveTarget(webTree, { testProjectId: vitest.id });
    expect(target.all).toBe(true);
    expect(target.expanded.map((ref) => ref.path.join(' > '))).toEqual([
      'math > adds',
      'math > nested > fails',
      'top',
      'adds',
    ]);
  });

  it('expands a picked suite into its tests and fills in lines and selectors', () => {
    const target = resolveTarget(webTree, {
      testProjectId: vitest.id,
      tests: [{ file: 'web/src/math.test.ts', path: ['math', 'nested'] }],
    });
    expect(target).toEqual({
      all: false,
      files: [],
      tests: [{ file: 'web/src/math.test.ts', path: ['math', 'nested', 'fails'], line: 4 }],
      expanded: [{ file: 'web/src/math.test.ts', path: ['math', 'nested', 'fails'], line: 4 }],
    });
    const goTarget = resolveTarget(goTree, {
      testProjectId: go.id,
      tests: [{ file: 'calc/calc_test.go', path: ['TestSub'] }],
    });
    expect(goTarget.tests).toEqual([
      { file: 'calc/calc_test.go', path: ['TestSub'], line: 4, selector: 'TestSub' },
    ]);
  });

  it('keeps whole files and lists their tests for runners that select by name', () => {
    const target = resolveTarget(webTree, {
      testProjectId: vitest.id,
      files: ['web/src/other.test.ts'],
    });
    expect(target.files).toEqual(['web/src/other.test.ts']);
    expect(target.tests).toEqual([]);
    expect(target.expanded).toEqual([{ file: 'web/src/other.test.ts', path: ['adds'], line: 1 }]);
  });

  it('passes through a test the tree does not know, like a parameter variant', () => {
    const ref = { file: 't/MathTests.cs', path: ['MathTests', 'Small', '(n: 5)'] };
    expect(resolveTarget(dotnetTree, { testProjectId: dotnet.id, tests: [ref] }).tests).toEqual([
      ref,
    ]);
  });
});

describe('resolveResults', () => {
  const resolve = (
    tree: TestNode,
    project: TestProject,
    parsed: ParsedTestResult[],
    folder = 'C:\\work\\app',
  ) => resolveResults(tree, project, parsed, folder);

  it('matches by absolute file and path', () => {
    const results = resolve(webTree, vitest, [
      {
        file: 'C:/work/app/web/src/math.test.ts',
        path: ['math', 'nested', 'fails'],
        status: 'failed',
        message: 'boom',
      },
      {
        file: 'c:\\WORK\\app\\web\\src\\other.test.ts',
        path: ['adds'],
        status: 'passed',
        durationMs: 3,
      },
    ]);
    expect(results).toEqual([
      {
        id: 'vitest:web::web/src/math.test.ts::math > nested > fails',
        testProjectId: 'vitest:web',
        file: 'web/src/math.test.ts',
        path: ['math', 'nested', 'fails'],
        line: 4,
        status: 'failed',
        message: 'boom',
      },
      {
        id: 'vitest:web::web/src/other.test.ts::adds',
        testProjectId: 'vitest:web',
        file: 'web/src/other.test.ts',
        path: ['adds'],
        line: 1,
        status: 'passed',
        durationMs: 3,
      },
    ]);
  });

  it('matches a file relative to the project root and a joined full name', () => {
    const results = resolve(webTree, vitest, [
      {
        file: 'src/math.test.ts',
        path: ['fails'],
        fullName: 'math nested fails',
        status: 'passed',
      },
    ]);
    expect(ids(results)).toEqual([
      'passed vitest:web::web/src/math.test.ts::math > nested > fails',
    ]);
  });

  it('finds Go tests by package folder, and nests subtests under their parent', () => {
    const results = resolve(goTree, go, [
      { dir: 'calc', path: ['TestMore'], selector: 'TestMore', status: 'passed' },
      { dir: 'calc', path: ['TestSub', 'zero'], selector: 'TestSub/zero', status: 'failed' },
      { dir: 'api', path: ['TestGet'], selector: 'TestGet', status: 'skipped' },
    ]);
    expect(ids(results)).toEqual([
      'passed go:::calc/more_test.go::TestMore',
      'failed go:::calc/calc_test.go::TestSub > zero',
      'skipped go:::api/api_test.go::TestGet',
    ]);
    expect(results[1]).toMatchObject({ file: 'calc/calc_test.go', path: ['TestSub', 'zero'] });
  });

  it('marks every file in a package that failed to build', () => {
    const results = resolve(goTree, go, [
      { dir: 'calc', path: [], status: 'failed', message: 'undefined: x' },
    ]);
    expect(ids(results)).toEqual([
      'failed go:::calc/calc_test.go',
      'failed go:::calc/more_test.go',
    ]);
    expect(results[0]).toMatchObject({ path: [], message: 'undefined: x' });
  });

  it('matches .NET results by fully qualified name and theory variants by their method', () => {
    const results = resolve(dotnetTree, dotnet, [
      { path: ['MathTests', 'Adds'], selector: 'Fx.Tests.MathTests.Adds', status: 'passed' },
      { path: ['MathTests', 'Small', '(n: 5)'], status: 'failed' },
    ]);
    expect(ids(results)).toEqual([
      'passed dotnet:t::t/MathTests.cs::MathTests > Adds',
      'failed dotnet:t::t/MathTests.cs::MathTests > Small > (n: 5)',
    ]);
  });

  it('uses the line to tell apart RSpec examples with the same description', () => {
    const results = resolve(
      rspecTree,
      rspec,
      [
        {
          file: './spec/user_spec.rb',
          line: 4,
          path: ['works'],
          fullName: 'User works',
          status: 'failed',
        },
      ],
      '/w',
    );
    expect(results).toMatchObject([
      { id: 'rspec:::spec/user_spec.rb::User > works', line: 4, status: 'failed' },
    ]);
  });

  it('keeps a result it cannot place under its reported file, or the project', () => {
    const results = resolve(webTree, vitest, [
      { file: 'C:/work/app/web/src/new.test.ts', path: ['fresh'], status: 'passed' },
      { path: ['nowhere'], status: 'failed' },
    ]);
    expect(results).toEqual([
      {
        id: 'vitest:web::web/src/new.test.ts::fresh',
        testProjectId: 'vitest:web',
        file: 'web/src/new.test.ts',
        path: ['fresh'],
        status: 'passed',
      },
      {
        id: 'vitest:web::::nowhere',
        testProjectId: 'vitest:web',
        path: ['nowhere'],
        status: 'failed',
      },
    ]);
  });
});

describe('attachResults', () => {
  it('adds nodes for results the tree did not have, without touching the original', () => {
    const results = resolveResults(
      goTree,
      go,
      [
        { dir: 'calc', path: ['TestSub', 'zero'], status: 'passed' },
        { file: 'calc/extra_test.go', path: ['TestExtra'], status: 'failed' },
        { path: ['Orphan'], status: 'failed' },
      ],
      '/w',
    );
    const [tree] = attachResults([goTree], results);
    const outline = (node: TestNode, indent = ''): string[] => [
      `${indent}${node.kind} ${node.name}`,
      ...node.children.flatMap((child) => outline(child, `${indent}  `)),
    ];
    expect(outline(tree)).toEqual([
      'project Go',
      '  file api/api_test.go',
      '    test TestGet',
      '  file calc/calc_test.go',
      '    test TestAdd',
      '    test TestSub',
      '      test zero',
      '  file calc/more_test.go',
      '    test TestMore',
      '  file calc/extra_test.go',
      '    test TestExtra',
      '  file Other results',
      '    test Orphan',
    ]);
    expect(goTree.children[1].children[1].children).toEqual([]);
  });
});

describe('aggregateStatuses and countResults', () => {
  it('rolls child results up to suites, files and projects', () => {
    const results = resolveResults(
      webTree,
      vitest,
      [
        { file: 'src/math.test.ts', path: ['math', 'adds'], status: 'passed' },
        { file: 'src/math.test.ts', path: ['math', 'nested', 'fails'], status: 'failed' },
        { file: 'src/math.test.ts', path: ['top'], status: 'skipped' },
        { file: 'src/other.test.ts', path: ['adds'], status: 'passed' },
      ],
      '/w',
    );
    const statuses = aggregateStatuses([webTree], results);
    expect(statuses.get('vitest:web::web/src/math.test.ts::math')).toBe('failed');
    expect(statuses.get('vitest:web::web/src/math.test.ts')).toBe('failed');
    expect(statuses.get('vitest:web::web/src/other.test.ts')).toBe('passed');
    expect(statuses.get('vitest:web')).toBe('failed');
    expect(countResults(results)).toEqual({ passed: 2, failed: 1, skipped: 1, running: 0 });
  });

  it('shows running above passed and keeps a file level failure', () => {
    const results: TestResult[] = [
      {
        id: 'vitest:web::web/src/other.test.ts::adds',
        testProjectId: vitest.id,
        path: ['adds'],
        status: 'running',
      },
      {
        id: 'vitest:web::web/src/math.test.ts',
        testProjectId: vitest.id,
        path: [],
        status: 'failed',
        message: 'x',
      },
    ];
    const statuses = aggregateStatuses([webTree], results);
    expect(statuses.get('vitest:web::web/src/other.test.ts')).toBe('running');
    expect(statuses.get('vitest:web::web/src/math.test.ts')).toBe('failed');
    expect(statuses.get('vitest:web')).toBe('running');
    expect(statuses.get('vitest:web::web/src/math.test.ts::math')).toBeUndefined();
  });
});
