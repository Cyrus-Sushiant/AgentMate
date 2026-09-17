import type { ParsedTestResult, TestProject, TestRef } from '../types.js';
import { findAll, parseXml } from '../xml.js';
import { cleanText, compact, fromProject, pythonCommand, reportPath, unique } from './shared.js';
import type { StreamParser, TestAdapter } from './types.js';

/** `tests/test_a.py::TestA::test_one`, with a `[param]` variant glued onto its test. */
function pytestNodeId(project: TestProject, ref: TestRef): string {
  if (ref.selector) return ref.selector;
  return ref.path.reduce(
    (id, segment) => (segment.startsWith('[') ? `${id}${segment}` : `${id}::${segment}`),
    fromProject(project, ref.file),
  );
}

const moduleOf = (file: string): string => file.replace(/\.py$/, '').replace(/[\\/]/g, '.');

export const pytestAdapter: TestAdapter = {
  framework: 'pytest',
  plan(project, target, ctx) {
    const report = reportPath(ctx, 'pytest.xml');
    const selection = target.all
      ? []
      : unique([
          ...target.files.map((file) => fromProject(project, file)),
          ...target.tests.map((ref) => pytestNodeId(project, ref)),
        ]);
    return {
      command: pythonCommand(project, ctx),
      // xunit1 is the JUnit flavour that still records each test's file and line.
      args: ['-m', 'pytest', `--junitxml=${report}`, '-o', 'junit_family=xunit1', ...selection],
      cwd: project.root,
      reportFiles: [report],
    };
  },
  parseReport(text) {
    return findAll(parseXml(text), 'testcase').map((testcase) => {
      const { classname = '', name = '', file, line, time } = testcase.attributes;
      const module = file ? moduleOf(file) : '';
      let classes: string[];
      if (module && classname.startsWith(`${module}.`))
        classes = classname.slice(module.length + 1).split('.');
      else if (module && classname === module) classes = [];
      else classes = classname.split('.').filter((segment) => /^[A-Z]/.test(segment));
      const variant = /^([^[]+)(\[.*\])$/.exec(name);
      const failure = testcase.children.find(
        (child) => child.name === 'failure' || child.name === 'error',
      );
      const skipped = testcase.children.find((child) => child.name === 'skipped');
      return compact({
        file,
        line: line !== undefined && line !== '' ? Number(line) + 1 : undefined,
        path: [...classes, ...(variant ? [variant[1], variant[2]] : [name])],
        status: failure ? 'failed' : skipped ? 'skipped' : 'passed',
        durationMs: time ? Number(time) * 1000 : undefined,
        message: cleanText(failure?.attributes.message ?? skipped?.attributes.message),
        stack: cleanText(failure?.text),
      } satisfies ParsedTestResult);
    });
  },
};

export const unittestAdapter: TestAdapter = {
  framework: 'unittest',
  plan(project, target, ctx) {
    const selection = target.all
      ? []
      : unique([
          ...target.files.map((file) => moduleOf(fromProject(project, file))),
          ...target.tests.map(
            (ref) =>
              ref.selector ?? [moduleOf(fromProject(project, ref.file)), ...ref.path].join('.'),
          ),
        ]);
    return {
      command: pythonCommand(project, ctx),
      args: ['-m', 'unittest', '-v', ...selection],
      cwd: project.root,
    };
  },
  stream: () => unittestStream(),
};

const RESULT = / \.\.\. (ok|FAIL|ERROR|skipped.*|expected failure|unexpected success)$/;
const HEADER = /^(\w+) \(([\w.]+)\)/;

function unittestStream(): StreamParser {
  let header: RegExpExecArray | null = null;
  let block: { id: ReturnType<typeof identify>; lines: string[]; started: boolean } | null = null;

  const finishBlock = (): ParsedTestResult[] => {
    if (!block) return [];
    const lines = block.lines.join('\n');
    const stack = cleanText(lines);
    const message = stack
      ?.split('\n')
      .filter((line) => line.trim() !== '')
      .pop();
    const result = compact({
      ...block.id,
      status: 'failed',
      message,
      stack,
    } satisfies ParsedTestResult);
    block = null;
    return [result];
  };

  return {
    push(line) {
      const failureHeader = /^(FAIL|ERROR): (\w+) \(([\w.]+)\)/.exec(line);
      if (failureHeader) {
        const done = finishBlock();
        block = { id: identify(failureHeader[2], failureHeader[3]), lines: [], started: false };
        return done;
      }
      if (block) {
        if (/^-{20,}$/.test(line) || /^={20,}$/.test(line)) {
          if (!block.started && /^-{20,}$/.test(line)) {
            block.started = true;
            return [];
          }
          return finishBlock();
        }
        if (block.started) block.lines.push(line);
        return [];
      }

      const own = HEADER.exec(line);
      const outcome = RESULT.exec(line);
      const source = own ?? header;
      if (own && !outcome) {
        header = own;
        return [];
      }
      header = null;
      if (!outcome || !source) return [];
      const word = outcome[1];
      const status: ParsedTestResult['status'] =
        word === 'ok' || word === 'expected failure'
          ? 'passed'
          : word.startsWith('skipped')
            ? 'skipped'
            : 'failed';
      return [{ ...identify(source[1], source[2]), status }];
    },
    finish: finishBlock,
  };
}

/**
 * Python 3.11+ prints `test_x (pkg.mod.Class.test_x)`, older versions `test_x (pkg.mod.Class)`.
 * Either way the module is everything before the class.
 */
function identify(
  method: string,
  inner: string,
): { file: string; path: string[]; selector: string } {
  const dotted = inner.endsWith(`.${method}`) ? inner : `${inner}.${method}`;
  const segments = dotted.split('.');
  const className = segments[segments.length - 2];
  const module = segments.slice(0, -2);
  return {
    file: `${module.join('/')}.py`,
    path: [className, method],
    selector: dotted,
  };
}
