export type ThemeMode = 'light' | 'dark' | 'system';

export type AiProvider = 'openai' | 'ollama' | 'gemini';

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
  /** Chat/group ID scheduled tasks are posted to and kept in sync with as their status changes. */
  telegramScheduledTasksChatId: string | null;
  /** API key for OpenAI's Chat Completions API, used by the Ask AI page. */
  openaiApiKey: string | null;
  /** Model id sent with OpenAI requests, e.g. "gpt-4o-mini". */
  openaiModel: string;
  /** Base URL of a local Ollama server, e.g. "http://localhost:11434". */
  ollamaBaseUrl: string;
  /** Last model selected for Ollama requests on the Ask AI page. */
  ollamaModel: string;
  /** API key for Google's Gemini API, used by the Ask AI page. */
  geminiApiKey: string | null;
  /** Model id sent with Gemini requests, e.g. "gemini-2.0-flash". */
  geminiModel: string;
  /** AI provider used to generate prompts in Prompt Builder; model comes from that provider's configured model above. */
  promptBuilderProvider: AiProvider;
  /** User-defined display order for the dashboard's stat chart cards (ids from DASHBOARD_CHART_IDS). */
  dashboardChartOrder: string[];
  /** How many extra attempts Prompt Builder's translate action makes after an initial failure. */
  translateMaxRetries: number;
  /** Local Whisper model used for Prompt Builder voice input: 'tiny' | 'base' | 'small'. Larger is more accurate but slower and bigger to download. */
  speechModel: string;
  /** Spoken language for voice input as a Whisper code (e.g. "en", "fa"), or "auto" to detect it. */
  speechLanguage: string;
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

/** A single hook entry found in a project's .claude/settings.json or .claude/settings.local.json. */
export interface DetectedClaudeHook {
  /** Stable within one read; re-derived as `${sourceFile}:${event}:${groupIndex}:${hookIndex}`. */
  id: string;
  event: string;
  matcher?: string;
  /** Raw `{ type, command, args?, timeout?, ... }` body, passed through as Claude Code stores it. */
  hook: Record<string, unknown>;
  /** True when this is one of AgentMate's own Completion/Confirmation hooks (shown elsewhere). */
  managedByAgentMate: boolean;
  /** CLI_REGISTRY id of the owning agent: 'claude-code', or another agent inferred from the command. */
  cliId: string;
}

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  description: string;
  tags: string[];
  agentType: AgentType;
  notes: string;
  /** Shell command that starts this project (e.g. "npm run dev"). Empty when not configured. */
  runCommand: string;
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
  /** Telegram chat/group this task's status message was posted to, so edits target the same chat. */
  telegramChatId?: string | null;
  /** message_id of the Telegram message tracking this task, used to edit it in place on status changes. */
  telegramMessageId?: number | null;
}
