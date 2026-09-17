import { describe, expect, it } from 'vitest';
import type { TestNode, TestProject } from '../types.js';
import { buildTestTree, testFilesFor } from './index.js';

const project = (
  framework: TestProject['framework'],
  root: string,
  meta?: Record<string, string>,
): TestProject => ({
  id: `${framework}:${root}`,
  framework,
  root,
  label: framework,
  ...(meta ? { meta } : {}),
});

function outline(nodes: TestNode[], indent = ''): string[] {
  return nodes.flatMap((node) => [
    `${indent}${node.kind} ${node.name}${node.line ? `:${node.line}` : ''}`,
    ...outline(node.children, `${indent}  `),
  ]);
}

describe('testFilesFor', () => {
  it('gives each file to the deepest matching project of its language', () => {
    const files = [
      'src/a.test.ts',
      'packages/core/src/b.test.ts',
      'packages/core/node_modules/dep/c.test.ts',
      'packages/core/dist/d.test.js',
      'packages/core/src/plain.ts',
      'svc/calc_test.go',
      'svc/nested/go.mod',
      'svc/nested/x_test.go',
    ];
    const result = testFilesFor(
      [
        project('vitest', ''),
        project('vitest', 'packages/core'),
        project('go', 'svc'),
        project('go', 'svc/nested'),
      ],
      files,
    );
    expect(result).toEqual({
      'vitest:': ['src/a.test.ts'],
      'vitest:packages/core': ['packages/core/src/b.test.ts'],
      'go:svc': ['svc/calc_test.go'],
      'go:svc/nested': ['svc/nested/x_test.go'],
    });
  });

  it('splits Vitest and Playwright files in the same package by the Playwright config', () => {
    const files = [
      'apps/desktop/src/main/ipc/settings.test.ts',
      'apps/desktop/src/renderer/Panel.test.tsx',
      'apps/desktop/e2e/launchFlags.e2e.ts',
      'apps/desktop/e2e/app.ts',
    ];
    const result = testFilesFor(
      [
        project('playwright', 'apps/desktop', { testDir: 'e2e', testMatch: '**/*.e2e.ts' }),
        project('vitest', 'apps/desktop', { include: 'src/**/*.test.ts\nsrc/**/*.test.tsx' }),
      ],
      files,
    );
    expect(result).toEqual({
      'playwright:apps/desktop': ['apps/desktop/e2e/launchFlags.e2e.ts'],
      'vitest:apps/desktop': [
        'apps/desktop/src/main/ipc/settings.test.ts',
        'apps/desktop/src/renderer/Panel.test.tsx',
      ],
    });
  });

  it('leaves Playwright spec files out of Vitest when both use default patterns', () => {
    const result = testFilesFor(
      [project('playwright', '', { testDir: 'tests/e2e' }), project('vitest', '')],
      ['tests/e2e/login.spec.ts', 'src/util.test.ts'],
    );
    expect(result).toEqual({
      'playwright:': ['tests/e2e/login.spec.ts'],
      'vitest:': ['src/util.test.ts'],
    });
  });

  it('picks candidate files for the other ecosystems', () => {
    const result = testFilesFor(
      [
        project('pytest', ''),
        project('dotnet', 'tests/App.Tests'),
        project('cargo', 'crates/p'),
        project('flutter', 'mobile'),
        project('rspec', 'api'),
        project('phpunit', 'web'),
        project('gradle', 'jvm'),
      ],
      [
        'tests/test_models.py',
        'app/models.py',
        'tests/App.Tests/CartTests.cs',
        'tests/App.Tests/obj/Debug/Generated.cs',
        'crates/p/src/lib.rs',
        'crates/p/tests/api.rs',
        'crates/p/benches/b.rs',
        'mobile/test/widget_test.dart',
        'mobile/lib/main.dart',
        'api/spec/models/user_spec.rb',
        'web/tests/Unit/UserTest.php',
        'jvm/app/src/test/java/com/acme/CartTest.java',
        'jvm/app/src/main/java/com/acme/Cart.java',
      ],
    );
    expect(result).toEqual({
      'pytest:': ['tests/test_models.py'],
      'dotnet:tests/App.Tests': ['tests/App.Tests/CartTests.cs'],
      'cargo:crates/p': ['crates/p/src/lib.rs', 'crates/p/tests/api.rs'],
      'flutter:mobile': ['mobile/test/widget_test.dart'],
      'rspec:api': ['api/spec/models/user_spec.rb'],
      'phpunit:web': ['web/tests/Unit/UserTest.php'],
      'gradle:jvm': ['jvm/app/src/test/java/com/acme/CartTest.java'],
    });
  });
});

describe('buildTestTree', () => {
  it('builds project, file, suite and test nodes and drops files without tests', () => {
    const projects = [project('vitest', 'pkg'), project('pytest', 'py')];
    const tree = buildTestTree(projects, {
      'pkg/src/math.test.ts': [
        "describe('math', () => {",
        "  it('adds', () => {});",
        '});',
        "it('loose', () => {});",
      ].join('\n'),
      'pkg/src/empty.test.ts': 'export {};',
      'py/tests/test_user.py': 'class TestUser:\n    def test_name(self):\n        pass\n',
    });
    expect(outline(tree)).toEqual([
      'project vitest',
      '  file src/math.test.ts',
      '    suite math:1',
      '      test adds:2',
      '    test loose:4',
      'project pytest',
      '  file tests/test_user.py',
      '    suite TestUser:1',
      '      test test_name:2',
    ]);
    const adds = tree[0].children[0].children[0].children[0];
    expect(adds).toMatchObject({
      id: 'vitest:pkg::pkg/src/math.test.ts::math > adds',
      kind: 'test',
      file: 'pkg/src/math.test.ts',
      path: ['math', 'adds'],
      testProjectId: 'vitest:pkg',
    });
    expect(tree[1].children[0].children[0].children[0].selector).toBe(
      'tests/test_user.py::TestUser::test_name',
    );
  });

  it('gives unittest and Go tests their selectors', () => {
    const tree = buildTestTree([project('unittest', ''), project('go', 'svc')], {
      'pkg/tests/test_api.py':
        'class ApiTest(unittest.TestCase):\n    def test_get(self):\n        pass\n',
      'svc/calc/calc_test.go': 'package calc\n\nfunc TestAdd(t *testing.T) {}\n',
    });
    const leaf = (node: TestNode): TestNode =>
      node.children.length > 0 ? leaf(node.children[0]) : node;
    expect(leaf(tree[0]).selector).toBe('pkg.tests.test_api.ApiTest.test_get');
    expect(leaf(tree[1]).selector).toBe('TestAdd');
  });

  it('keeps a project with no tests so the panel can say so', () => {
    expect(outline(buildTestTree([project('go', '')], {}))).toEqual(['project go']);
  });

  it('adds duplicate names only once', () => {
    const tree = buildTestTree([project('jest', '')], {
      'a.test.js': "it('same', () => {});\nit('same', () => {});\n",
    });
    expect(outline(tree)).toEqual(['project jest', '  file a.test.js', '    test same:1']);
  });
});
