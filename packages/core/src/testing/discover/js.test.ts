import { describe, expect, it } from 'vitest';
import { discoverDartTests, discoverJsTests } from './js.js';

const tests = (source: string) =>
  discoverJsTests(source).map((test) => `${test.kind} ${test.line} ${test.path.join(' > ')}`);

describe('discoverJsTests', () => {
  it('nests tests under their describe blocks with line numbers', () => {
    const source = [
      "import { describe, expect, it } from 'vitest';",
      '',
      "describe('math', () => {",
      "  it('adds', () => {",
      '    expect(1 + 1).toBe(2);',
      '  });',
      '',
      '  describe("nested", function () {',
      '    test(`multiplies`, async () => {});',
      '  });',
      '',
      "  it('subtracts', () => {});",
      '});',
      '',
      "test('top level', () => {});",
    ].join('\n');
    expect(tests(source)).toEqual([
      'suite 3 math',
      'test 4 math > adds',
      'suite 8 math > nested',
      'test 9 math > nested > multiplies',
      'test 12 math > subtracts',
      'test 15 top level',
    ]);
  });

  it('understands modifiers, each tables and Playwright chains', () => {
    const source = [
      "describe.skip('skipped suite', () => {",
      "  it.only('focused', () => {});",
      "  it.each([[1], [2]])('case %i', (n) => {});",
      '  test.each`',
      '    a    | b',
      '    ${1} | ${2}',
      "  `('table $a', () => {});",
      "  it.todo('later');",
      '});',
      "test.describe.serial('flow', () => {",
      "  test('logs in', async ({ page }) => {});",
      '});',
      "it.concurrent.skip('chained modifiers', () => {});",
    ].join('\n');
    expect(tests(source)).toEqual([
      'suite 1 skipped suite',
      'test 2 skipped suite > focused',
      'test 3 skipped suite > case %i',
      'test 4 skipped suite > table $a',
      'test 8 skipped suite > later',
      'suite 10 flow',
      'test 11 flow > logs in',
      'test 13 chained modifiers',
    ]);
  });

  it('ignores lookalikes in comments, strings and other calls', () => {
    const source = [
      "// it('commented out', () => {})",
      "/* describe('block comment', () => {}) */",
      'const text = "test(\'inside a string\')";',
      "if (/abc/.test('abc')) {}",
      "helper.it('not a test');",
      'describe(SomeComponent, () => {});',
      "const template = `it('in a template')`;",
      "it('real one', () => {});",
    ].join('\n');
    expect(tests(source)).toEqual(['test 8 real one']);
  });

  it('keeps braces inside strings and templates from breaking nesting', () => {
    const source = [
      "describe('outer', () => {",
      "  it('has a brace in a string', () => { const s = '}'; });",
      '  it(\'has a template\', () => { const t = `${"}"} }`; });',
      "  it('still inside', () => {});",
      '});',
      "it('outside', () => {});",
    ].join('\n');
    expect(tests(source)).toEqual([
      'suite 1 outer',
      'test 2 outer > has a brace in a string',
      'test 3 outer > has a template',
      'test 4 outer > still inside',
      'test 6 outside',
    ]);
  });

  it('decodes escaped quotes in names', () => {
    expect(tests("it('doesn\\'t crash', () => {});")).toEqual(["test 1 doesn't crash"]);
  });
});

describe('discoverDartTests', () => {
  it('reads group, test and testWidgets calls', () => {
    const source = [
      "import 'package:test/test.dart';",
      '',
      'void main() {',
      "  group('Counter', () {",
      "    test('starts at zero', () {",
      '      expect(Counter().value, 0);',
      '    });',
      '',
      '    testWidgets("renders", (tester) async {});',
      '  });',
      '',
      "  test(r'raw $name', () {});",
      "  test('''triple''', () {});",
      '}',
    ].join('\n');
    expect(
      discoverDartTests(source).map((t) => `${t.kind} ${t.line} ${t.path.join(' > ')}`),
    ).toEqual([
      'suite 4 Counter',
      'test 5 Counter > starts at zero',
      'test 9 Counter > renders',
      'test 12 raw $name',
      'test 13 triple',
    ]);
  });
});
