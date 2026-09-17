import { describe, expect, it } from 'vitest';
import { buildFixTestsPrompt, formatTestIssue } from './issue.js';
import type { TestResult, TestRunError } from './types.js';

const failing: TestResult = {
  id: 'vitest:web::web/src/math.test.ts::math > adds',
  testProjectId: 'vitest:web',
  file: 'web/src/math.test.ts',
  path: ['math', 'adds'],
  line: 4,
  status: 'failed',
  durationMs: 12,
  message: 'AssertionError: expected 3 to be 2',
  stack: '    at web/src/math.test.ts:5:19',
};

describe('formatTestIssue', () => {
  it('writes the test, where it is, how to rerun it and the failure', () => {
    expect(
      formatTestIssue(failing, {
        frameworkLabel: 'Vitest',
        command: "pnpm exec vitest run src/math.test.ts -t '^(?:math adds)$'",
      }),
    ).toBe(
      [
        'Failing test: math > adds',
        'File: web/src/math.test.ts:4',
        'Framework: Vitest',
        "Run it: pnpm exec vitest run src/math.test.ts -t '^(?:math adds)$'",
        '',
        'Error:',
        '```',
        'AssertionError: expected 3 to be 2',
        '```',
        '',
        'Stack:',
        '```',
        '    at web/src/math.test.ts:5:19',
        '```',
      ].join('\n'),
    );
  });

  it('describes a file that failed as a whole and leaves out what it does not know', () => {
    expect(
      formatTestIssue(
        { ...failing, path: [], line: undefined, stack: undefined, message: 'SyntaxError' },
        {},
      ),
    ).toBe(
      ['Failing test file: web/src/math.test.ts', '', 'Error:', '```', 'SyntaxError', '```'].join(
        '\n',
      ),
    );
  });

  it('keeps long stacks readable by trimming them', () => {
    const stack = Array.from({ length: 200 }, (_, i) => `    at frame${i}`).join('\n');
    const text = formatTestIssue({ ...failing, stack }, {});
    expect(text).toContain('    at frame39');
    expect(text).not.toContain('    at frame40\n');
    expect(text).toContain('(160 more lines)');
  });

  it('uses a longer fence when the output itself contains one', () => {
    const text = formatTestIssue(
      { ...failing, stack: undefined, message: 'diff:\n```\n-a\n+b\n```' },
      {},
    );
    expect(text).toContain('````\ndiff:\n```\n-a\n+b\n```\n````');
  });
});

describe('buildFixTestsPrompt', () => {
  it('asks the agent to fix one failing test', () => {
    const prompt = buildFixTestsPrompt({
      failures: [failing],
      errors: [],
      frameworkLabel: 'Vitest',
      command: 'pnpm exec vitest run',
    });
    expect(prompt).toBe(
      [
        'A test is failing in this repository: math > adds (web/src/math.test.ts:4, Vitest).',
        '',
        'Find the root cause and fix it. Work out whether the code or the test is wrong before changing either, keep the change focused on this failure, and run the test again to confirm it passes. When you are done, explain the cause and what you changed.',
        '',
        'Run the tests with:',
        '```',
        'pnpm exec vitest run',
        '```',
        '',
        'Failure output:',
        '',
        '### math > adds',
        '```',
        'AssertionError: expected 3 to be 2',
        '    at web/src/math.test.ts:5:19',
        '```',
      ].join('\n'),
    );
  });

  it('lists several failures and caps how many it pastes', () => {
    const failures = Array.from({ length: 25 }, (_, i) => ({
      ...failing,
      id: `id${i}`,
      path: ['suite', `case ${i}`],
      line: i + 1,
    }));
    const prompt = buildFixTestsPrompt({ failures, errors: [], frameworkLabel: 'Vitest' });
    expect(
      prompt.startsWith(
        '25 tests are failing in this repository:\n\n- suite > case 0 (web/src/math.test.ts:1)',
      ),
    ).toBe(true);
    expect(prompt).toContain('keep the change focused on these failures, and run the tests again');
    expect(prompt.match(/^### /gm)).toHaveLength(15);
    expect(prompt).toContain('(10 more failures not shown)');
  });

  it('includes a run that could not finish', () => {
    const error: TestRunError = {
      kind: 'noResults',
      testProjectId: 'go:',
      command: 'go test -json ./...',
      message: 'The run ended without reporting any results.',
      log: '# example.com/fx/calc\ncalc/calc.go:3:1: syntax error',
    };
    const prompt = buildFixTestsPrompt({ failures: [], errors: [error], frameworkLabel: 'Go' });
    expect(prompt).toBe(
      [
        'The Go tests in this repository could not run to completion.',
        '',
        'Find out why and fix it so the tests run. Keep the change focused on the problem, then run the tests again to confirm. When you are done, explain the cause and what you changed.',
        '',
        'Command: go test -json ./...',
        'The run ended without reporting any results.',
        '```',
        '# example.com/fx/calc',
        'calc/calc.go:3:1: syntax error',
        '```',
      ].join('\n'),
    );
  });

  it('trims very long output and says so', () => {
    const prompt = buildFixTestsPrompt({
      failures: [{ ...failing, stack: 'x'.repeat(20_000) }],
      errors: [],
    });
    expect(prompt.length).toBeLessThan(9_000);
    expect(prompt).toContain('(rest of the output trimmed)');
  });
});
