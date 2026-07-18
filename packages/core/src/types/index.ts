export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  defaultCliId: string | null;
  theme: ThemeMode;
  skillRepositoryIds: string[];
  /** Hosts/IPs pinged for the dashboard's Network Status graph. */
  pingTargets: string[];
  /** Bot token from @BotFather, used to send notification-hook messages. */
  telegramBotToken: string | null;
  /** Chat/user ID the bot should message; also where confirmation replies are read from. */
  telegramChatId: string | null;
}

export type AgentType = 'claude-code' | 'gemini' | 'opencode' | 'codex' | 'generic';

export type NotificationHookKind = 'completion' | 'confirmation';

export interface ProjectNotificationHook {
  enabled: boolean;
  /** CLI_REGISTRY id of the installed agent this hook is wired to (e.g. "claude-code"). */
  cliId: string | null;
  message: string;
}

export interface ProjectNotificationSettings {
  completion: ProjectNotificationHook;
  confirmation: ProjectNotificationHook;
}

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  description: string;
  tags: string[];
  agentType: AgentType;
  notes: string;
  notifications: ProjectNotificationSettings;
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

export function defaultProjectNotifications(): ProjectNotificationSettings {
  return {
    completion: {
      enabled: false,
      cliId: null,
      message: '✅ {{project}} has finished its work.',
    },
    confirmation: {
      enabled: false,
      cliId: null,
      message: '⏸️ {{project}} needs your confirmation to continue. Reply to this message to continue.',
    },
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  promptType: string;
  targetAI: string;
  content: string;
  createdAt: string;
}

export type ScheduledTaskStatus = 'pending' | 'completed' | 'cancelled';

export interface ScheduledTask {
  id: string;
  projectId: string;
  rawInput: string;
  promptType: string;
  targetAI: string;
  content: string;
  /** ISO datetime the task is scheduled to run at. */
  runAt: string;
  status: ScheduledTaskStatus;
  createdAt: string;
}
