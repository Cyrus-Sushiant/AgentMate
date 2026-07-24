import type { SupportedOS } from '../cli/registry.js';
import type { AgentToolDefinition } from './types.js';

/**
 * Curated agent-improvement tools (proxies, plugins, and indexers that reduce token spend or
 * make agents write better code) — distinct from the MCP/skills marketplaces, since none of
 * these are MCP servers or skill packages. Researched from each project's own README/docs as of
 * 2026-07-19 (OpenClaw and Hermes: 2026-07-24); re-check upstream before relying on exact flags,
 * they may have changed since.
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
    uninstallCommand: {
      win32: 'npm uninstall -g 9router',
      darwin: 'npm uninstall -g 9router',
      linux: 'npm uninstall -g 9router',
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
    installKind: 'interactive',
    interactiveInstall: {
      launchCommand: { win32: 'claude', darwin: 'claude', linux: 'claude' },
      pasteCommands:
        '/plugin marketplace add DietrichGebert/ponytail\n/plugin install ponytail@ponytail',
    },
    manualUninstallInstructions: '/plugin uninstall ponytail@ponytail',
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
    // `rtk init -g --uninstall` removes the agent hook — the part that actually affects agent
    // behavior — on every OS; also uninstalling the binary itself is OS-specific (brew/cargo)
    // and left to the user, since we don't know which install method they used.
    uninstallCommand: {
      win32: 'rtk init -g --uninstall',
      darwin: 'rtk init -g --uninstall',
      linux: 'rtk init -g --uninstall',
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
    uninstallCommand: {
      win32: 'codegraph uninstall',
      darwin: 'codegraph uninstall',
      linux: 'codegraph uninstall',
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
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description:
      'Self-hosted personal AI assistant gateway that runs on your own machine and answers from a multi-channel inbox (WhatsApp, Telegram, Slack, Discord, and more), with voice, a live Canvas view, and a local web UI on port 18789.',
    category: 'Agent Runtimes & Gateways',
    tags: ['gateway', 'self-hosted', 'multi-channel', 'docker'],
    author: 'openclaw',
    official: false,
    repositoryUrl: 'https://github.com/openclaw/openclaw',
    installKind: 'shell',
    installCommand: {
      win32: 'npm install -g openclaw@latest',
      darwin: 'npm install -g openclaw@latest',
      linux: 'npm install -g openclaw@latest',
    },
    uninstallCommand: {
      win32: 'npm uninstall -g openclaw',
      darwin: 'npm uninstall -g openclaw',
      linux: 'npm uninstall -g openclaw',
    },
    detectCommand: { command: 'openclaw', args: ['--version'] },
    docker: {
      image: 'ghcr.io/openclaw/openclaw:latest',
      containerName: 'agentmate-openclaw',
      // Config and the auth-profile secrets live in separate dirs inside the image; both have to
      // be bind-mounted or the gateway re-onboards (and loses channel logins) on every recreate.
      runArgs: [
        '-p',
        '18789:18789',
        '-v',
        '${HOME}/.openclaw:/home/node/.openclaw',
        '-v',
        '${HOME}/.config/openclaw:/home/node/.config/openclaw',
      ],
      dashboardUrl: 'http://127.0.0.1:18789/',
    },
    quickActions: [
      {
        id: 'gateway',
        label: 'Start gateway (foreground)',
        action: { kind: 'command', command: 'openclaw gateway --port 18789 --verbose', cwd: 'none' },
      },
    ],
    settingsFields: [
      { key: 'port', label: 'Gateway port', type: 'text', defaultValue: '18789' },
      {
        key: 'gatewayToken',
        label: 'Gateway token',
        type: 'text',
        defaultValue: '',
        description:
          'Shared secret the web UI and clients authenticate with. Leave blank to let OpenClaw generate one on first run.',
      },
      {
        key: 'sandbox',
        label: 'Sandbox agent runs (mounts the Docker socket)',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    settingsScope: 'global',
    buildSettingsAction: (values) => {
      const token = String(values.gatewayToken).trim();
      const sandbox = values.sandbox
        ? ' -e OPENCLAW_SANDBOX=1 -v /var/run/docker.sock:/var/run/docker.sock'
        : '';
      return {
        kind: 'command',
        command:
          `docker run -d --name agentmate-openclaw -p ${values.port}:18789 ` +
          (token ? `-e OPENCLAW_GATEWAY_TOKEN=${token} ` : '') +
          '-v ${HOME}/.openclaw:/home/node/.openclaw ' +
          '-v ${HOME}/.config/openclaw:/home/node/.config/openclaw' +
          `${sandbox} ghcr.io/openclaw/openclaw:latest`,
        cwd: 'none',
      };
    },
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    description:
      'Self-improving agent from Nous Research that writes its own skills, keeps memory across sessions, and exposes an OpenAI-compatible gateway plus an optional web dashboard. Runs work on local, Docker, SSH, Modal, or Daytona backends.',
    category: 'Agent Runtimes & Gateways',
    tags: ['agent', 'self-hosted', 'skills', 'docker'],
    author: 'Nous Research',
    official: false,
    websiteUrl: 'https://hermes-agent.nousresearch.com',
    repositoryUrl: 'https://github.com/NousResearch/hermes-agent',
    installKind: 'shell',
    installCommand: {
      // The desktop terminal is PowerShell on Windows, so the PS installer runs as-is.
      win32: 'irm https://hermes-agent.nousresearch.com/install.ps1 | iex',
      darwin: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
      linux: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
    },
    // Without --full this keeps ~/.hermes (config, skills, memories); the user can rerun with
    // --full themselves if they want the data gone too.
    uninstallCommand: {
      win32: 'hermes uninstall --yes',
      darwin: 'hermes uninstall --yes',
      linux: 'hermes uninstall --yes',
    },
    detectCommand: { command: 'hermes', args: ['--version'] },
    docker: {
      image: 'nousresearch/hermes-agent:latest',
      containerName: 'agentmate-hermes',
      runArgs: [
        '-p',
        '8642:8642',
        '-p',
        '9119:9119',
        '-e',
        'HERMES_DASHBOARD=1',
        '-v',
        '${HOME}/.hermes:/opt/data',
      ],
      imageArgs: ['gateway', 'run'],
      dashboardUrl: 'http://localhost:9119',
    },
    quickActions: [
      {
        id: 'setup',
        label: 'Run setup wizard',
        action: { kind: 'command', command: 'hermes setup', cwd: 'none' },
      },
      {
        id: 'doctor',
        label: 'Diagnose and fix',
        action: { kind: 'command', command: 'hermes doctor --fix', cwd: 'none' },
      },
    ],
    settingsFields: [
      { key: 'gatewayPort', label: 'Gateway port (OpenAI-compatible API)', type: 'text', defaultValue: '8642' },
      { key: 'dashboard', label: 'Enable web dashboard', type: 'boolean', defaultValue: true },
      { key: 'dashboardPort', label: 'Dashboard port', type: 'text', defaultValue: '9119' },
    ],
    settingsScope: 'global',
    buildSettingsAction: (values) => {
      const dashboard = values.dashboard
        ? `-p ${values.dashboardPort}:9119 -e HERMES_DASHBOARD=1 `
        : '';
      return {
        kind: 'command',
        command:
          `docker run -d --name agentmate-hermes --restart unless-stopped ` +
          `-p ${values.gatewayPort}:8642 ${dashboard}` +
          '-v ${HOME}/.hermes:/opt/data nousresearch/hermes-agent:latest gateway run',
        cwd: 'none',
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

export function getToolUninstallCommandForCurrentOS(
  tool: AgentToolDefinition,
  platform: SupportedOS,
): string | null {
  return tool.uninstallCommand?.[platform] ?? null;
}

export function getInteractiveLaunchCommandForCurrentOS(
  tool: AgentToolDefinition,
  platform: SupportedOS,
): string | null {
  return tool.interactiveInstall?.launchCommand[platform] ?? null;
}

export function getDockerRunCommand(tool: AgentToolDefinition): string | null {
  if (!tool.docker) return null;
  const imageArgs = tool.docker.imageArgs?.length ? ` ${tool.docker.imageArgs.join(' ')}` : '';
  return `docker run -d --name ${tool.docker.containerName} ${tool.docker.runArgs.join(' ')} ${tool.docker.image}${imageArgs}`;
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

/** Deletes the container outright — unlike reset, doesn't recreate it. */
export function getDockerRemoveCommand(tool: AgentToolDefinition): string | null {
  if (!tool.docker) return null;
  return `docker rm -f ${tool.docker.containerName}`;
}
