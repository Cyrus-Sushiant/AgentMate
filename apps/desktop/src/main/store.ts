import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type {
  ActivityEvent,
  ActivityEventType,
  AppSettings,
  Project,
  ProjectDraft,
  PromptTemplate,
  ScheduledTask,
} from '@agentmat/core';
import type { RemoteSavedServer } from '../shared/apiTypes';
import {
  DASHBOARD_STAT_IDS,
  defaultProjectNotifications,
  defaultUsageResetAlerts,
  defaultUsageThresholdAlerts,
  normalizeUsageResetAlerts,
  normalizeUsageThresholdAlerts,
} from '@agentmat/core';
import type { SkillRepository } from '@agentmat/core';
import type { McpRepository } from '@agentmat/core';

function dataDir(): string {
  return join(app.getPath('userData'), 'data');
}

async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(join(dataDir(), fileName), 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const filePath = join(dataDir(), fileName);
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await rename(tmpPath, filePath);
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultCliId: null,
  theme: 'system',
  projectsRootPath: null,
  skillRepositoryIds: [],
  pingTargets: ['1.1.1.1'],
  telegramBotToken: null,
  telegramChatId: null,
  telegramScheduledTasksChatId: null,
  openaiApiKey: null,
  openaiModel: 'gpt-4o-mini',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: '',
  geminiApiKey: null,
  geminiModel: 'gemini-2.0-flash',
  promptBuilderProvider: 'openai',
  dashboardChartOrder: [],
  dashboardUsageCards: [],
  // Preserves today's always-shown behavior for existing installs; users can
  // hide any of these from the Dashboard's edit mode once they upgrade.
  dashboardStatCards: [...DASHBOARD_STAT_IDS],
  dashboardUsageSummaryCards: [],
  dashboardLayout: [],
  translateMaxRetries: 3,
  speechModel: 'base',
  speechLanguage: 'auto',
  usageProviderConfigs: {},
  usageWidgets: [],
  promptBuildWidgets: [],
  usageCardOrder: [],
  usageCardModes: {},
  usageResetAlerts: defaultUsageResetAlerts(),
  usageThresholdAlerts: defaultUsageThresholdAlerts(),
};

/**
 * The weekly bucket above Pro was keyed 'week-opus' before Fable took that slot.
 * A saved alert still naming it would match no window and quietly never fire.
 *
 * Normalizing first is what keeps a half-written block (no `windows` array, say)
 * from reaching either process as something that throws on first access.
 */
function withSettingsMigrations(settings: AppSettings): AppSettings {
  const alerts = normalizeUsageResetAlerts(settings.usageResetAlerts);
  const windows = alerts.windows.map((key) =>
    String(key) === 'week-opus' ? ('week-fable' as const) : key,
  );
  return {
    ...settings,
    usageResetAlerts: { ...alerts, windows: [...new Set(windows)] },
    usageThresholdAlerts: normalizeUsageThresholdAlerts(settings.usageThresholdAlerts),
  };
}

/** Older projects.json entries predate the notifications, prompt, pinned, cliId, and icon fields. */
function withProjectDefaults(project: Project): Project {
  return {
    ...project,
    notifications: project.notifications ?? defaultProjectNotifications(),
    prompt: project.prompt ?? '',
    pinned: project.pinned ?? false,
    cliId: project.cliId ?? null,
    iconDataUrl: project.iconDataUrl ?? null,
    websiteUrl: project.websiteUrl ?? '',
  };
}

export const store = {
  getProjects: async (): Promise<Project[]> => {
    const projects = await readJsonFile<Project[]>('projects.json', []);
    return projects.map(withProjectDefaults);
  },
  setProjects: (projects: Project[]): Promise<void> => writeJsonFile('projects.json', projects),

  getSettings: async (): Promise<AppSettings> =>
    withSettingsMigrations({
      ...DEFAULT_SETTINGS,
      ...(await readJsonFile<Partial<AppSettings>>('settings.json', DEFAULT_SETTINGS)),
    }),
  setSettings: (settings: AppSettings): Promise<void> => writeJsonFile('settings.json', settings),

  getActivity: (): Promise<ActivityEvent[]> => readJsonFile('activity-log.json', []),
  setActivity: (events: ActivityEvent[]): Promise<void> =>
    writeJsonFile('activity-log.json', events),

  getTemplates: (): Promise<PromptTemplate[]> => readJsonFile('templates.json', []),
  setTemplates: (templates: PromptTemplate[]): Promise<void> =>
    writeJsonFile('templates.json', templates),

  getRepositories: (): Promise<SkillRepository[]> => readJsonFile('repositories.json', []),
  setRepositories: (repos: SkillRepository[]): Promise<void> =>
    writeJsonFile('repositories.json', repos),

  getMcpRepositories: (): Promise<McpRepository[]> => readJsonFile('mcp-repositories.json', []),
  setMcpRepositories: (repos: McpRepository[]): Promise<void> =>
    writeJsonFile('mcp-repositories.json', repos),

  getProjectDrafts: (): Promise<ProjectDraft[]> => readJsonFile('project-drafts.json', []),
  setProjectDrafts: (drafts: ProjectDraft[]): Promise<void> =>
    writeJsonFile('project-drafts.json', drafts),

  getScheduledTasks: (): Promise<ScheduledTask[]> => readJsonFile('scheduled-tasks.json', []),
  setScheduledTasks: (tasks: ScheduledTask[]): Promise<void> =>
    writeJsonFile('scheduled-tasks.json', tasks),

  getRemoteServers: (): Promise<RemoteSavedServer[]> => readJsonFile('remote-servers.json', []),
  setRemoteServers: (servers: RemoteSavedServer[]): Promise<void> =>
    writeJsonFile('remote-servers.json', servers),
};

export async function logActivity(
  type: ActivityEventType,
  message: string,
  metadata?: Record<string, string>,
): Promise<ActivityEvent> {
  const events = await store.getActivity();
  const event: ActivityEvent = {
    id: randomUUID(),
    type,
    message,
    createdAt: new Date().toISOString(),
    metadata,
  };
  events.unshift(event);
  await store.setActivity(events.slice(0, 200));
  return event;
}
