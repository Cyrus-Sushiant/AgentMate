import { dirOf, toPosix } from '../paths.js';
import type { ParsedTestResult, TestProject, TestRef } from '../types.js';
import { child, findAll, parseXml } from '../xml.js';
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  cleanText,
  compact,
  escapeRegex,
  exactNames,
  fromProject,
  parseJson,
  projectCommand,
  reportPath,
  unique,
} from './shared.js';
import type { StreamParser, TestAdapter } from './types.js';

// ---------------------------------------------------------------------------------------------
// Go

const goPackage = (project: TestProject, file: string): string => {
  const dir = dirOf(fromProject(project, file));
  return dir === '' ? '.' : `./${dir}`;
};

export const goAdapter: TestAdapter = {
  framework: 'go',
  plan(project, target) {
    if (target.all) return { command: 'go', args: ['test', '-json', './...'], cwd: project.root };
    const refs = target.tests;
    const packages = unique([
      ...target.files.map((file) => goPackage(project, file)),
      ...refs.map((ref) => goPackage(project, ref.file)),
    ]);
    // A subtest runs by running its parent; -run with slashes cannot select across packages cleanly.
    const names = refs.map((ref) => ref.selector?.split('/')[0] ?? ref.path[0]);
    return {
      command: 'go',
      args: [
        'test',
        '-json',
        ...(names.length > 0 && target.files.length === 0 ? ['-run', exactNames(names)] : []),
        ...packages,
      ],
      cwd: project.root,
    };
  },
  stream: (project) => goStream(project),
};

function goStream(project: TestProject): StreamParser {
  const module = project.meta?.module;
  const output = new Map<string, string[]>();
  const buildOutput = new Map<string, string[]>();
  const dirOfPackage = (pkg: string): string | undefined => {
    if (!module) return undefined;
    if (pkg === module) return '';
    return pkg.startsWith(`${module}/`) ? pkg.slice(module.length + 1) : undefined;
  };

  return {
    push(line) {
      const event = asRecord(parseJson(line));
      const action = asString(event.Action);
      if (!action) return [];
      const pkg = asString(event.Package) ?? '';
      const test = asString(event.Test);
      const key = `${pkg}\u0000${test ?? ''}`;

      if (action === 'build-output') {
        const importPath = (asString(event.ImportPath) ?? '').split(' ')[0];
        buildOutput.set(importPath, [
          ...(buildOutput.get(importPath) ?? []),
          asString(event.Output) ?? '',
        ]);
        return [];
      }
      if (action === 'output') {
        const text = asString(event.Output) ?? '';
        // Frame lines (=== RUN, --- FAIL) repeat what the status already says.
        if (asString(event.OutputType) !== 'frame' && !/^(=== |--- |\s*--- )/.test(text)) {
          output.set(key, [...(output.get(key) ?? []), text]);
        }
        return [];
      }
      if (action !== 'pass' && action !== 'fail' && action !== 'skip') return [];
      const dir = dirOfPackage(pkg);

      if (!test) {
        const failedBuild = asString(event.FailedBuild);
        if (action !== 'fail' || !failedBuild) return [];
        const message = cleanText((buildOutput.get(failedBuild.split(' ')[0]) ?? []).join(''));
        return [compact({ dir, path: [], status: 'failed', message } satisfies ParsedTestResult)];
      }

      const message = cleanText(
        (output.get(key) ?? []).map((text) => text.replace(/^ {4}/, '')).join(''),
      );
      output.delete(key);
      return [
        compact({
          dir,
          path: test.split('/'),
          selector: test,
          status: action === 'pass' ? 'passed' : action === 'fail' ? 'failed' : 'skipped',
          durationMs: (asNumber(event.Elapsed) ?? 0) * 1000,
          message,
        } satisfies ParsedTestResult),
      ];
    },
    finish: () => [],
    display(line) {
      const event = asRecord(parseJson(line));
      if (!event.Action) return line;
      const text = asString(event.Output);
      return text === undefined ? null : text.replace(/\n$/, '');
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Cargo

export const cargoAdapter: TestAdapter = {
  framework: 'cargo',
  plan(project, target) {
    const base = ['test', '--no-fail-fast'];
    if (target.all) return { command: 'cargo', args: base, cwd: project.root };
    const wholeIntegrationFiles = target.files.filter((file) =>
      /^tests\/[^/]+\.rs$/.test(fromProject(project, file)),
    );
    if (target.tests.length === 0 && wholeIntegrationFiles.length === target.files.length) {
      const crates = wholeIntegrationFiles.map((file) =>
        fromProject(project, file)
          .replace(/^tests\//, '')
          .replace(/\.rs$/, ''),
      );
      return {
        command: 'cargo',
        args: [...base, ...crates.flatMap((crate) => ['--test', crate])],
        cwd: project.root,
      };
    }
    const names = unique(target.expanded.map((ref) => ref.selector ?? ref.path.join('::')));
    return { command: 'cargo', args: [...base, '--', '--exact', ...names], cwd: project.root };
  },
  stream: () => cargoStream(),
};

function cargoStream(): StreamParser {
  /** The integration test file being run, when the binary is one; unit tests have no single file. */
  let currentFile: string | undefined;
  let block: { name: string; lines: string[]; file?: string } | null = null;
  const fileByName = new Map<string, string | undefined>();

  const result = (
    name: string,
    status: ParsedTestResult['status'],
    file: string | undefined,
    message?: string,
  ) =>
    compact({
      file,
      path: name.split('::'),
      selector: name,
      status,
      message,
    } satisfies ParsedTestResult);

  const closeBlock = (): ParsedTestResult[] => {
    if (!block) return [];
    const lines = block.lines.filter((line) => !/^note: run with `RUST_BACKTRACE/.test(line));
    const done = [result(block.name, 'failed', block.file, cleanText(lines.join('\n')))];
    block = null;
    return done;
  };

  return {
    push(line) {
      const running = /^\s*Running (unittests )?(\S+)/.exec(line);
      if (running) {
        const done = closeBlock();
        currentFile = running[1] ? undefined : toPosix(running[2]);
        return done;
      }
      if (/^\s*Doc-tests /.test(line)) {
        currentFile = '\u0000doc';
        return closeBlock();
      }
      const header = /^---- (\S+) stdout ----$/.exec(line);
      if (header) {
        const done = closeBlock();
        block = { name: header[1], lines: [], file: fileByName.get(header[1]) };
        return done;
      }
      if (block) {
        if (/^failures:$/.test(line) || /^test result:/.test(line)) return closeBlock();
        block.lines.push(line);
        return [];
      }
      const outcome = /^test (\S+) \.\.\. (ok|FAILED|ignored)/.exec(line);
      if (!outcome || currentFile === '\u0000doc') return [];
      const [, name, word] = outcome;
      fileByName.set(name, currentFile);
      return [
        result(
          name,
          word === 'ok' ? 'passed' : word === 'FAILED' ? 'failed' : 'skipped',
          currentFile,
        ),
      ];
    },
    finish: closeBlock,
  };
}

// ---------------------------------------------------------------------------------------------
// .NET

export const dotnetAdapter: TestAdapter = {
  framework: 'dotnet',
  plan(project, target, ctx) {
    const filters = target.all
      ? []
      : unique([
          ...(target.files.length > 0
            ? target.expanded
                .filter((ref) => target.files.includes(ref.file))
                .map((ref) => `FullyQualifiedName~${classPrefix(ref)}`)
            : []),
          ...target.tests.map((ref) =>
            ref.selector
              ? `FullyQualifiedName=${ref.selector}`
              : `FullyQualifiedName~.${ref.path.filter((segment) => !segment.startsWith('(')).join('.')}`,
          ),
        ]);
    return {
      command: 'dotnet',
      args: [
        'test',
        '--logger',
        'trx',
        '--results-directory',
        ctx.reportDir,
        ...(filters.length > 0 ? ['--filter', filters.join('|')] : []),
      ],
      cwd: project.root,
      reportSearch: [{ root: ctx.reportDir, glob: '*.trx', freshOnly: false }],
    };
  },
  parseReport(text) {
    const root = parseXml(text);
    const definitions = new Map<string, { className: string; name: string }>();
    for (const unitTest of findAll(root, 'UnitTest')) {
      const method = child(unitTest, 'TestMethod');
      if (method) {
        definitions.set(unitTest.attributes.id ?? '', {
          className: method.attributes.className ?? '',
          name: method.attributes.name ?? '',
        });
      }
    }
    return findAll(root, 'UnitTestResult').map((entry) => {
      const { testId = '', testName = '', outcome = '', duration } = entry.attributes;
      const definition = definitions.get(testId);
      const fqn = definition ? `${definition.className}.${definition.name}` : testName;
      const variant =
        definition && testName.startsWith(fqn) ? testName.slice(fqn.length).trim() : '';
      const className = definition?.className ?? testName.split('.').slice(0, -1).join('.');
      const method = definition?.name ?? testName.split('.').pop() ?? testName;
      const errorInfo = child(child(entry, 'Output'), 'ErrorInfo');
      return compact({
        path: [
          ...(className.split('.').pop() ?? '').split('+'),
          method,
          ...(variant ? [variant] : []),
        ],
        selector: variant ? undefined : fqn,
        status:
          outcome === 'Passed'
            ? 'passed'
            : outcome === 'NotExecuted' || outcome === 'Inconclusive'
              ? 'skipped'
              : 'failed',
        durationMs: duration ? timeSpanMs(duration) : undefined,
        message: cleanText(child(errorInfo, 'Message')?.text),
        stack: stripBlankEnds(child(errorInfo, 'StackTrace')?.text),
      } satisfies ParsedTestResult);
    });
  },
};

function classPrefix(ref: TestRef): string {
  if (ref.selector) return ref.selector.slice(0, ref.selector.lastIndexOf('.') + 1);
  return `.${ref.path.slice(0, -1).join('.')}.`;
}

function timeSpanMs(value: string): number | undefined {
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return undefined;
  return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000;
}

/** Stack traces keep their leading indent; only line endings and blank edges are cleaned. */
function stripBlankEnds(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\r\n?/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
  return cleaned || undefined;
}

// ---------------------------------------------------------------------------------------------
// Dart and Flutter

function dartAdapter(framework: 'dart' | 'flutter'): TestAdapter {
  return {
    framework,
    plan(project, target) {
      const files = target.all
        ? []
        : unique(
            [...target.files, ...target.tests.map((ref) => ref.file)].map((file) =>
              fromProject(project, file),
            ),
          );
      const names = target.tests.map((ref) => ref.path.join(' '));
      return {
        command: framework,
        args: [
          'test',
          ...(framework === 'dart' ? ['--reporter', 'json'] : ['--machine']),
          ...files,
          ...(names.length > 0 ? ['--name', exactNames(names)] : []),
        ],
        cwd: project.root,
      };
    },
    stream: () => dartStream(),
  };
}

export const dartTestAdapter = dartAdapter('dart');
export const flutterTestAdapter = dartAdapter('flutter');

function dartStream(): StreamParser {
  const suites = new Map<number, string>();
  const groups = new Map<number, string>();
  const tests = new Map<
    number,
    {
      name: string;
      groupIDs: number[];
      suiteID: number;
      line?: number;
      errors: { error: string; stack: string }[];
    }
  >();

  return {
    push(line) {
      if (!line.startsWith('{')) return [];
      const event = asRecord(parseJson(line));
      switch (event.type) {
        case 'suite': {
          const suite = asRecord(event.suite);
          suites.set(asNumber(suite.id) ?? -1, asString(suite.path) ?? '');
          return [];
        }
        case 'group': {
          const group = asRecord(event.group);
          groups.set(asNumber(group.id) ?? -1, asString(group.name) ?? '');
          return [];
        }
        case 'testStart': {
          const test = asRecord(event.test);
          const url = asString(test.url) ?? '';
          const line = url.startsWith('package:') ? asNumber(test.root_line) : asNumber(test.line);
          tests.set(asNumber(test.id) ?? -1, {
            name: asString(test.name) ?? '',
            groupIDs: asArray(test.groupIDs).filter((id): id is number => typeof id === 'number'),
            suiteID: asNumber(test.suiteID) ?? -1,
            line,
            errors: [],
          });
          return [];
        }
        case 'error': {
          tests.get(asNumber(event.testID) ?? -1)?.errors.push({
            error: asString(event.error) ?? '',
            stack: asString(event.stackTrace) ?? '',
          });
          return [];
        }
        case 'testDone': {
          const test = tests.get(asNumber(event.testID) ?? -1);
          if (!test) return [];
          const file = suites.get(test.suiteID);
          const failed = event.result !== 'success';
          const message = cleanText(test.errors.map((error) => error.error).join('\n\n'));
          const stack = cleanText(test.errors.map((error) => error.stack).join('\n\n'));
          if (event.hidden === true) {
            return failed
              ? [compact({ file, path: [], status: 'failed', message } satisfies ParsedTestResult)]
              : [];
          }
          return [
            compact({
              file,
              line: test.line,
              path: dartPath(
                test.name,
                test.groupIDs.map((id) => groups.get(id) ?? ''),
              ),
              fullName: test.name,
              status: event.skipped === true ? 'skipped' : failed ? 'failed' : 'passed',
              message: failed ? message : undefined,
              stack: failed ? stack : undefined,
            } satisfies ParsedTestResult),
          ];
        }
        default:
          return [];
      }
    },
    finish: () => [],
    display(line) {
      if (!line.startsWith('{')) return line.startsWith('[{"event"') ? null : line;
      const event = asRecord(parseJson(line));
      if (event.type === 'print') return asString(event.message) ?? null;
      if (event.type === 'error') return asString(event.error) ?? null;
      return null;
    },
  };
}

/** Group names in these events are cumulative ("math nested"), so each level strips its parent. */
function dartPath(name: string, groupNames: string[]): string[] {
  const path: string[] = [];
  let prefix = '';
  for (const group of groupNames) {
    if (!group) continue;
    path.push(prefix && group.startsWith(`${prefix} `) ? group.slice(prefix.length + 1) : group);
    prefix = group;
  }
  path.push(prefix && name.startsWith(`${prefix} `) ? name.slice(prefix.length + 1) : name);
  return path;
}

// ---------------------------------------------------------------------------------------------
// PHPUnit, RSpec, Gradle and Maven

export const phpunitAdapter: TestAdapter = {
  framework: 'phpunit',
  plan(project, target, ctx) {
    const command =
      projectCommand(project, `vendor/bin/phpunit${ctx.platform === 'win32' ? '.bat' : ''}`, ctx) ??
      'phpunit';
    const report = reportPath(ctx, 'phpunit.xml');
    const names = target.tests.map((ref) =>
      ref.path.filter((segment) => !segment.startsWith('with data set')).join('::'),
    );
    return {
      command,
      args: [
        '--log-junit',
        report,
        ...(target.all ? [] : target.files.map((file) => fromProject(project, file))),
        ...(names.length > 0
          ? ['--filter', `/(?:${unique(names).map(escapeRegex).join('|')})(?:\\s|$)/`]
          : []),
      ],
      cwd: project.root,
      reportFiles: [report],
    };
  },
  parseReport(text) {
    return findAll(parseXml(text), 'testcase').map((testcase) => {
      const { name = '', file, line, time } = testcase.attributes;
      const className =
        testcase.attributes.class ?? (testcase.attributes.classname ?? '').replace(/\./g, '\\');
      const dataSet = /^(\S+) (with data set .+)$/.exec(name);
      const method = dataSet ? dataSet[1] : name;
      const failure = testcase.children.find(
        (entry) => entry.name === 'failure' || entry.name === 'error',
      );
      const skipped = testcase.children.find(
        (entry) => entry.name === 'skipped' || entry.name === 'incomplete',
      );
      const detail = cleanText(failure?.text)?.split('\n') ?? [];
      // The body starts with the test id, then the message, then a blank line and the location.
      if (detail[0]?.includes('::')) detail.shift();
      const blank = detail.indexOf('');
      const messageLines = blank < 0 ? detail : detail.slice(0, blank);
      const stackLines = blank < 0 ? [] : detail.slice(blank + 1);
      return compact({
        file,
        line: line ? Number(line) : undefined,
        path: [className.split('\\').pop() ?? className, method, ...(dataSet ? [dataSet[2]] : [])],
        selector: dataSet ? undefined : `${className}::${method}`,
        status: failure ? 'failed' : skipped ? 'skipped' : 'passed',
        durationMs: time ? Math.round(Number(time) * 1000 * 1000) / 1000 : undefined,
        message: failure
          ? (cleanText(failure.attributes.message) ?? cleanText(messageLines.join('\n')))
          : undefined,
        stack: failure ? cleanText(stackLines.join('\n')) : undefined,
      } satisfies ParsedTestResult);
    });
  },
};

export const rspecAdapter: TestAdapter = {
  framework: 'rspec',
  plan(project, target, ctx) {
    const report = `${ctx.reportDir}${ctx.platform === 'win32' ? '\\' : '/'}rspec.json`;
    const bundled = ctx.exists(project.root ? `${project.root}/Gemfile` : 'Gemfile');
    const selection = target.all
      ? []
      : unique([
          ...target.files.map((file) => fromProject(project, file)),
          ...target.tests.map((ref) =>
            ref.line
              ? `${fromProject(project, ref.file)}:${ref.line}`
              : fromProject(project, ref.file),
          ),
        ]);
    return {
      command: bundled ? 'bundle' : 'rspec',
      args: [
        ...(bundled ? ['exec', 'rspec'] : []),
        '--format',
        'progress',
        '--format',
        'json',
        '--out',
        report,
        ...selection,
      ],
      cwd: project.root,
      reportFiles: [report],
    };
  },
  parseReport(text) {
    return asArray(asRecord(parseJson(text)).examples)
      .map(asRecord)
      .map((example) => {
        const exception = asRecord(example.exception);
        const status = asString(example.status);
        const runTime = asNumber(example.run_time);
        return compact({
          file: asString(example.file_path),
          line: asNumber(example.line_number),
          path: [asString(example.description) ?? ''],
          fullName: asString(example.full_description),
          status: status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : 'skipped',
          durationMs: runTime === undefined ? undefined : Math.round(runTime * 1000 * 1000) / 1000,
          message: cleanText(asString(exception.message)),
          stack: asArray(exception.backtrace).length
            ? asArray(exception.backtrace)
                .filter((entry) => typeof entry === 'string')
                .join('\n')
            : undefined,
        } satisfies ParsedTestResult);
      });
  },
};

/** JUnit XML as written by Gradle and Maven Surefire. */
function parseJvmJunit(text: string): ParsedTestResult[] {
  return findAll(parseXml(text), 'testcase').map((testcase) => {
    const { name = '', classname = '', time } = testcase.attributes;
    const simple = classname.split('.').pop() ?? classname;
    // JUnit 5 through Gradle writes `method()`, parameterized runs `method(int)[1]`.
    const parameterized = /^([^(]+)\([^)]*\)(\[.+\])$/.exec(name);
    const method = parameterized ? parameterized[1] : name.replace(/\(\)$/, '');
    const failure = testcase.children.find(
      (entry) => entry.name === 'failure' || entry.name === 'error',
    );
    const skipped = testcase.children.find((entry) => entry.name === 'skipped');
    return compact({
      path: [...simple.split('$'), method, ...(parameterized ? [parameterized[2]] : [])],
      selector: parameterized ? undefined : `${classname}.${method}`,
      status: failure ? 'failed' : skipped ? 'skipped' : 'passed',
      durationMs: time ? Math.round(Number(time) * 1000 * 1000) / 1000 : undefined,
      message: cleanText(failure?.attributes.message),
      stack: cleanText(failure?.text),
    } satisfies ParsedTestResult);
  });
}

export const gradleAdapter: TestAdapter = {
  framework: 'gradle',
  plan(project, target, ctx) {
    const wrapper = project.meta?.wrapper === 'true';
    const command = wrapper ? (ctx.platform === 'win32' ? 'gradlew.bat' : './gradlew') : 'gradle';
    const selectors = target.all
      ? []
      : jvmSelectors(target.files, target.tests, target.expanded).map((entry) => entry.dotted);
    return {
      command,
      args: [
        'cleanTest',
        'test',
        '--continue',
        ...selectors.flatMap((selector) => ['--tests', selector]),
      ],
      cwd: project.root,
      reportSearch: [
        { root: project.root, glob: '**/build/test-results/test/*.xml', freshOnly: true },
      ],
    };
  },
  parseReport: parseJvmJunit,
};

export const mavenAdapter: TestAdapter = {
  framework: 'maven',
  plan(project, target, ctx) {
    const command =
      projectCommand(project, ctx.platform === 'win32' ? 'mvnw.cmd' : 'mvnw', ctx) ?? 'mvn';
    const byClass = new Map<string, string[]>();
    if (!target.all) {
      for (const entry of jvmSelectors(target.files, target.tests, target.expanded)) {
        const methods = byClass.get(entry.className) ?? [];
        if (entry.method) methods.push(entry.method);
        byClass.set(entry.className, methods);
      }
    }
    const test = [...byClass.entries()]
      .map(([className, methods]) =>
        methods.length > 0 ? `${className}#${unique(methods).join('+')}` : className,
      )
      .join(',');
    return {
      command,
      args: [
        'test',
        ...(test ? [`-Dtest=${test}`, '-Dsurefire.failIfNoSpecifiedTests=false'] : []),
      ],
      cwd: project.root,
      reportSearch: [
        { root: project.root, glob: '**/target/surefire-reports/TEST-*.xml', freshOnly: true },
      ],
    };
  },
  parseReport: parseJvmJunit,
};

function jvmSelectors(
  files: string[],
  tests: TestRef[],
  expanded: TestRef[],
): { dotted: string; className: string; method?: string }[] {
  const out: { dotted: string; className: string; method?: string }[] = [];
  for (const file of files) {
    const selector = expanded.find((entry) => entry.file === file && entry.selector)?.selector;
    const qualified = selector
      ? selector.slice(0, selector.lastIndexOf('.'))
      : (file.split('/').pop() ?? file).replace(/\.\w+$/, '');
    out.push({ dotted: qualified, className: qualified.split('.').pop() ?? qualified });
  }
  for (const ref of tests) {
    const segments = ref.path.filter((segment) => !segment.startsWith('['));
    const method = segments[segments.length - 1] ?? '';
    const dotted = ref.selector ?? segments.join('.');
    const qualified = dotted.slice(0, Math.max(0, dotted.length - method.length - 1));
    out.push({ dotted, className: qualified.split('.').pop() ?? qualified, method });
  }
  return out;
}
