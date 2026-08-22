import { z } from 'zod';

export const SupportedOSSchema = z.enum(['win32', 'darwin', 'linux']);
export type SupportedOS = z.infer<typeof SupportedOSSchema>;

export const ShellCommandSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
});
export type ShellCommand = z.infer<typeof ShellCommandSchema>;

export const UpdateCheckSourceSchema = z.object({
  type: z.enum(['npm', 'pypi', 'github-release']),
  /** npm/PyPI package name, or "owner/repo" for github-release. */
  package: z.string(),
});
export type UpdateCheckSource = z.infer<typeof UpdateCheckSourceSchema>;

export const CliDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  /**
   * Short name used in every agent picker (Target AI, project agent type, and
   * similar dropdowns) so those lists cannot drift from this registry.
   */
  label: z.string(),
  description: z.string(),
  homepageUrl: z.string().url().optional(),
  docsUrl: z.string().url().optional(),
  executableNames: z.array(z.string()).min(1),
  detectCommand: ShellCommandSchema,
  versionCommand: ShellCommandSchema,
  /**
   * One-shot ("headless") prompt invocation: the agent answers on stdout without
   * opening a TUI. Absent for CLIs that have no non-interactive mode we can rely on.
   */
  promptCommand: ShellCommandSchema.optional(),
  /**
   * How the prompt text reaches `promptCommand`: appended as the final argument
   * (the default), or piped through stdin. Windows routes every npm-installed CLI
   * through cmd.exe, which caps its own command line at ~8191 characters, so a
   * diff-heavy prompt needs the stdin path to avoid "The command line is too long."
   * Only set this for CLIs confirmed to read a piped prompt in headless mode.
   */
  promptInputMode: z.enum(['arg', 'stdin']).optional(),
  /**
   * Extra args that let a headless run actually edit files. Without them these CLIs
   * either stop to ask for approval (which nothing can answer with no TTY) or refuse
   * to write at all. Absent for CLIs that already edit by default in headless mode, and
   * for read-only ones. Only ever added for prompts the user explicitly asked to apply.
   */
  promptWriteArgs: z.array(z.string()).optional(),
  /**
   * Example for the per-CLI "Arguments" field, shown as its placeholder. Each one names
   * a flag this CLI really has (taken from its own --help), since the flag for picking a
   * model differs per CLI: `--model sonnet`, `-m provider/model`, and so on. Absent for
   * CLIs with no obvious flag worth suggesting.
   */
  argsExample: z.string().optional(),
  /** Keyed by SupportedOS; not every OS needs an entry. */
  installCommand: z.record(z.string(), z.string()),
  /** Keyed by SupportedOS; falls back to installCommand when absent. */
  updateCommand: z.record(z.string(), z.string()).optional(),
  /** Where to look up the latest published version, if known. */
  updateCheck: UpdateCheckSourceSchema.optional(),
  supportedOS: z.array(SupportedOSSchema).min(1),
});
export type CliDefinition = z.infer<typeof CliDefinitionSchema>;

export const CLI_REGISTRY: CliDefinition[] = [
  {
    id: 'claude-code',
    name: 'Claude Code CLI',
    label: 'Claude Code',
    description: "Anthropic's agentic coding CLI.",
    homepageUrl: 'https://claude.com/claude-code',
    docsUrl: 'https://docs.claude.com/en/docs/claude-code',
    executableNames: ['claude'],
    detectCommand: { command: 'claude', args: ['--version'] },
    versionCommand: { command: 'claude', args: ['--version'] },
    promptCommand: { command: 'claude', args: ['-p'] },
    promptInputMode: 'stdin',
    promptWriteArgs: ['--permission-mode', 'acceptEdits'],
    argsExample: '--model sonnet',
    installCommand: {
      win32: 'npm install -g @anthropic-ai/claude-code',
      darwin: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code',
    },
    updateCheck: { type: 'npm', package: '@anthropic-ai/claude-code' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    label: 'Gemini',
    description: "Google's Gemini command-line AI agent.",
    homepageUrl: 'https://github.com/google-gemini/gemini-cli',
    executableNames: ['gemini'],
    detectCommand: { command: 'gemini', args: ['--version'] },
    versionCommand: { command: 'gemini', args: ['--version'] },
    promptCommand: { command: 'gemini', args: ['-p'] },
    promptInputMode: 'stdin',
    promptWriteArgs: ['--yolo'],
    argsExample: '-m gemini-2.5-pro',
    installCommand: {
      win32: 'npm install -g @google/gemini-cli',
      darwin: 'npm install -g @google/gemini-cli',
      linux: 'npm install -g @google/gemini-cli',
    },
    updateCheck: { type: 'npm', package: '@google/gemini-cli' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    label: 'OpenCode',
    description: 'Open-source AI coding agent for the terminal.',
    homepageUrl: 'https://opencode.ai',
    executableNames: ['opencode'],
    detectCommand: { command: 'opencode', args: ['--version'] },
    versionCommand: { command: 'opencode', args: ['--version'] },
    // `opencode run` reads a piped prompt; stdin avoids Windows cmd.exe's ~8191-char limit.
    promptCommand: { command: 'opencode', args: ['run'] },
    promptInputMode: 'stdin',
    // `--auto` is a `run` flag, so it must follow `run` in argv (see headlessPrompt write-arg order).
    promptWriteArgs: ['--auto'],
    argsExample: '--model anthropic/claude-sonnet-4-5',
    installCommand: {
      win32: 'npm install -g opencode-ai@latest',
      darwin: 'npm install -g opencode-ai@latest',
      linux: 'npm install -g opencode-ai@latest',
    },
    updateCheck: { type: 'npm', package: 'opencode-ai' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'openclaude',
    name: 'OpenClaude',
    label: 'OpenClaude',
    description: 'Open-source coding agent CLI that runs against any model provider.',
    homepageUrl: 'https://openclaude.gitlawb.com',
    docsUrl: 'https://openclaude.gitlawb.com/docs/cli-reference/',
    executableNames: ['openclaude'],
    detectCommand: { command: 'openclaude', args: ['--version'] },
    versionCommand: { command: 'openclaude', args: ['--version'] },
    // `-p/--print` is a boolean flag that answers and exits, and it reads a piped prompt,
    // which keeps diff-heavy prompts off Windows' ~8191-char cmd.exe line.
    promptCommand: { command: 'openclaude', args: ['-p'] },
    promptInputMode: 'stdin',
    promptWriteArgs: ['--permission-mode', 'acceptEdits'],
    argsExample: '--model sonnet',
    installCommand: {
      win32: 'npm install -g @gitlawb/openclaude@latest',
      darwin: 'npm install -g @gitlawb/openclaude@latest',
      linux: 'npm install -g @gitlawb/openclaude@latest',
    },
    updateCheck: { type: 'npm', package: '@gitlawb/openclaude' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    label: 'Codex',
    description: "OpenAI's local coding agent CLI.",
    homepageUrl: 'https://github.com/openai/codex',
    executableNames: ['codex'],
    detectCommand: { command: 'codex', args: ['--version'] },
    versionCommand: { command: 'codex', args: ['--version'] },
    promptCommand: { command: 'codex', args: ['exec'] },
    promptInputMode: 'stdin',
    // `--full-auto` only exists on the interactive `codex` command; `codex exec` rejects it
    // ("unexpected argument '--full-auto'"). The exec equivalent is the sandbox policy, and
    // exec never prompts for approvals anyway.
    promptWriteArgs: ['--sandbox', 'workspace-write'],
    argsExample: '--model gpt-5-codex',
    installCommand: {
      win32: 'npm install -g @openai/codex',
      darwin: 'npm install -g @openai/codex',
      linux: 'npm install -g @openai/codex',
    },
    updateCheck: { type: 'npm', package: '@openai/codex' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'grok-cli',
    name: 'Grok CLI',
    label: 'Grok',
    description: "xAI's official Grok coding agent CLI.",
    homepageUrl: 'https://x.ai',
    docsUrl: 'https://docs.x.ai/build/overview',
    executableNames: ['grok'],
    detectCommand: { command: 'grok', args: ['--version'] },
    versionCommand: { command: 'grok', args: ['--version'] },
    // Grok's headless flag is `-p/--single <PROMPT>`; it takes the prompt as the flag's
    // value, so there is no stdin path (`grok -p` with a piped prompt errors on the
    // missing value).
    promptCommand: { command: 'grok', args: ['-p'] },
    promptWriteArgs: ['--permission-mode', 'acceptEdits'],
    argsExample: '--model grok-4',
    installCommand: {
      win32: 'npm install -g @xai-official/grok',
      darwin: 'npm install -g @xai-official/grok',
      linux: 'npm install -g @xai-official/grok',
    },
    updateCheck: { type: 'npm', package: '@xai-official/grok' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'cursor-cli',
    name: 'Cursor CLI',
    label: 'Cursor',
    description: "Cursor's agentic coding CLI for the terminal.",
    homepageUrl: 'https://cursor.com/cli',
    docsUrl: 'https://cursor.com/docs/cli/overview',
    executableNames: ['cursor-agent'],
    detectCommand: { command: 'cursor-agent', args: ['--version'] },
    versionCommand: { command: 'cursor-agent', args: ['--version'] },
    promptCommand: { command: 'cursor-agent', args: ['-p'] },
    promptWriteArgs: ['--force'],
    argsExample: '--model sonnet-4-thinking',
    installCommand: {
      win32: "irm 'https://cursor.com/install?win32=true' | iex",
      darwin: 'curl https://cursor.com/install -fsS | bash',
      linux: 'curl https://cursor.com/install -fsS | bash',
    },
    // The CLI ships its own self-updater; re-running the install script would work too, but
    // this is the documented path and avoids re-downloading the whole installer.
    updateCommand: {
      win32: 'cursor-agent update',
      darwin: 'cursor-agent update',
      linux: 'cursor-agent update',
    },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'copilot-cli',
    name: 'GitHub Copilot CLI',
    label: 'Copilot',
    description: "GitHub's Copilot coding agent in the terminal.",
    homepageUrl: 'https://github.com/features/copilot/cli',
    docsUrl: 'https://docs.github.com/en/copilot/how-tos/copilot-cli',
    executableNames: ['copilot'],
    detectCommand: { command: 'copilot', args: ['--version'] },
    versionCommand: { command: 'copilot', args: ['--version'] },
    // Copilot ignores piped input whenever `-p/--prompt` is also passed, so the stdin path
    // deliberately leaves the prompt flag off and lets the pipe carry the prompt. `-s`
    // suppresses the session banner and stats, leaving only the answer on stdout.
    promptCommand: { command: 'copilot', args: ['-s'] },
    promptInputMode: 'stdin',
    promptWriteArgs: ['--allow-all-tools'],
    argsExample: '--model claude-sonnet-4.5',
    installCommand: {
      win32: 'npm install -g @github/copilot',
      darwin: 'npm install -g @github/copilot',
      linux: 'npm install -g @github/copilot',
    },
    updateCheck: { type: 'npm', package: '@github/copilot' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'freebuff-cli',
    name: 'FreeBuff CLI',
    label: 'FreeBuff',
    description: 'Free, ad-supported AI coding agent for the terminal.',
    homepageUrl: 'https://freebuff.com',
    docsUrl: 'https://freebuff.com/get-started',
    executableNames: ['freebuff'],
    detectCommand: { command: 'freebuff', args: ['--version'] },
    versionCommand: { command: 'freebuff', args: ['--version'] },
    argsExample: '--continue',
    installCommand: {
      win32: 'npm install -g freebuff',
      darwin: 'npm install -g freebuff',
      linux: 'npm install -g freebuff',
    },
    updateCheck: { type: 'npm', package: 'freebuff' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'qwen-cli',
    name: 'Qwen CLI',
    label: 'Qwen',
    description: "Alibaba's Qwen Code command-line AI agent.",
    homepageUrl: 'https://github.com/QwenLM/qwen-code',
    executableNames: ['qwen'],
    detectCommand: { command: 'qwen', args: ['--version'] },
    versionCommand: { command: 'qwen', args: ['--version'] },
    promptCommand: { command: 'qwen', args: ['-p'] },
    promptInputMode: 'stdin',
    promptWriteArgs: ['--yolo'],
    argsExample: '-m qwen3-coder-plus',
    installCommand: {
      win32: 'npm install -g @qwen-code/qwen-code',
      darwin: 'npm install -g @qwen-code/qwen-code',
      linux: 'npm install -g @qwen-code/qwen-code',
    },
    updateCheck: { type: 'npm', package: '@qwen-code/qwen-code' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'aider',
    name: 'Aider',
    label: 'Aider',
    description: 'AI pair programming CLI that edits code in your local git repo.',
    homepageUrl: 'https://aider.chat',
    executableNames: ['aider'],
    detectCommand: { command: 'aider', args: ['--version'] },
    versionCommand: { command: 'aider', args: ['--version'] },
    argsExample: '--model sonnet',
    installCommand: {
      win32: 'pipx install aider-chat',
      darwin: 'pipx install aider-chat',
      linux: 'pipx install aider-chat',
    },
    updateCommand: {
      win32: 'pipx upgrade aider-chat',
      darwin: 'pipx upgrade aider-chat',
      linux: 'pipx upgrade aider-chat',
    },
    updateCheck: { type: 'pypi', package: 'aider-chat' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'goose',
    name: 'Goose',
    label: 'Goose',
    description: "Block's on-machine AI agent CLI.",
    homepageUrl: 'https://github.com/block/goose',
    executableNames: ['goose'],
    detectCommand: { command: 'goose', args: ['--version'] },
    versionCommand: { command: 'goose', args: ['--version'] },
    promptCommand: { command: 'goose', args: ['run', '-t'] },
    installCommand: {
      darwin:
        'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash',
      linux:
        'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash',
    },
    // `goose update` is the built-in self-updater, faster and more reliable than re-running
    // the install script.
    updateCommand: {
      darwin: 'goose update',
      linux: 'goose update',
    },
    updateCheck: { type: 'github-release', package: 'block/goose' },
    supportedOS: ['darwin', 'linux'],
  },
  {
    id: 'cline-cli',
    name: 'Cline CLI',
    label: 'Cline',
    description: 'Autonomous coding agent CLI from the Cline team.',
    homepageUrl: 'https://cline.bot/cli',
    docsUrl: 'https://docs.cline.bot/cli/cli-reference',
    executableNames: ['cline'],
    detectCommand: { command: 'cline', args: ['--version'] },
    versionCommand: { command: 'cline', args: ['--version'] },
    promptCommand: { command: 'cline', args: ['-y'] },
    argsExample: '--model claude-sonnet-4-5',
    installCommand: {
      win32: 'npm install -g cline',
      darwin: 'npm install -g cline',
      linux: 'npm install -g cline',
    },
    updateCheck: { type: 'npm', package: 'cline' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'continue-cli',
    name: 'Continue CLI',
    label: 'Continue',
    description: 'Open-source AI coding assistant CLI ("cn").',
    homepageUrl: 'https://continue.dev',
    executableNames: ['cn'],
    detectCommand: { command: 'cn', args: ['--version'] },
    versionCommand: { command: 'cn', args: ['--version'] },
    promptCommand: { command: 'cn', args: ['-p'] },
    argsExample: '--model owner/package',
    installCommand: {
      win32: 'npm install -g @continuedev/cli',
      darwin: 'npm install -g @continuedev/cli',
      linux: 'npm install -g @continuedev/cli',
    },
    updateCheck: { type: 'npm', package: '@continuedev/cli' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'pi',
    name: 'Pi',
    label: 'Pi',
    description: 'Minimal, extensible terminal coding agent.',
    homepageUrl: 'https://pi.dev',
    docsUrl: 'https://pi.dev/docs',
    executableNames: ['pi'],
    detectCommand: { command: 'pi', args: ['--version'] },
    versionCommand: { command: 'pi', args: ['--version'] },
    // `pi -p` prints the answer and exits. Print mode also merges piped stdin into the
    // prompt, which keeps diff-heavy prompts off Windows' ~8191-char cmd.exe line.
    promptCommand: { command: 'pi', args: ['-p'] },
    promptInputMode: 'stdin',
    // No promptWriteArgs: pi has no permission popups, so its write/edit/bash tools run
    // as-is, and the project trust prompt never appears in non-interactive mode.
    argsExample: '--model sonnet',
    // `--ignore-scripts` is what pi's own install docs recommend; it needs no lifecycle scripts.
    installCommand: {
      win32: 'npm install -g --ignore-scripts @earendil-works/pi-coding-agent',
      darwin: 'npm install -g --ignore-scripts @earendil-works/pi-coding-agent',
      linux: 'npm install -g --ignore-scripts @earendil-works/pi-coding-agent',
    },
    // No updateCommand: `pi update --self` only acts on installs it detects as globally
    // package-managed and writable, so re-running the npm install is the reliable path.
    updateCheck: { type: 'npm', package: '@earendil-works/pi-coding-agent' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
];

export function getCliDefinition(id: string): CliDefinition | undefined {
  return CLI_REGISTRY.find((cli) => cli.id === id);
}

/**
 * Prompt Builder / Target AI values. Same order and names as CLI_REGISTRY, so a
 * new CLI shows up in every picker without a second handwritten list.
 */
export const TARGET_AIS: readonly string[] = CLI_REGISTRY.map((cli) => cli.label);
export type TargetAI = (typeof TARGET_AIS)[number];
export const DEFAULT_TARGET_AI: TargetAI = CLI_REGISTRY[0]?.label ?? 'Claude Code';

/** Prompt Builder used to store "Claude" before the label matched Claude Code. */
const LEGACY_TARGET_AI_LABELS: Record<string, string> = {
  Claude: 'Claude Code',
};

/** Map a stored Target AI string (current label, legacy label, or CLI id) onto today's label. */
export function normalizeTargetAI(value: string): string {
  const mapped = LEGACY_TARGET_AI_LABELS[value] ?? value;
  const byLabel = CLI_REGISTRY.find((cli) => cli.label === mapped);
  if (byLabel) return byLabel.label;
  const byId = getCliDefinition(mapped);
  if (byId) return byId.label;
  return mapped;
}

export function isTargetAI(value: string): boolean {
  return TARGET_AIS.includes(normalizeTargetAI(value));
}

export function cliIdForTargetAI(targetAI: string): string | undefined {
  const normalized = normalizeTargetAI(targetAI);
  return CLI_REGISTRY.find((cli) => cli.label === normalized || cli.id === targetAI)?.id;
}

export function targetAIForCliId(cliId: string): string | undefined {
  return getCliDefinition(cliId)?.label;
}

/**
 * Pick the Target AI for a prompt form. Prefers an explicit stored value when it
 * still names a known CLI. `untouched` covers empty forms that still hold the old
 * hardcoded Claude default from before this followed the project's agent.
 */
export function resolvePromptTargetAI(
  stored: string | undefined,
  fallback: string,
  options?: { untouched?: boolean },
): string {
  if (!stored) return fallback;
  const normalized = normalizeTargetAI(stored);
  // Older builds always wrote "Claude" into an empty form. If the project is a
  // different agent and the user hasn't started a request, follow the project.
  if (options?.untouched && stored === 'Claude' && fallback !== normalized) {
    return fallback;
  }
  if (TARGET_AIS.includes(normalized)) return normalized;
  return fallback;
}

export function getInstallCommandForCurrentOS(
  cli: CliDefinition,
  platform: SupportedOS,
): string | null {
  return cli.installCommand[platform] ?? null;
}

export function getUpdateCommandForCurrentOS(
  cli: CliDefinition,
  platform: SupportedOS,
): string | null {
  return cli.updateCommand?.[platform] ?? cli.installCommand[platform] ?? null;
}
