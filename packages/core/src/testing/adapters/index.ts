import type { ParsedTestResult, TestFrameworkId, TestProject } from '../types.js';
import {
  cargoAdapter,
  dartTestAdapter,
  dotnetAdapter,
  flutterTestAdapter,
  goAdapter,
  gradleAdapter,
  mavenAdapter,
  phpunitAdapter,
  rspecAdapter,
} from './compiled.js';
import { jestAdapter, mochaAdapter, playwrightAdapter, vitestAdapter } from './js.js';
import { pytestAdapter, unittestAdapter } from './python.js';
import type { ResolvedTarget, RunContext, RunPlan, StreamParser, TestAdapter } from './types.js';

export { stripAnsi } from './shared.js';
export type {
  ReportSearch,
  ResolvedTarget,
  RunContext,
  RunPlan,
  StreamParser,
  TestAdapter,
} from './types.js';

const ADAPTERS: Record<TestFrameworkId, TestAdapter> = {
  vitest: vitestAdapter,
  jest: jestAdapter,
  playwright: playwrightAdapter,
  mocha: mochaAdapter,
  pytest: pytestAdapter,
  unittest: unittestAdapter,
  go: goAdapter,
  cargo: cargoAdapter,
  dotnet: dotnetAdapter,
  dart: dartTestAdapter,
  flutter: flutterTestAdapter,
  phpunit: phpunitAdapter,
  rspec: rspecAdapter,
  gradle: gradleAdapter,
  maven: mavenAdapter,
};

export function getTestAdapter(framework: TestFrameworkId): TestAdapter {
  return ADAPTERS[framework];
}

export function planTestRun(
  project: TestProject,
  target: ResolvedTarget,
  ctx: RunContext,
): RunPlan {
  return ADAPTERS[project.framework].plan(project, target, ctx);
}

export function parseTestReport(framework: TestFrameworkId, text: string): ParsedTestResult[] {
  if (!text.trim()) return [];
  return ADAPTERS[framework].parseReport?.(text) ?? [];
}

export function createStreamParser(project: TestProject): StreamParser | null {
  return ADAPTERS[project.framework].stream?.(project) ?? null;
}

/** Flags the panel adds only so it can read results; a person rerunning a test does not need them. */
const MACHINE_FLAGS = new Set([
  '--reporter=default',
  '--reporter=verbose',
  '--reporter=json',
  '--reporter=list,json',
  '--json',
  '--testLocationInResults',
  '-json',
  '--machine',
]);
const MACHINE_PAIRS: Record<string, string> = {
  '--reporter': 'json',
  '-o': 'junit_family=xunit1',
  '--logger': 'trx',
};
const REPORT_VALUE_FLAGS = new Set([
  '--reporter-option',
  '--log-junit',
  '--out',
  '--results-directory',
]);

/**
 * The command with the reporting plumbing taken out, so it reads the way someone would type it to
 * rerun the tests themselves: for Copy issue and the Fix with AI prompt.
 */
export function readableCommand(
  plan: Pick<RunPlan, 'command' | 'args'>,
  reportDir: string,
): string {
  const args: string[] = [];
  const { args: all } = plan;
  for (let i = 0; i < all.length; i += 1) {
    const arg = all[i];
    const next = all[i + 1];
    if (MACHINE_FLAGS.has(arg) || arg.includes(reportDir)) continue;
    if (REPORT_VALUE_FLAGS.has(arg) && next?.includes(reportDir)) {
      i += 1;
      continue;
    }
    if (Object.hasOwn(MACHINE_PAIRS, arg) && MACHINE_PAIRS[arg] === next) {
      i += 1;
      continue;
    }
    if (arg === '--format' && next === 'json') {
      i += 1;
      continue;
    }
    args.push(arg);
  }
  return formatCommand({ command: plan.command, args });
}

/** The command as a person would type it, for the output header and for Copy issue. */
export function formatCommand(plan: Pick<RunPlan, 'command' | 'args'>): string {
  return [plan.command, ...plan.args].map(quoteForDisplay).join(' ');
}

function quoteForDisplay(value: string): string {
  if (value !== '' && /^[\w@%+=:,./\\-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}
