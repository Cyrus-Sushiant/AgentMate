import type { TestResult, TestRunError } from './types.js';

/**
 * Text a person copies out of the Tests panel, and the prompt an agent gets when asked to fix a
 * failure. Both are plain Markdown so they paste cleanly into an issue, a chat or a terminal.
 */

const STACK_LINES = 40;
const FAILURE_CHARS = 4_000;
const PROMPT_OUTPUT_CHARS = 8_000;
const MAX_DETAILED_FAILURES = 15;
const MAX_LISTED_FAILURES = 50;

function fence(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const marker = '`'.repeat(Math.max(3, longest + 1));
  return `${marker}\n${text}\n${marker}`;
}

const testName = (result: TestResult): string => result.path.join(' > ');

const location = (result: TestResult): string | undefined =>
  result.file ? `${result.file}${result.line ? `:${result.line}` : ''}` : undefined;

function trimLines(text: string, max: number): string {
  const lines = text.split('\n');
  if (lines.length <= max) return text;
  return `${lines.slice(0, max).join('\n')}\n(${lines.length - max} more lines)`;
}

function keepHead(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n... (rest of the output trimmed)`;
}

function keepTail(text: string, max: number): string {
  return text.length <= max ? text : `(earlier output trimmed)\n${text.slice(-max)}`;
}

export function formatTestIssue(
  result: TestResult,
  context: { frameworkLabel?: string; command?: string },
): string {
  const lines: string[] = [];
  if (result.path.length > 0) {
    lines.push(`Failing test: ${testName(result)}`);
    const where = location(result);
    if (where) lines.push(`File: ${where}`);
  } else {
    lines.push(`Failing test file: ${result.file ?? 'unknown'}`);
  }
  if (context.frameworkLabel) lines.push(`Framework: ${context.frameworkLabel}`);
  if (context.command) lines.push(`Run it: ${context.command}`);
  if (result.message) lines.push('', 'Error:', fence(result.message));
  if (result.stack) lines.push('', 'Stack:', fence(trimLines(result.stack, STACK_LINES)));
  return lines.join('\n');
}

export function buildFixTestsPrompt(input: {
  failures: readonly TestResult[];
  errors: readonly TestRunError[];
  frameworkLabel?: string;
  command?: string;
}): string {
  const { failures, errors, frameworkLabel, command } = input;
  const lines: string[] = [];

  if (failures.length === 1) {
    const [only] = failures;
    const detail = [location(only), frameworkLabel].filter(Boolean).join(', ');
    lines.push(
      `A test is failing in this repository: ${testName(only) || only.file}${detail ? ` (${detail})` : ''}.`,
      '',
      'Find the root cause and fix it. Work out whether the code or the test is wrong before changing either, keep the change focused on this failure, and run the test again to confirm it passes. When you are done, explain the cause and what you changed.',
    );
  } else if (failures.length > 1) {
    lines.push(`${failures.length} tests are failing in this repository:`, '');
    for (const failure of failures.slice(0, MAX_LISTED_FAILURES)) {
      const where = location(failure);
      lines.push(`- ${testName(failure) || failure.file}${where ? ` (${where})` : ''}`);
    }
    if (failures.length > MAX_LISTED_FAILURES)
      lines.push(`- and ${failures.length - MAX_LISTED_FAILURES} more`);
    lines.push(
      '',
      'Find the root cause and fix them. Work out whether the code or the tests are wrong before changing either, keep the change focused on these failures, and run the tests again to confirm they pass. When you are done, explain the cause and what you changed.',
    );
  } else if (errors.length > 0) {
    lines.push(
      `The ${frameworkLabel ? `${frameworkLabel} ` : ''}tests in this repository could not run to completion.`,
      '',
      'Find out why and fix it so the tests run. Keep the change focused on the problem, then run the tests again to confirm. When you are done, explain the cause and what you changed.',
    );
  }

  if (command) lines.push('', 'Run the tests with:', fence(command));

  if (failures.length > 0) {
    lines.push('', 'Failure output:');
    let used = 0;
    let shown = 0;
    for (const failure of failures) {
      if (shown >= MAX_DETAILED_FAILURES || used >= PROMPT_OUTPUT_CHARS) break;
      const output = keepHead(
        [failure.message, failure.stack].filter(Boolean).join('\n') || 'No output was captured.',
        FAILURE_CHARS,
      );
      lines.push('', `### ${testName(failure) || failure.file}`, fence(output));
      used += output.length;
      shown += 1;
    }
    if (shown < failures.length)
      lines.push('', `(${failures.length - shown} more failures not shown)`);
  }

  if (errors.length > 0) {
    if (failures.length > 0) lines.push('', 'Some test runs could not finish:');
    for (const error of errors) {
      lines.push('', `Command: ${error.command}`, error.message);
      if (error.log.trim()) lines.push(fence(keepTail(error.log.trim(), FAILURE_CHARS)));
    }
  }

  return lines.join('\n').replace(/^\n+/, '');
}
