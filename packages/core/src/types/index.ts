import type {
  DesktopWidgetInstance,
  UsageProviderConfig,
  UsageResetAlertSettings,
  UsageThresholdAlertSettings,
  WidgetMode,
} from '../usage/types.js';
import type { DesktopPromptBuildWidgetInstance } from '../promptBuilder/types.js';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AiProvider = 'openai' | 'ollama' | 'gemini';

/** Column counts a single dashboard row can be switched between. */
export const DASHBOARD_COLUMN_OPTIONS = [1, 2, 3, 4] as const;
export type DashboardColumns = (typeof DASHBOARD_COLUMN_OPTIONS)[number];

/**
 * One horizontal band of the dashboard. Each row carries its own column count,
 * so a 4-across row of small cards can sit above a 2-across row of charts.
 */
export interface DashboardRow {
  /** Stable across reorders so React keys and drop targets survive edits. */
  id: string;
  columns: DashboardColumns;
  /**
   * Card ids in display order: chart ids, `stat:<id>` built-in stat tiles,
   * `usage:<providerId>` Token Usage cards, and `summary:<id>` usage-summary tiles.
   */
  items: string[];
}

/** Built-in Dashboard stat tiles, movable and hideable like any other dashboard card. */
export const DASHBOARD_STAT_IDS = [
  'installed-clis',
  'active-projects',
  'skill-repos',
  'location',
] as const;
export type DashboardStatId = (typeof DASHBOARD_STAT_IDS)[number];

/** Token Usage's aggregate summary tiles, pinnable to the dashboard from that page. */
export const DASHBOARD_USAGE_SUMMARY_IDS = [
  'tokens-today',
  'tokens-week',
  'cost-today',
  'providers-tracked',
] as const;
export type DashboardUsageSummaryId = (typeof DASHBOARD_USAGE_SUMMARY_IDS)[number];

export interface AppSettings {
  defaultCliId: string | null;
  theme: ThemeMode;
  /** Folder that holds the user's projects; folder pickers open here instead of the OS default. */
  projectsRootPath: string | null;
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
  /**
   * Legacy flat display order for the dashboard's cards. Superseded by
   * `dashboardLayout`, and only read once to build rows for users upgrading.
   */
  dashboardChartOrder: string[];
  /** Provider ids whose Token Usage card is shown on the dashboard. */
  dashboardUsageCards: string[];
  /** Which built-in Dashboard stat tiles (see `DASHBOARD_STAT_IDS`) are shown; hidden ones can be brought back from the Dashboard's edit mode. */
  dashboardStatCards: string[];
  /** Which Token Usage summary tiles (see `DASHBOARD_USAGE_SUMMARY_IDS`) are pinned to the dashboard; toggled from the Token Usage page. */
  dashboardUsageSummaryCards: string[];
  /** The dashboard's rows, each with its own column count and cards. */
  dashboardLayout: DashboardRow[];
  /** How many extra attempts Prompt Builder's translate action makes after an initial failure. */
  translateMaxRetries: number;
  /** Local Whisper model used for Prompt Builder voice input: 'tiny' | 'base' | 'small'. Larger is more accurate but slower and bigger to download. */
  speechModel: string;
  /** Spoken language for voice input as a Whisper code (e.g. "en", "fa"), or "auto" to detect it. */
  speechLanguage: string;
  /** Per-provider config for the Token Usage page (enabled flag + optional API key), keyed by provider id. */
  usageProviderConfigs: Record<string, UsageProviderConfig>;
  /** Floating desktop usage widgets the user has pinned; recreated on app launch. */
  usageWidgets: DesktopWidgetInstance[];
  /** Floating desktop Build Prompt widgets the user has pinned; recreated on app launch. */
  promptBuildWidgets: DesktopPromptBuildWidgetInstance[];
  /** User-defined display order for the Usage page's provider cards (provider ids). */
  usageCardOrder: string[];
  /**
   * Which view each Usage page card shows, keyed by provider id. Only providers
   * the user switched to plan limits appear here; anything absent shows tokens.
   */
  usageCardModes: Record<string, WidgetMode>;
  /** Telegram announcement when a Claude Code rate-limit window resets; toggled on the Token Usage page. */
  usageResetAlerts: UsageResetAlertSettings;
  /** OS notification (in-app toast fallback) when a rate-limit window crosses a percent threshold. */
  usageThresholdAlerts: UsageThresholdAlertSettings;
}

export type AgentType = 'claude-code' | 'gemini' | 'opencode' | 'codex' | 'cursor' | 'generic';

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
  /**
   * The project's standing prompt: the context handed to an agent every time it
   * works on this project. Defined from the Prompt dialog on the project detail
   * page. Empty when not configured.
   */
  prompt: string;
  notifications: ProjectNotificationSettings;
  /**
   * CLI_REGISTRY id this project's AI actions run through. Null (the default) means
   * "use the app-wide default CLI from Settings"; set it to pin this one project to a
   * different agent.
   */
  cliId: string | null;
  /**
   * The project's own icon, stored inline as a data URL so it survives backups
   * and never depends on a file that moves. Either picked from disk or grabbed
   * from `websiteUrl`'s favicon. Null falls back to the generic folder glyph.
   */
  iconDataUrl: string | null;
  /** Site this project lives at, and the source its favicon is fetched from. Empty when unset. */
  websiteUrl: string;
  /**
   * Where the project's code is hosted, e.g. "https://github.com/me/my-app". Filled in
   * on the create form (detected from the folder's origin remote when there is one),
   * and only ever a label to open: nothing here runs git. Empty when unset.
   */
  repoUrl: string;
  /** Pinned projects are sorted first on the Projects page, above the drag-ordered rest. */
  pinned: boolean;
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
      message:
        '⏸️ {{project}} needs your confirmation to continue. Reply to this message to continue.',
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

export type ProjectDraftStatus = 'draft' | 'implemented';

/**
 * A Prompt Builder draft parked against a project. Keeps the parameters the prompt was
 * built with so the project's Overview can show what was planned and whether it shipped.
 */
export interface ProjectDraft {
  id: string;
  projectId: string;
  rawInput: string;
  promptType: string;
  targetAI: string;
  /** The generated prompt as it stood when the draft was saved. */
  content: string;
  status: ProjectDraftStatus;
  createdAt: string;
  /** ISO datetime the draft was marked implemented; null while it's still open. */
  implementedAt: string | null;
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
