import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type {
  ActivityEvent,
  ActivityEventType,
  AppSettings,
  Project,
  PromptTemplate,
  ScheduledTask,
} from '@agentmat/core';
import { defaultProjectNotifications } from '@agentmat/core';
import type { SkillRepository } from '@agentmat/core';

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
  skillRepositoryIds: [],
  pingTargets: ['1.1.1.1'],
  telegramBotToken: null,
  telegramChatId: null,
};

/** Older projects.json entries predate the notifications field. */
function withProjectDefaults(project: Project): Project {
  return {
    ...project,
    notifications: project.notifications ?? defaultProjectNotifications(),
  };
}

export const store = {
  getProjects: async (): Promise<Project[]> => {
    const projects = await readJsonFile<Project[]>('projects.json', []);
    return projects.map(withProjectDefaults);
  },
  setProjects: (projects: Project[]): Promise<void> => writeJsonFile('projects.json', projects),

  getSettings: async (): Promise<AppSettings> => ({
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

  getScheduledTasks: (): Promise<ScheduledTask[]> => readJsonFile('scheduled-tasks.json', []),
  setScheduledTasks: (tasks: ScheduledTask[]): Promise<void> =>
    writeJsonFile('scheduled-tasks.json', tasks),
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
