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
  description: z.string(),
  homepageUrl: z.string().url().optional(),
  docsUrl: z.string().url().optional(),
  executableNames: z.array(z.string()).min(1),
  detectCommand: ShellCommandSchema,
  versionCommand: ShellCommandSchema,
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
    name: 'Claude Code',
    description: "Anthropic's agentic coding CLI.",
    homepageUrl: 'https://claude.com/claude-code',
    docsUrl: 'https://docs.claude.com/en/docs/claude-code',
    executableNames: ['claude'],
    detectCommand: { command: 'claude', args: ['--version'] },
    versionCommand: { command: 'claude', args: ['--version'] },
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
    description: "Google's Gemini command-line AI agent.",
    homepageUrl: 'https://github.com/google-gemini/gemini-cli',
    executableNames: ['gemini'],
    detectCommand: { command: 'gemini', args: ['--version'] },
    versionCommand: { command: 'gemini', args: ['--version'] },
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
    description: 'Open-source AI coding agent for the terminal.',
    homepageUrl: 'https://opencode.ai',
    executableNames: ['opencode'],
    detectCommand: { command: 'opencode', args: ['--version'] },
    versionCommand: { command: 'opencode', args: ['--version'] },
    installCommand: {
      win32: 'npm install -g opencode-ai@latest',
      darwin: 'npm install -g opencode-ai@latest',
      linux: 'npm install -g opencode-ai@latest',
    },
    updateCheck: { type: 'npm', package: 'opencode-ai' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    description: "OpenAI's local coding agent CLI.",
    homepageUrl: 'https://github.com/openai/codex',
    executableNames: ['codex'],
    detectCommand: { command: 'codex', args: ['--version'] },
    versionCommand: { command: 'codex', args: ['--version'] },
    installCommand: {
      win32: 'npm install -g @openai/codex',
      darwin: 'npm install -g @openai/codex',
      linux: 'npm install -g @openai/codex',
    },
    updateCheck: { type: 'npm', package: '@openai/codex' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
  {
    id: 'qwen-cli',
    name: 'Qwen CLI',
    description: "Alibaba's Qwen Code command-line AI agent.",
    homepageUrl: 'https://github.com/QwenLM/qwen-code',
    executableNames: ['qwen'],
    detectCommand: { command: 'qwen', args: ['--version'] },
    versionCommand: { command: 'qwen', args: ['--version'] },
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
    description: 'AI pair programming CLI that edits code in your local git repo.',
    homepageUrl: 'https://aider.chat',
    executableNames: ['aider'],
    detectCommand: { command: 'aider', args: ['--version'] },
    versionCommand: { command: 'aider', args: ['--version'] },
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
    description: "Block's on-machine AI agent CLI.",
    homepageUrl: 'https://github.com/block/goose',
    executableNames: ['goose'],
    detectCommand: { command: 'goose', args: ['--version'] },
    versionCommand: { command: 'goose', args: ['--version'] },
    installCommand: {
      darwin: 'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash',
      linux: 'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash',
    },
    updateCheck: { type: 'github-release', package: 'block/goose' },
    supportedOS: ['darwin', 'linux'],
  },
  {
    id: 'continue-cli',
    name: 'Continue CLI',
    description: 'Open-source AI coding assistant CLI ("cn").',
    homepageUrl: 'https://continue.dev',
    executableNames: ['cn'],
    detectCommand: { command: 'cn', args: ['--version'] },
    versionCommand: { command: 'cn', args: ['--version'] },
    installCommand: {
      win32: 'npm install -g @continuedev/cli',
      darwin: 'npm install -g @continuedev/cli',
      linux: 'npm install -g @continuedev/cli',
    },
    updateCheck: { type: 'npm', package: '@continuedev/cli' },
    supportedOS: ['win32', 'darwin', 'linux'],
  },
];

export function getCliDefinition(id: string): CliDefinition | undefined {
  return CLI_REGISTRY.find((cli) => cli.id === id);
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
