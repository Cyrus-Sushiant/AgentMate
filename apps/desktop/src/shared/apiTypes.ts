import type { AgentType, ProjectNotificationSettings } from '@agentmat/core';

export interface CreateTerminalOptions {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  /** Text to pre-fill into the shell's input line, not yet submitted (e.g. an install command). */
  initialInput?: string;
  /** Associates this session with a project so confirmation-hook replies can be forwarded to it. */
  projectId?: string;
}

export interface CreateProjectInput {
  name: string;
  folderPath: string;
  description: string;
  tags: string[];
  agentType: AgentType;
  notes: string;
}

export interface SaveTemplateInput {
  name: string;
  promptType: string;
  targetAI: string;
  content: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface InstalledSkillRecord {
  skillId: string;
  repositoryId: string;
  version: string;
  installedAt: string;
}

export type PromptHistorySource = 'generate' | 'translate';

export interface PromptHistoryEntry {
  id: string;
  rawInput: string;
  promptType: string;
  targetAI: string;
  content: string;
  source: PromptHistorySource;
  tags: string[];
  createdAt: string;
}

export interface AddPromptHistoryInput {
  rawInput: string;
  promptType: string;
  targetAI: string;
  content: string;
  source: PromptHistorySource;
}

export interface TranslateTextInput {
  text: string;
  targetLang: string;
}

export interface ScheduledTaskInput {
  rawInput: string;
  promptType: string;
  targetAI: string;
  content: string;
  runAt: string;
}

export interface CreateScheduledTasksInput {
  projectId: string;
  tasks: ScheduledTaskInput[];
}

export interface PingResult {
  host: string;
  alive: boolean;
  latencyMs: number | null;
}

export interface IpGeoInfo {
  ip: string;
  country: string;
  countryCode: string;
}

export interface UpdateProjectNotificationsInput {
  projectId: string;
  notifications: ProjectNotificationSettings;
}

export interface SendTestNotificationInput {
  message: string;
}

export interface NotificationSendResult {
  ok: boolean;
  error?: string;
}

export interface DetectChatIdResult {
  chatId: string | null;
  error?: string;
}

export interface ConfirmationForwardedPayload {
  projectId: string;
  sessionId: string;
  text: string;
}

export interface SystemStatsSample {
  timestamp: number;
  cpuPercent: number;
  memPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  netRxBytesPerSec: number;
  netTxBytesPerSec: number;
  pings: PingResult[];
}
