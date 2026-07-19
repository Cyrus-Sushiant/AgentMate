import type { ShellCommand, SupportedOS } from '../cli/registry.js';

export type ToolSettingFieldType = 'select' | 'text' | 'boolean';

export interface ToolSettingOption {
  value: string;
  label: string;
}

export interface ToolSettingField {
  key: string;
  label: string;
  type: ToolSettingFieldType;
  options?: ToolSettingOption[];
  defaultValue: string | boolean;
  description?: string;
}

export type ToolSettingsValues = Record<string, string | boolean>;

/**
 * What happens when the user submits a tool's settings wizard.
 * - `command`: opens a terminal (optionally at the target project's folder) with the built command,
 *   for the user to confirm — never executed silently.
 * - `write-project-file`: writes a config file inside the selected project via the sandboxed fs IPC
 *   (which only allows writes under a project folder or app userData, never arbitrary host paths).
 * - `copy-text`: for settings that live outside any project (e.g. a file under the user's home
 *   directory), so we never bypass the fs write sandbox — shown as copyable text with instructions.
 */
export type ToolSettingsAction =
  | { kind: 'command'; command: string; cwd: 'project' | 'none' }
  | { kind: 'write-project-file'; relativePath: string; content: string }
  | { kind: 'copy-text'; content: string; instructions: string };

export interface AgentToolDockerConfig {
  image: string;
  containerName: string;
  /** Args inserted between `docker run -d --name <containerName>` and the image. */
  runArgs: string[];
  dashboardUrl?: string;
}

export interface AgentToolQuickAction {
  id: string;
  label: string;
  action: ToolSettingsAction;
}

export interface AgentToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  official: boolean;
  websiteUrl?: string;
  repositoryUrl: string;
  installKind: 'shell' | 'manual';
  /** Per-OS global install command, opened in a terminal for the user to confirm. */
  installCommand?: Partial<Record<SupportedOS, string>>;
  /** Shown with a copy button when the tool can't be installed with a single shell command. */
  manualInstallInstructions?: string;
  /** Probe used to detect whether the tool is already on PATH, e.g. `rtk --version`. */
  detectCommand?: ShellCommand;
  docker?: AgentToolDockerConfig;
  /** Extra one-off commands beyond install/docker, e.g. "Initialize in project". */
  quickActions?: AgentToolQuickAction[];
  settingsFields?: ToolSettingField[];
  /** Whether the settings wizard's result targets one project or the whole machine — changes wizard copy. */
  settingsScope?: 'project' | 'global';
  buildSettingsAction?: (values: ToolSettingsValues) => ToolSettingsAction;
}

export interface InstalledAgentTool {
  id: string;
  installed: boolean;
  version: string | null;
  /** 'unavailable' when the tool has no Docker option, or Docker itself isn't on this machine. */
  dockerStatus: 'unavailable' | 'not-created' | 'running' | 'stopped';
  lastCheckedAt: string;
}
