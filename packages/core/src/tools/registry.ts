import type { SupportedOS } from '../cli/registry.js';
import {
  LANGUAGETOOL_DOWNLOAD_URL,
  LANGUAGETOOL_REPOSITORY_URL,
  LANGUAGETOOL_TOOL_ID,
  LANGUAGETOOL_WEBSITE_URL,
} from '../grammar/languagetool.js';
import {
  buildDiffrayProjectConfig,
  DIFFRAY_EXECUTORS,
  DIFFRAY_REPOSITORY_URL,
  DIFFRAY_TOOL_ID,
  DIFFRAY_WEBSITE_URL,
} from './diffray.js';
import type { AgentToolDefinition } from './types.js';

/**
 * Curated agent-improvement tools (proxies, plugins, and indexers that reduce token spend or
 * make agents write better code), distinct from the MCP/skills marketplaces, since none of
 * these are MCP servers or skill packages. Researched from each project's own README/docs as of
 * 2026-07-19 (OpenClaw and Hermes: 2026-07-24); re-check upstream before relying on exact flags,
 * they may have changed since.
 */
/** Shared so the Tools page tab and the six scanner entries can never drift apart. */
export const SECURITY_TOOL_CATEGORY = 'Security & Code Scanning';

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
    updateCommand: {
      win32: 'npm install -g 9router@latest',
      darwin: 'npm install -g 9router@latest',
      linux: 'npm install -g 9router@latest',
    },
    updateCheck: { type: 'npm', package: '9router' },
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
        description: 'Change this after first login; 123456 is the published default.',
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
      linux:
        'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh',
      win32: 'cargo install --git https://github.com/rtk-ai/rtk',
    },
    // brew/cargo have their own upgrade verbs, and the Linux installer script is
    // idempotent, so re-running it upgrades in place.
    updateCommand: {
      darwin: 'brew upgrade rtk',
      linux:
        'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh',
      win32: 'cargo install --git https://github.com/rtk-ai/rtk --force',
    },
    updateCheck: { type: 'github-release', package: 'rtk-ai/rtk' },
    // `rtk init -g --uninstall` removes the agent hook (the part that actually affects agent
    // behavior) on every OS; also uninstalling the binary itself is OS-specific (brew/cargo)
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
      'Pre-indexes your codebase into a local knowledge graph (tree-sitter + SQLite), so symbol search, call-path tracing, and blast-radius checks are one query instead of a pile of grep/read calls. Re-syncs automatically on every file change.',
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
    // `codegraph install` re-registers the MCP server, which the new build may have changed.
    updateCommand: {
      win32: 'npm i -g @colbymchenry/codegraph@latest && codegraph install',
      darwin: 'npm i -g @colbymchenry/codegraph@latest && codegraph install',
      linux: 'npm i -g @colbymchenry/codegraph@latest && codegraph install',
    },
    updateCheck: { type: 'npm', package: '@colbymchenry/codegraph' },
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
        content: JSON.stringify(
          { ...(exclude.length && { exclude }), ...(include.length && { include }) },
          null,
          2,
        ),
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
    // installCommand already pins @latest, so it doubles as the update command.
    updateCheck: { type: 'npm', package: 'openclaw' },
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
        action: {
          kind: 'command',
          command: 'openclaw gateway --port 18789 --verbose',
          cwd: 'none',
        },
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
    // The install script upgrades an existing install in place, so it doubles as the
    // update command.
    updateCheck: { type: 'github-release', package: 'NousResearch/hermes-agent' },
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
      {
        key: 'gatewayPort',
        label: 'Gateway port (OpenAI-compatible API)',
        type: 'text',
        defaultValue: '8642',
      },
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
  {
    id: DIFFRAY_TOOL_ID,
    name: 'diffray',
    description:
      'Free multi-agent code review CLI. Specialized agents (bugs, security, performance, consistency) review git diffs locally with Claude Code, Cursor Agent, OpenCode, or Codex. After install, each project gets a review wizard. Hosted PR reviews live at diffray.ai.',
    category: 'Code Intelligence',
    tags: ['code-review', 'multi-agent', 'cli'],
    author: 'diffray',
    official: false,
    websiteUrl: DIFFRAY_WEBSITE_URL,
    repositoryUrl: DIFFRAY_REPOSITORY_URL,
    installKind: 'shell',
    installCommand: {
      win32: 'npm install -g diffray',
      darwin: 'npm install -g diffray',
      linux: 'npm install -g diffray',
    },
    updateCommand: {
      win32: 'npm install -g diffray@latest',
      darwin: 'npm install -g diffray@latest',
      linux: 'npm install -g diffray@latest',
    },
    updateCheck: { type: 'npm', package: 'diffray' },
    uninstallCommand: {
      win32: 'npm uninstall -g diffray',
      darwin: 'npm uninstall -g diffray',
      linux: 'npm uninstall -g diffray',
    },
    detectCommand: { command: 'diffray', args: ['--version'] },
    quickActions: [
      {
        id: 'init',
        label: 'Initialize in project',
        action: { kind: 'command', command: 'diffray config init', cwd: 'project' },
      },
      {
        id: 'setup-command',
        label: 'Install /diffray slash command',
        action: { kind: 'command', command: 'diffray setup-command', cwd: 'none' },
      },
    ],
    settingsFields: [
      {
        key: 'executor',
        label: 'Review executor',
        type: 'select',
        options: DIFFRAY_EXECUTORS.map((executor) => ({
          value: executor.id,
          label: executor.label,
        })),
        defaultValue: 'claude-cli',
      },
      {
        key: 'excludeTests',
        label: 'Skip tests and build output',
        type: 'boolean',
        defaultValue: true,
        description: 'Writes excludePatterns for test files, dist, and node_modules.',
      },
    ],
    settingsScope: 'project',
    buildSettingsAction: buildDiffrayProjectConfig,
  },
  {
    id: LANGUAGETOOL_TOOL_ID,
    name: 'LanguageTool',
    description:
      "Grammar, spelling, and style checker behind AgentMate's writing checks. Install it here to run every check offline on this machine instead of sending text to LanguageTool's public API. Needs Java 17 or newer on PATH.",
    category: 'Writing & Docs',
    tags: ['grammar', 'offline', 'java'],
    author: 'LanguageTool',
    official: true,
    websiteUrl: LANGUAGETOOL_WEBSITE_URL,
    repositoryUrl: LANGUAGETOOL_REPOSITORY_URL,
    // No install command: it ships as a zip, and AgentMate runs the server out of
    // its own tools folder rather than installing anything system-wide. The card
    // has its own download/open-folder buttons instead.
    installKind: 'manual',
    manualInstallInstructions: `1. Download ${LANGUAGETOOL_DOWNLOAD_URL}\n2. Extract it into AgentMate's tools folder (the "Open tools folder" button opens it).\n3. Turn on "Use local LanguageTool" in Settings > AI > Writing check.`,
  },
  // --- Security & Code Scanning ---
  // Commands checked against each project's own docs on 2026-08-29. Semgrep has shipped native
  // Windows binaries since its Fall 2025 release, so it no longer needs WSL; Bearer still has no
  // Windows build at all, which is why its win32 path is Docker.
  {
    id: 'semgrep',
    name: 'Semgrep',
    description:
      'Pattern-based static analysis for 30+ languages, with a large community ruleset. Fast enough to run on every project and the best first security scan to reach for. Runs the scan from a project\u2019s Security tab. If the card still says "Not detected" right after installing, pip put the executable in a Scripts folder that is not on your PATH; add it, then press Refresh.',
    category: SECURITY_TOOL_CATEGORY,
    tags: ['sast', 'static-analysis', 'security'],
    author: 'Semgrep',
    official: true,
    websiteUrl: 'https://semgrep.dev',
    repositoryUrl: 'https://github.com/semgrep/semgrep',
    installKind: 'shell',
    installCommand: {
      win32: 'pip install semgrep',
      darwin: 'brew install semgrep',
      linux: 'pip install semgrep',
    },
    updateCommand: {
      win32: 'pip install --upgrade semgrep',
      darwin: 'brew upgrade semgrep',
      linux: 'pip install --upgrade semgrep',
    },
    updateCheck: { type: 'pypi', package: 'semgrep' },
    uninstallCommand: {
      win32: 'pip uninstall -y semgrep',
      darwin: 'brew uninstall semgrep',
      linux: 'pip uninstall -y semgrep',
    },
    detectCommand: { command: 'semgrep', args: ['--version'] },
    settingsFields: [
      {
        key: 'ruleset',
        label: 'Ruleset',
        type: 'select',
        options: [
          { value: 'auto', label: 'Auto (fetches rules from semgrep.dev)' },
          { value: 'p/security-audit', label: 'Security audit' },
          { value: 'p/owasp-top-ten', label: 'OWASP Top 10' },
          { value: 'p/default', label: 'Default' },
        ],
        defaultValue: 'auto',
        description:
          'Auto downloads rules from semgrep.dev on every scan. Pick a p/ pack to stay offline.',
      },
    ],
    settingsScope: 'global',
    buildSettingsAction: (values) => ({
      kind: 'command',
      command: `semgrep scan --config ${values.ruleset} --metrics=off .`,
      cwd: 'project',
    }),
  },
  {
    id: 'trivy',
    name: 'Trivy',
    description:
      'Finds known CVEs in your dependencies, hardcoded secrets, and infrastructure-as-code misconfigurations in one pass. The fastest way to learn a project is shipping a vulnerable package.',
    category: SECURITY_TOOL_CATEGORY,
    tags: ['dependencies', 'cve', 'secrets', 'iac'],
    author: 'Aqua Security',
    official: true,
    websiteUrl: 'https://trivy.dev',
    repositoryUrl: 'https://github.com/aquasecurity/trivy',
    installKind: 'shell',
    installCommand: {
      win32: 'winget install -e --id AquaSecurity.Trivy',
      darwin: 'brew install trivy',
      linux:
        'curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin',
    },
    updateCommand: {
      win32: 'winget upgrade -e --id AquaSecurity.Trivy',
      darwin: 'brew upgrade trivy',
      linux:
        'curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin',
    },
    updateCheck: { type: 'github-release', package: 'aquasecurity/trivy' },
    uninstallCommand: {
      win32: 'winget uninstall -e --id AquaSecurity.Trivy',
      darwin: 'brew uninstall trivy',
      linux: 'sudo rm -f /usr/local/bin/trivy',
    },
    detectCommand: { command: 'trivy', args: ['--version'] },
    quickActions: [
      {
        id: 'trivy-db-update',
        label: 'Update vulnerability DB',
        action: { kind: 'command', command: 'trivy image --download-db-only', cwd: 'none' },
      },
    ],
  },
  {
    id: 'bearer',
    name: 'Bearer',
    description:
      'Data-flow analysis that follows sensitive data (PII, tokens, credentials) through your code and flags where it leaks. Complements pattern scanners rather than repeating them. No native Windows build, so it runs through Docker there.',
    category: SECURITY_TOOL_CATEGORY,
    tags: ['sast', 'privacy', 'data-flow'],
    author: 'Bearer (Cycode)',
    official: true,
    websiteUrl: 'https://docs.bearer.com',
    repositoryUrl: 'https://github.com/bearer/bearer',
    installKind: 'shell',
    installCommand: {
      darwin: 'brew install bearer/tap/bearer',
      linux:
        'curl -sfL https://raw.githubusercontent.com/Bearer/bearer/main/contrib/install.sh | sh -s -- -b /usr/local/bin',
    },
    manualInstallInstructions:
      'Bearer has no native Windows build. Use the Docker option on this card instead: the Security tab runs it as a container with your project mounted read-only, which needs nothing else installed.',
    updateCommand: {
      darwin: 'brew upgrade bearer',
      linux:
        'curl -sfL https://raw.githubusercontent.com/Bearer/bearer/main/contrib/install.sh | sh -s -- -b /usr/local/bin',
    },
    updateCheck: { type: 'github-release', package: 'bearer/bearer' },
    uninstallCommand: {
      darwin: 'brew uninstall bearer',
      linux: 'sudo rm -f /usr/local/bin/bearer',
    },
    detectCommand: { command: 'bearer', args: ['version'] },
    docker: {
      // Not a long-lived container: the Security tab starts one per scan and removes it after.
      // This block exists so the card can pull the image ahead of time and report whether it is
      // already local, since the first pull is around 200 MB.
      image: 'bearer/bearer:latest-amd64',
      containerName: 'agentmate-bearer',
      runArgs: [],
    },
  },
  {
    id: 'sonarqube',
    name: 'SonarQube Community Build',
    description:
      'A self-hosted analysis server that tracks vulnerabilities, security hotspots, and code quality over time. Runs as a Docker container with its own dashboard on port 9000; the Security tab scans into it and pulls the findings back out.',
    category: SECURITY_TOOL_CATEGORY,
    tags: ['sast', 'quality', 'self-hosted', 'docker'],
    author: 'SonarSource',
    official: true,
    websiteUrl: 'https://docs.sonarsource.com/sonarqube-community-build/',
    repositoryUrl: 'https://github.com/SonarSource/sonarqube',
    // The Docker container is the install; there is nothing to put on PATH.
    installKind: 'manual',
    manualInstallInstructions:
      '1. Press "Docker install" on this card to create the server container.\n2. Wait for http://localhost:9000 to come up (the first boot takes a couple of minutes) and log in with admin / admin.\n3. Change the password, then create a token under My Account > Security.\n4. Paste that token into the SonarQube setup in a project\u2019s Security tab.',
    updateCheck: { type: 'github-release', package: 'SonarSource/sonarqube' },
    docker: {
      image: 'sonarqube:community',
      containerName: 'agentmate-sonarqube',
      runArgs: [
        '-p',
        '9000:9000',
        '-v',
        'agentmate-sonarqube-data:/opt/sonarqube/data',
        '-v',
        'agentmate-sonarqube-extensions:/opt/sonarqube/extensions',
        '-v',
        'agentmate-sonarqube-logs:/opt/sonarqube/logs',
      ],
      dashboardUrl: 'http://localhost:9000',
    },
  },
  {
    id: 'codeql',
    name: 'CodeQL CLI',
    description:
      'GitHub\u2019s semantic analysis engine. It builds a queryable database of your code and traces untrusted input all the way to dangerous sinks, so it finds real exploitable paths that pattern matchers miss. Slow, and worth it. Free for open source; check the licence terms for private code.',
    category: SECURITY_TOOL_CATEGORY,
    tags: ['sast', 'dataflow', 'github'],
    author: 'GitHub',
    official: true,
    websiteUrl: 'https://codeql.github.com',
    repositoryUrl: 'https://github.com/github/codeql-cli-binaries',
    installKind: 'shell',
    installCommand: {
      darwin: 'brew install --cask codeql',
    },
    manualInstallInstructions:
      '1. Download the bundle for your platform from https://github.com/github/codeql-cli-binaries/releases/latest\n2. Extract it somewhere permanent, for example C:\\tools\\codeql.\n3. Add that folder to your PATH, then reopen AgentMate and press Refresh on this card.\n\nIf you already have the GitHub CLI, "gh extension install github/gh-codeql" is an alternative, but it installs "gh codeql" rather than a "codeql" binary on PATH, which this card cannot detect.',
    updateCommand: {
      darwin: 'brew upgrade --cask codeql',
    },
    updateCheck: { type: 'github-release', package: 'github/codeql-cli-binaries' },
    uninstallCommand: {
      darwin: 'brew uninstall --cask codeql',
    },
    manualUninstallInstructions: 'Delete the folder you extracted and remove it from your PATH.',
    detectCommand: { command: 'codeql', args: ['version', '--format=terse'] },
  },
  {
    id: 'strix',
    name: 'Strix',
    description:
      'An autonomous AI agent that runs your code in a sandbox and proves vulnerabilities with real working exploits, so what it reports has no false positives. Needs Docker and your own LLM API key, and a run costs tokens. If the card still says "Not detected" right after installing, pip put the executable in a Scripts folder that is not on your PATH; add it, then press Refresh.',
    category: SECURITY_TOOL_CATEGORY,
    tags: ['pentest', 'ai-agent', 'dast'],
    author: 'Strix',
    official: true,
    websiteUrl: 'https://usestrix.com',
    repositoryUrl: 'https://github.com/usestrix/strix',
    installKind: 'shell',
    installCommand: {
      win32: 'pip install strix-agent',
      darwin: 'pip install strix-agent',
      linux: 'pip install strix-agent',
    },
    updateCommand: {
      win32: 'pip install --upgrade strix-agent',
      darwin: 'pip install --upgrade strix-agent',
      linux: 'pip install --upgrade strix-agent',
    },
    updateCheck: { type: 'pypi', package: 'strix-agent' },
    uninstallCommand: {
      win32: 'pip uninstall -y strix-agent',
      darwin: 'pip uninstall -y strix-agent',
      linux: 'pip uninstall -y strix-agent',
    },
    detectCommand: { command: 'strix', args: ['--version'] },
    settingsFields: [
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        defaultValue: 'anthropic/claude-sonnet-5',
        description: 'Passed as STRIX_LLM, in provider/model form.',
      },
      {
        key: 'apiKey',
        label: 'LLM API key',
        type: 'text',
        defaultValue: '',
        description: 'Passed as LLM_API_KEY. Set this in the project Security tab to store it.',
      },
    ],
    settingsScope: 'global',
    buildSettingsAction: (values) => ({
      kind: 'copy-text',
      content: `STRIX_LLM=${values.model}\nLLM_API_KEY=${values.apiKey}`,
      instructions:
        'Set these as environment variables, or store them in a project\u2019s Security tab so AgentMate passes them for you.',
    }),
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

/** Falls back to the install command, which for most tools is what upgrades in place. */
export function getToolUpdateCommandForCurrentOS(
  tool: AgentToolDefinition,
  platform: SupportedOS,
): string | null {
  return tool.updateCommand?.[platform] ?? tool.installCommand?.[platform] ?? null;
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

/** Deletes the container outright; unlike reset, doesn't recreate it. */
export function getDockerRemoveCommand(tool: AgentToolDefinition): string | null {
  if (!tool.docker) return null;
  return `docker rm -f ${tool.docker.containerName}`;
}
