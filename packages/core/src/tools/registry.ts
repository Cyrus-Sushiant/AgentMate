import type { SupportedOS } from '../cli/registry.js';
import type { AgentToolDefinition } from './types.js';

/**
 * Curated agent-improvement tools (proxies, plugins, and indexers that reduce token spend or
 * make agents write better code) — distinct from the MCP/skills marketplaces, since none of
 * these are MCP servers or skill packages. Researched from each project's own README as of
 * 2026-07-19; re-check upstream before relying on exact flags, they may have changed since.
 */
export const AGENT_TOOL_REGISTRY: AgentToolDefinition[] = [
  {
    id: '9router',
    name: '9Router',
    description:
      'Proxy that routes coding-agent requests across 40+ model providers with automatic subscription → budget → free-tier fallback, plus RTK-style output compression to cut token spend. Ships a local dashboard for connecting providers and watching quota usage.',
    category: 'Token & Cost Optimization',
    tags: ['proxy', 'cost-saving', 'model-routing'],
    author: 'decolua',
    official: false,
    repositoryUrl: 'https://github.com/decolua/9router',
    installKind: 'shell',
    installCommand: {
      win32: 'npm install -g 9router',
      darwin: 'npm install -g 9router',
      linux: 'npm install -g 9router',
    },
    detectCommand: { command: '9router', args: ['--version'] },
    docker: {
      image: 'decolua/9router:latest',
      containerName: 'agentmate-9router',
      runArgs: ['-p', '20128:20128', '-v', '${HOME}/.9router:/app/data'],
      dashboardUrl: 'http://localhost:20128',
    },
    settingsFields: [
      { key: 'port', label: 'Dashboard port', type: 'text', defaultValue: '20128' },
      {
        key: 'initialPassword',
        label: 'Initial dashboard password',
        type: 'text',
        defaultValue: '123456',
        description: 'Change this after first login — 123456 is the published default.',
      },
    ],
    settingsScope: 'global',
    buildSettingsAction: (values) => ({
      kind: 'command',
      command:
        `docker run -d --name agentmate-9router -p ${values.port}:20128 ` +
        `-e INITIAL_PASSWORD=${values.initialPassword} -v \${HOME}/.9router:/app/data decolua/9router:latest`,
      cwd: 'none',
    }),
  },
  {
    id: 'ponytail',
    name: 'Ponytail',
    description:
      'Coding-agent plugin that enforces a "necessity → reuse → stdlib → one-liner" decision ladder so agents write minimal code instead of over-engineering, while never skipping validation, error handling, security, or accessibility.',
    category: 'Agent Behavior & Prompting',
    tags: ['prompting', 'code-minimalism', 'plugin'],
    author: 'DietrichGebert',
    official: false,
    repositoryUrl: 'https://github.com/DietrichGebert/ponytail',
    installKind: 'manual',
    manualInstallInstructions:
      '/plugin marketplace add DietrichGebert/ponytail\n/plugin install ponytail@ponytail',
    settingsFields: [
      {
        key: 'mode',
        label: 'Intensity',
        type: 'select',
        options: [
          { value: 'lite', label: 'Lite' },
          { value: 'full', label: 'Full' },
          { value: 'ultra', label: 'Ultra' },
          { value: 'off', label: 'Off' },
        ],
        defaultValue: 'full',
      },
    ],
    settingsScope: 'global',
    buildSettingsAction: (values) => ({
      kind: 'copy-text',
      content: JSON.stringify({ mode: values.mode }, null, 2),
      instructions: 'Save as ~/.config/ponytail/config.json (all platforms).',
    }),
  },
  {
    id: 'rtk',
    name: 'RTK (Rust Token Killer)',
    description:
      'Rust CLI proxy that transparently compresses git/npm/grep/etc. command output before it reaches the model context, cutting agent token usage 60-90% with zero workflow changes.',
    category: 'Token & Cost Optimization',
    tags: ['proxy', 'cost-saving', 'cli'],
    author: 'rtk-ai',
    official: false,
    websiteUrl: 'https://www.rtk-ai.app/',
    repositoryUrl: 'https://github.com/rtk-ai/rtk',
    installKind: 'shell',
    installCommand: {
      darwin: 'brew install rtk',
      linux: 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh',
      win32: 'cargo install --git https://github.com/rtk-ai/rtk',
    },
    detectCommand: { command: 'rtk', args: ['--version'] },
    settingsFields: [
      {
        key: 'agent',
        label: 'Target agent',
        type: 'select',
        options: [
          { value: 'claude-code', label: 'Claude Code (default)' },
          { value: 'copilot', label: 'GitHub Copilot' },
          { value: 'gemini', label: 'Gemini CLI' },
          { value: 'codex', label: 'Codex (OpenAI)' },
          { value: 'opencode', label: 'OpenCode' },
          { value: 'cursor', label: 'Cursor' },
          { value: 'windsurf', label: 'Windsurf' },
          { value: 'cline', label: 'Cline / Roo Code' },
          { value: 'kilocode', label: 'Kilo Code' },
          { value: 'antigravity', label: 'Google Antigravity' },
          { value: 'pi', label: 'Pi' },
          { value: 'hermes', label: 'Hermes' },
          { value: 'droid', label: 'Factory Droid' },
        ],
        defaultValue: 'claude-code',
      },
      { key: 'global', label: 'Install globally (-g)', type: 'boolean', defaultValue: true },
      {
        key: 'autoPatch',
        label: 'Non-interactive (--auto-patch)',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'hookOnly',
        label: 'Hook only, skip RTK.md (--hook-only)',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    settingsScope: 'project',
    buildSettingsAction: (values) => {
      const flagByAgent: Record<string, string> = {
        'claude-code': '',
        copilot: ' --copilot',
        gemini: ' --gemini',
        codex: ' --codex',
        opencode: ' --opencode',
        cursor: ' --agent cursor',
        windsurf: ' --agent windsurf',
        cline: ' --agent cline',
        kilocode: ' --agent kilocode',
        antigravity: ' --agent antigravity',
        pi: ' --agent pi',
        hermes: ' --agent hermes',
        droid: ' --agent droid',
      };
      let command = 'rtk init';
      if (values.global) command += ' -g';
      command += flagByAgent[String(values.agent)] ?? '';
      if (values.autoPatch) command += ' --auto-patch';
      if (values.hookOnly) command += ' --hook-only';
      return { kind: 'command', command, cwd: 'project' };
    },
  },
  {
    id: 'codegraph',
    name: 'CodeGraph',
    description:
      'Pre-indexed local code knowledge graph (tree-sitter + SQLite) that answers agent architecture questions — symbol search, call-path tracing, blast-radius impact — in one query instead of repeated grep/read calls, auto-syncing on every file change.',
    category: 'Code Intelligence',
    tags: ['mcp', 'code-indexing', 'context-efficiency'],
    author: 'colbymchenry',
    official: false,
    repositoryUrl: 'https://github.com/colbymchenry/codegraph',
    installKind: 'shell',
    installCommand: {
      win32: 'npm i -g @colbymchenry/codegraph && codegraph install',
      darwin: 'npm i -g @colbymchenry/codegraph && codegraph install',
      linux: 'npm i -g @colbymchenry/codegraph && codegraph install',
    },
    detectCommand: { command: 'codegraph', args: ['--version'] },
    quickActions: [
      {
        id: 'init',
        label: 'Initialize in project',
        action: { kind: 'command', command: 'codegraph init', cwd: 'project' },
      },
    ],
    settingsFields: [
      {
        key: 'exclude',
        label: 'Extra exclude globs (comma-separated)',
        type: 'text',
        defaultValue: '',
      },
      {
        key: 'include',
        label: 'Force-include globs (comma-separated)',
        type: 'text',
        defaultValue: '',
      },
    ],
    settingsScope: 'project',
    buildSettingsAction: (values) => {
      const toGlobs = (raw: string | boolean): string[] =>
        String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      const exclude = toGlobs(values.exclude);
      const include = toGlobs(values.include);
      return {
        kind: 'write-project-file',
        relativePath: 'codegraph.json',
        content: JSON.stringify({ ...(exclude.length && { exclude }), ...(include.length && { include }) }, null, 2),
      };
    },
  },
];

export function getAgentToolDefinition(id: string): AgentToolDefinition | undefined {
  return AGENT_TOOL_REGISTRY.find((tool) => tool.id === id);
}

export function getToolInstallCommandForCurrentOS(
  tool: AgentToolDefinition,
  platform: SupportedOS,
): string | null {
  return tool.installCommand?.[platform] ?? null;
}

export function getDockerRunCommand(tool: AgentToolDefinition): string | null {
  if (!tool.docker) return null;
  return `docker run -d --name ${tool.docker.containerName} ${tool.docker.runArgs.join(' ')} ${tool.docker.image}`;
}

export function getDockerStartCommand(tool: AgentToolDefinition): string | null {
  if (!tool.docker) return null;
  return `docker start ${tool.docker.containerName}`;
}

export function getDockerStopCommand(tool: AgentToolDefinition): string | null {
  if (!tool.docker) return null;
  return `docker stop ${tool.docker.containerName}`;
}

export function getDockerResetCommand(tool: AgentToolDefinition): string | null {
  if (!tool.docker) return null;
  const runCommand = getDockerRunCommand(tool);
  if (!runCommand) return null;
  return `docker rm -f ${tool.docker.containerName} && ${runCommand}`;
}
