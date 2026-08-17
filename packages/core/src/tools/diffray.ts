import type { AgentType } from '../types/index.js';
import type { ToolSettingsAction, ToolSettingsValues } from './types.js';

export const DIFFRAY_TOOL_ID = 'diffray';
export const DIFFRAY_WEBSITE_URL = 'https://diffray.ai/cli';
export const DIFFRAY_GITHUB_APP_URL = 'https://diffray.ai/integrations/github/';
export const DIFFRAY_REPOSITORY_URL = 'https://github.com/diffray/diffray';
export const DIFFRAY_PROJECT_CONFIG_FILE = '.diffray.json';

export const DIFFRAY_AGENTS = [
  {
    id: 'general',
    label: 'Quality',
    description: 'Readability, simplicity, and code smells',
  },
  {
    id: 'bug-hunter',
    label: 'Bugs',
    description: 'Logic errors, nulls, and edge cases',
  },
  {
    id: 'security-scan',
    label: 'Security',
    description: 'Vulnerabilities and leaked secrets',
  },
  {
    id: 'performance-check',
    label: 'Performance',
    description: 'Slow paths and memory leaks',
  },
  {
    id: 'consistency-check',
    label: 'Consistency',
    description: 'Naming and pattern drift',
  },
] as const;

export type DiffrayAgentId = (typeof DIFFRAY_AGENTS)[number]['id'];

export const DIFFRAY_EXECUTORS = [
  {
    id: 'claude-cli',
    label: 'Claude Code',
    description: 'Uses your Claude Code login',
  },
  {
    id: 'cursor-agent-cli',
    label: 'Cursor Agent',
    description: 'Uses your Cursor subscription',
  },
  {
    id: 'opencode-cli',
    label: 'OpenCode',
    description: 'Multi-provider OpenCode CLI',
  },
  {
    id: 'codex-cli',
    label: 'Codex',
    description: 'OpenAI Codex CLI',
  },
] as const;

export type DiffrayExecutorId = (typeof DIFFRAY_EXECUTORS)[number]['id'];

export const DIFFRAY_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export type DiffraySeverity = (typeof DIFFRAY_SEVERITIES)[number];

export const DIFFRAY_MODELS: Record<DiffrayExecutorId, { value: string; label: string }[]> = {
  'claude-cli': [
    { value: '', label: 'Executor default' },
    { value: 'haiku', label: 'Haiku (fast)' },
    { value: 'sonnet', label: 'Sonnet (balanced)' },
    { value: 'opus', label: 'Opus (thorough)' },
  ],
  'cursor-agent-cli': [
    { value: '', label: 'Executor default' },
    { value: 'auto', label: 'Auto' },
    { value: 'sonnet-4.5', label: 'Sonnet 4.5' },
    { value: 'opus-4.5', label: 'Opus 4.5' },
  ],
  'opencode-cli': [
    { value: '', label: 'Executor default' },
    { value: 'opencode/gpt-5-nano', label: 'GPT-5 nano' },
    { value: 'opencode/grok-code', label: 'Grok code' },
  ],
  'codex-cli': [{ value: '', label: 'Executor default' }],
};

export type DiffrayReviewScope =
  | 'working-tree'
  | 'base-branch'
  | 'last-commits'
  | 'files'
  | 'codebase';

export interface DiffrayReviewInput {
  scope: DiffrayReviewScope;
  baseRef?: string;
  commitCount?: number;
  files?: string[];
  fullFiles?: boolean;
  agentIds: string[];
  executor: string;
  model?: string;
  severities: string[];
  skipValidation: boolean;
  stream: boolean;
  /** Codebase scope only: how many files each `diffray review` pass gets. */
  filesPerPass?: number;
  /** Ask the CLI for machine-readable findings instead of the terminal report. */
  jsonOutput?: boolean;
}

/** Shells AgentMate's terminal opens with, which differ in how they redirect output to a file. */
export type DiffrayShellKind = 'powershell' | 'posix';

export const DIFFRAY_DEFAULT_JSON_FILE = 'diffray-report.json';

/**
 * Extensions diffray can actually reason about. Data files, lockfiles, images, and binaries
 * are left out: they burn context without producing findings.
 */
const SOURCE_EXTENSIONS = new Set([
  'astro',
  'bash',
  'c',
  'cc',
  'cjs',
  'clj',
  'cpp',
  'cs',
  'cts',
  'dart',
  'ex',
  'exs',
  'fs',
  'go',
  'groovy',
  'h',
  'hpp',
  'java',
  'js',
  'jsx',
  'kt',
  'kts',
  'lua',
  'm',
  'mjs',
  'mm',
  'mts',
  'php',
  'pl',
  'proto',
  'ps1',
  'psm1',
  'py',
  'r',
  'rb',
  'rs',
  'scala',
  'sh',
  'sql',
  'svelte',
  'swift',
  'ts',
  'tsx',
  'vb',
  'vue',
  'zsh',
]);

/** Directories nobody wants reviewed: dependencies, build output, and caches. */
const IGNORED_DIRECTORIES = new Set([
  '.cache',
  '.git',
  '.gradle',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.venv',
  '__pycache__',
  'bin',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'obj',
  'out',
  'target',
  'vendor',
  'venv',
]);

const TEST_DIRECTORIES = new Set(['__mocks__', '__tests__', 'e2e', 'spec', 'test', 'tests']);

export interface DiffrayCodebaseFilter {
  /** Repo-relative folder to stay inside. Empty means the whole repository. */
  folder?: string;
  /** Test and spec files are noisy in a whole-codebase pass, so they are out by default. */
  includeTests?: boolean;
}

export interface DiffrayCodebaseFolder {
  path: string;
  fileCount: number;
}

/** Every pass is one `diffray review`, and the CLI runs one agent per file batch. */
export const DIFFRAY_DEFAULT_FILES_PER_PASS = 10;
export const DIFFRAY_MAX_FILES_PER_PASS = 40;

/**
 * npm installs diffray as a .cmd shim on Windows, so each command goes through cmd.exe and
 * its 8191 character line limit. Leave room to spare.
 */
const MAX_COMMAND_CHARS = 6000;

function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeFolder(folder: string | undefined): string {
  return toPosixPath(folder?.trim() ?? '').replace(/^\/+|\/+$/g, '');
}

export function isDiffrayTestFile(path: string): boolean {
  const segments = toPosixPath(path).split('/');
  const name = segments.pop() ?? '';
  if (segments.some((segment) => TEST_DIRECTORIES.has(segment.toLowerCase()))) return true;
  return /\.(test|spec)\.[^.]+$/i.test(name);
}

/** True when diffray reviewing the whole file is likely to be worth the tokens. */
export function isDiffraySourceFile(path: string): boolean {
  const normalized = toPosixPath(path);
  if (!normalized || normalized.startsWith('../')) return false;
  const segments = normalized.split('/');
  const name = segments.pop() ?? '';
  if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) return false;
  // Generated and bundled output reads like source but is not worth reviewing.
  if (name.endsWith('.d.ts') || /\.(min|bundle|generated)\./i.test(name)) return false;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  return SOURCE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export function filterDiffrayCodebaseFiles(
  paths: readonly string[],
  filter: DiffrayCodebaseFilter = {},
): string[] {
  const folder = normalizeFolder(filter.folder);
  const prefix = folder ? `${folder}/` : '';
  const matched = new Set<string>();
  for (const raw of paths) {
    const path = toPosixPath(raw);
    if (prefix && !path.startsWith(prefix)) continue;
    if (!isDiffraySourceFile(path)) continue;
    if (!filter.includeTests && isDiffrayTestFile(path)) continue;
    matched.add(path);
  }
  return [...matched].sort((a, b) => a.localeCompare(b));
}

/**
 * Folders worth offering as a review target, with the file count each one holds. Only the top
 * two levels: deeper than that the picker turns into a file tree, which is not the point here.
 */
export function diffrayCodebaseFolders(
  paths: readonly string[],
  filter: Omit<DiffrayCodebaseFilter, 'folder'> = {},
  maxDepth = 2,
): DiffrayCodebaseFolder[] {
  const counts = new Map<string, number>();
  for (const path of filterDiffrayCodebaseFiles(paths, filter)) {
    const segments = path.split('/');
    segments.pop();
    for (let depth = 1; depth <= Math.min(maxDepth, segments.length); depth += 1) {
      const folder = segments.slice(0, depth).join('/');
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([path, fileCount]) => ({ path, fileCount }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Splits files into review passes. A pass ends at `filesPerPass` files or when the command
 * would outgrow the shell's line limit, whichever comes first.
 */
export function chunkDiffrayFiles(
  files: readonly string[],
  filesPerPass = DIFFRAY_DEFAULT_FILES_PER_PASS,
  overheadChars = 120,
): string[][] {
  const perPass = Math.max(1, Math.min(DIFFRAY_MAX_FILES_PER_PASS, Math.round(filesPerPass)));
  const budget = Math.max(200, MAX_COMMAND_CHARS - overheadChars);
  const batches: string[][] = [];
  let batch: string[] = [];
  let length = 0;
  for (const file of files) {
    const cost = file.length + 1;
    if (batch.length > 0 && (batch.length >= perPass || length + cost > budget)) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(file);
    length += cost;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

const ALL_AGENT_IDS: readonly string[] = DIFFRAY_AGENTS.map((agent) => agent.id);

function quoteArg(value: string): string {
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function isDiffrayExecutorId(value: string): value is DiffrayExecutorId {
  return DIFFRAY_EXECUTORS.some((executor) => executor.id === value);
}

export function defaultDiffrayExecutorForAgentType(agentType: AgentType): DiffrayExecutorId {
  if (agentType === 'cursor') return 'cursor-agent-cli';
  if (agentType === 'opencode') return 'opencode-cli';
  if (agentType === 'codex') return 'codex-cli';
  return 'claude-cli';
}

export function allDiffrayAgentIds(): string[] {
  return [...ALL_AGENT_IDS];
}

export function allDiffraySeverities(): DiffraySeverity[] {
  return [...DIFFRAY_SEVERITIES];
}

/**
 * Builds the `diffray review` command for a wizard run. Flags that match defaults
 * (every agent, every severity) are omitted so the command stays short.
 */
export function buildDiffrayReviewCommand(input: DiffrayReviewInput): string {
  const parts = ['diffray', 'review'];

  if (input.scope === 'base-branch' && input.baseRef?.trim()) {
    parts.push('--base', quoteArg(input.baseRef.trim()));
  } else if (input.scope === 'last-commits') {
    const n = Math.max(1, Math.min(50, Math.round(input.commitCount ?? 3)));
    parts.push('--base', `HEAD~${n}`);
  } else if (input.scope === 'files' && input.files && input.files.length > 0) {
    parts.push('--files', quoteArg(input.files.join(',')));
    if (input.fullFiles) parts.push('--full');
  } else if (input.scope === 'codebase' && input.files && input.files.length > 0) {
    // Whole-file review, so no --base here: the CLI rejects --full together with --base.
    parts.push('--files', quoteArg(input.files.join(',')), '--full');
  }

  const selectedAgents = input.agentIds.filter((id) => ALL_AGENT_IDS.includes(id));
  if (selectedAgents.length > 0 && selectedAgents.length < ALL_AGENT_IDS.length) {
    for (const id of selectedAgents) {
      parts.push('--agent', id);
    }
  }

  if (input.executor.trim()) {
    parts.push('--executor', input.executor.trim());
  }

  const model = input.model?.trim();
  if (model) parts.push('--model', quoteArg(model));

  const selectedSeverities = input.severities.filter((severity) =>
    (DIFFRAY_SEVERITIES as readonly string[]).includes(severity),
  );
  if (selectedSeverities.length > 0 && selectedSeverities.length < DIFFRAY_SEVERITIES.length) {
    parts.push('--severity', selectedSeverities.join(','));
  }

  if (input.skipValidation) parts.push('--skip-validation');
  if (input.jsonOutput) parts.push('--json');
  // Streamed progress goes to the same stdout the JSON report is captured from, so it would
  // land in the file and break the parse.
  else if (input.stream) parts.push('--stream');

  return parts.join(' ');
}

/**
 * Numbers the report file per pass, so a multi-pass codebase review does not overwrite
 * itself: `diffray-report.json` becomes `diffray-report-2.json` for the second pass.
 */
export function diffrayJsonFileForPass(fileName: string, pass: number, passCount: number): string {
  const trimmed = fileName.trim() || DIFFRAY_DEFAULT_JSON_FILE;
  const withExtension = /\.json$/i.test(trimmed) ? trimmed : `${trimmed}.json`;
  if (passCount <= 1) return withExtension;
  return withExtension.replace(/\.json$/i, `-${pass}.json`);
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Sends stdout to a file. Windows terminals open Windows PowerShell, where both `>` (UTF-16)
 * and `Out-File -Encoding utf8` (UTF-8 with a BOM) produce a file that JSON parsers choke on,
 * so the report is written through .NET instead.
 */
export function redirectDiffrayCommandToFile(
  command: string,
  filePath: string,
  shell: DiffrayShellKind,
): string {
  if (shell === 'powershell') {
    const target = `(Join-Path $PWD ${quotePowerShellLiteral(filePath)})`;
    return `${command} | Out-String | ForEach-Object { [IO.File]::WriteAllText(${target}, $_) }`;
  }
  return `${command} > ${quoteArg(filePath)}`;
}

export interface DiffrayCommandPlan {
  /** One entry per `diffray review` invocation, in the order they should run. */
  commands: string[];
  /** Report files the run writes, empty unless JSON output is on. */
  reportFiles: string[];
}

/**
 * Plans a run. Every scope but `codebase` is a single command; a codebase review is split into
 * passes so no single invocation drowns the agents (or the shell) in files.
 */
export function planDiffrayReview(
  input: DiffrayReviewInput,
  options: { shell?: DiffrayShellKind; jsonFileName?: string } = {},
): DiffrayCommandPlan {
  const shell = options.shell ?? 'posix';
  const fileName = options.jsonFileName?.trim() || DIFFRAY_DEFAULT_JSON_FILE;
  const batches =
    input.scope === 'codebase'
      ? chunkDiffrayFiles(input.files ?? [], input.filesPerPass)
      : [input.files ?? []];

  const commands: string[] = [];
  const reportFiles: string[] = [];
  batches.forEach((files, index) => {
    const command = buildDiffrayReviewCommand({ ...input, files });
    if (!input.jsonOutput) {
      commands.push(command);
      return;
    }
    const reportFile = diffrayJsonFileForPass(fileName, index + 1, batches.length);
    reportFiles.push(reportFile);
    commands.push(redirectDiffrayCommandToFile(command, reportFile, shell));
  });
  return { commands, reportFiles };
}

/** Chains passes into one line the user can run with a single Enter. */
export function joinDiffrayCommands(commands: readonly string[]): string {
  // `;` rather than `&&`: it works in PowerShell 5.1, pwsh, bash, zsh, and fish alike, and a
  // failed pass should not stop the ones after it.
  return commands.join('; ');
}

export function buildDiffrayProjectConfig(values: ToolSettingsValues): ToolSettingsAction {
  const executor = String(values.executor || 'claude-cli');
  const excludeTests = Boolean(values.excludeTests);
  const config: Record<string, unknown> = {
    executor: isDiffrayExecutorId(executor) ? executor : 'claude-cli',
    concurrency: 6,
  };
  if (excludeTests) {
    config.excludePatterns = [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.js',
      '**/*.spec.js',
      '**/__tests__/**',
      'dist/**',
      'node_modules/**',
    ];
  }
  return {
    kind: 'write-project-file',
    relativePath: DIFFRAY_PROJECT_CONFIG_FILE,
    content: `${JSON.stringify(config, null, 2)}\n`,
  };
}
