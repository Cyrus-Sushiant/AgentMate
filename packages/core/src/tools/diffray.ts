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

export type DiffrayReviewScope = 'working-tree' | 'base-branch' | 'last-commits' | 'files';

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
  if (input.stream) parts.push('--stream');

  return parts.join(' ');
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
