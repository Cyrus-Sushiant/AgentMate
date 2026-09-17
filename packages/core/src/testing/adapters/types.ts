import type { ParsedTestResult, TestFrameworkId, TestProject, TestRef } from '../types.js';

export interface RunContext {
  platform: string;
  /** Absolute workspace folder. */
  folderPath: string;
  /** Absolute, empty folder this run may write reports into. */
  reportDir: string;
  /** Whether a workspace relative path exists. */
  exists(path: string): boolean;
}

/** A selection after the runner has looked it up in the discovered tree. */
export interface ResolvedTarget {
  all: boolean;
  /** Whole files, workspace relative. */
  files: string[];
  /** Individually picked tests. */
  tests: TestRef[];
  /** `tests` plus every test inside `files`, for runners that can only select by name. */
  expanded: TestRef[];
}

export interface ReportSearch {
  /** Absolute, or workspace relative. */
  root: string;
  glob: string;
  /** Only reports written during this run, for tools that leave old ones behind. */
  freshOnly: boolean;
}

export interface RunPlan {
  command: string;
  args: string[];
  /** Workspace relative folder to run in. */
  cwd: string;
  env?: Record<string, string>;
  /** Absolute report files to read once the run ends. */
  reportFiles?: string[];
  reportSearch?: ReportSearch[];
}

export interface StreamParser {
  /** One raw output line in, any results it completes out. */
  push(line: string): ParsedTestResult[];
  /** Called once output ends, for results still waiting on more lines. */
  finish(): ParsedTestResult[];
  /** Readable text for the output panel when the raw line is machine output, or null to hide it. */
  display?(line: string): string | null;
}

export interface TestAdapter {
  framework: TestFrameworkId;
  plan(project: TestProject, target: ResolvedTarget, ctx: RunContext): RunPlan;
  stream?(project: TestProject): StreamParser;
  parseReport?(text: string): ParsedTestResult[];
}
