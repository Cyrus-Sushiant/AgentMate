export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  defaultCliId: string | null;
  theme: ThemeMode;
  skillRepositoryIds: string[];
  /** Hosts/IPs pinged for the dashboard's Network Status graph. */
  pingTargets: string[];
}

export type AgentType = 'claude-code' | 'gemini' | 'opencode' | 'codex' | 'generic';

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  description: string;
  tags: string[];
  agentType: AgentType;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstalledCli {
  id: string;
  installed: boolean;
  version: string | null;
  executablePath: string | null;
  lastCheckedAt: string;
}

export interface CliUpdateCheckResult {
  cliId: string;
  /** False when this CLI has no known source to check the latest version against. */
  supported: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string;
}

export type ActivityEventType =
  | 'cli-installed'
  | 'cli-detected'
  | 'project-created'
  | 'project-bootstrapped'
  | 'skill-installed'
  | 'skill-removed'
  | 'prompt-generated'
  | 'repository-added';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  message: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  promptType: string;
  targetAI: string;
  content: string;
  createdAt: string;
}
