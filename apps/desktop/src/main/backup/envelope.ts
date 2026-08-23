import type {
  ActivityEvent,
  AppNotification,
  AppSettings,
  McpRepository,
  Project,
  ProjectDraft,
  PromptTemplate,
  ScheduledTask,
  SkillRepository,
} from '@agentmat/core';
import {
  defaultProjectNotifications,
  normalizeCliArgs,
  normalizeProjectColor,
  normalizeProjectGithubActions,
  normalizeProjectNotifications,
  normalizeProjectRunCommands,
} from '@agentmat/core';
import type { PromptHistoryEntry, SkillAuditRecord } from '../../shared/apiTypes';
import { DEFAULT_SETTINGS } from '../store';

export const BACKUP_VERSION = 1;

export interface BackupData {
  projects?: Project[];
  settings?: AppSettings;
  activity?: ActivityEvent[];
  templates?: PromptTemplate[];
  repositories?: SkillRepository[];
  mcpRepositories?: McpRepository[];
  projectDrafts?: ProjectDraft[];
  scheduledTasks?: ScheduledTask[];
  promptHistory?: PromptHistoryEntry[];
  skillAudits?: SkillAuditRecord[];
  appNotifications?: AppNotification[];
}

export interface BackupEnvelope {
  version: number;
  exportedAt: string;
  appVersion: string;
  data: BackupData;
}

export type ParsedBackup =
  | { ok: true; data: BackupData; skipped: Record<string, number>; warnings: string[] }
  | { ok: false; error: string };

type Record_ = Record<string, unknown>;

function isRecord(value: unknown): value is Record_ {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/**
 * Runs every entry of one imported collection through `build`, dropping the ones
 * it rejects and reporting how many were dropped. Nothing here writes: the caller
 * validates every collection first, so a bad row can't leave a half-restored app.
 */
function mapEntries<T>(
  value: unknown,
  build: (entry: Record_) => T | null,
): { items: T[]; skipped: number } | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return { items: [], skipped: 0 };
  const items: T[] = [];
  let skipped = 0;
  for (const entry of value) {
    const built = isRecord(entry) ? build(entry) : null;
    if (built) items.push(built);
    else skipped += 1;
  }
  return { items, skipped };
}

function buildProject(entry: Record_): Project | null {
  const id = str(entry.id);
  const name = str(entry.name);
  const folderPath = str(entry.folderPath);
  // A project without these is not restorable: folderPath in particular decides
  // which directories the filesystem handlers will later accept paths under.
  if (!id || !name || !folderPath?.trim()) return null;

  const now = new Date().toISOString();
  return {
    id,
    name,
    folderPath,
    description: strOr(entry.description, ''),
    tags: strArray(entry.tags),
    agentType: strOr(entry.agentType, 'claude') as Project['agentType'],
    notes: strOr(entry.notes, ''),
    // Run commands are launched as processes, so they go through the app's own
    // normalizer rather than being trusted as written in the file.
    runCommands: normalizeProjectRunCommands({
      runCommands: Array.isArray(entry.runCommands)
        ? (entry.runCommands as Project['runCommands'])
        : null,
      runCommand: nullableStr(entry.runCommand),
    }),
    prompt: strOr(entry.prompt, ''),
    notifications: isRecord(entry.notifications)
      ? normalizeProjectNotifications(entry.notifications as Partial<Project['notifications']>)
      : defaultProjectNotifications(),
    cliId: nullableStr(entry.cliId),
    iconDataUrl: nullableStr(entry.iconDataUrl),
    // The backup carries the image inline, so the file it lived in on the machine
    // that exported it means nothing here. The icon store writes a fresh one.
    iconFile: null,
    iconBgColor: normalizeProjectColor(entry.iconBgColor),
    iconColor: normalizeProjectColor(entry.iconColor),
    websiteUrl: strOr(entry.websiteUrl, ''),
    repoUrl: strOr(entry.repoUrl, ''),
    githubActions: normalizeProjectGithubActions(entry.githubActions),
    pinned: entry.pinned === true,
    createdAt: strOr(entry.createdAt, now),
    updatedAt: strOr(entry.updatedAt, now),
  };
}

/**
 * Keeps only keys the current build knows about, so an unrecognized field in the
 * file can never reach the settings store. The store merges over DEFAULT_SETTINGS
 * and runs its own migrations on read, which fills in whatever the backup omitted.
 */
function buildSettings(entry: Record_): AppSettings {
  const known = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];
  const settings = { ...DEFAULT_SETTINGS } as Record_;
  for (const key of known) {
    if (entry[key] !== undefined) settings[key] = entry[key];
  }
  settings.cliArgs = normalizeCliArgs(settings.cliArgs);
  return settings as unknown as AppSettings;
}

function buildActivity(entry: Record_): ActivityEvent | null {
  const id = str(entry.id);
  const type = str(entry.type);
  if (!id || !type) return null;
  const metadata = isRecord(entry.metadata)
    ? Object.fromEntries(
        Object.entries(entry.metadata).filter(([, v]) => typeof v === 'string') as [
          string,
          string,
        ][],
      )
    : undefined;
  return {
    id,
    type: type as ActivityEvent['type'],
    message: strOr(entry.message, ''),
    createdAt: strOr(entry.createdAt, new Date().toISOString()),
    ...(metadata ? { metadata } : {}),
  };
}

function buildTemplate(entry: Record_): PromptTemplate | null {
  const id = str(entry.id);
  if (!id) return null;
  return {
    id,
    name: strOr(entry.name, ''),
    promptType: strOr(entry.promptType, ''),
    targetAI: strOr(entry.targetAI, ''),
    content: strOr(entry.content, ''),
    createdAt: strOr(entry.createdAt, new Date().toISOString()),
  };
}

/** Repositories and MCP repositories are plain id-keyed records; keep them as-is once identified. */
function buildKeyedRecord<T>(entry: Record_): T | null {
  return str(entry.id) ? (entry as T) : null;
}

function buildProjectDraft(entry: Record_): ProjectDraft | null {
  const id = str(entry.id);
  const projectId = str(entry.projectId);
  if (!id || !projectId) return null;
  return {
    id,
    projectId,
    rawInput: strOr(entry.rawInput, ''),
    promptType: strOr(entry.promptType, ''),
    targetAI: strOr(entry.targetAI, ''),
    content: strOr(entry.content, ''),
    status: entry.status === 'implemented' ? 'implemented' : 'draft',
    createdAt: strOr(entry.createdAt, new Date().toISOString()),
    implementedAt: nullableStr(entry.implementedAt),
  };
}

const TASK_STATUSES = new Set(['pending', 'completed', 'cancelled']);

function buildScheduledTask(entry: Record_): ScheduledTask | null {
  const id = str(entry.id);
  const projectId = str(entry.projectId);
  const runAt = str(entry.runAt);
  if (!id || !projectId || !runAt) return null;
  const status = strOr(entry.status, 'pending');
  return {
    id,
    projectId,
    rawInput: strOr(entry.rawInput, ''),
    promptType: strOr(entry.promptType, ''),
    targetAI: strOr(entry.targetAI, ''),
    content: strOr(entry.content, ''),
    runAt,
    status: (TASK_STATUSES.has(status) ? status : 'pending') as ScheduledTask['status'],
    createdAt: strOr(entry.createdAt, new Date().toISOString()),
    telegramChatId: nullableStr(entry.telegramChatId),
    telegramMessageId: typeof entry.telegramMessageId === 'number' ? entry.telegramMessageId : null,
  };
}

function buildAppNotification(entry: Record_): AppNotification | null {
  const id = str(entry.id);
  if (!id) return null;
  return {
    id,
    kind: strOr(entry.kind, 'pipeline-failure') as AppNotification['kind'],
    title: strOr(entry.title, ''),
    body: strOr(entry.body, ''),
    projectId: nullableStr(entry.projectId),
    projectName: strOr(entry.projectName, ''),
    htmlUrl: nullableStr(entry.htmlUrl),
    createdAt: strOr(entry.createdAt, new Date().toISOString()),
    read: entry.read === true,
  };
}

/**
 * Every field here is bound straight into a SQL statement, so a missing one used
 * to make better-sqlite3 throw partway through the restore.
 */
function buildPromptHistory(entry: Record_): PromptHistoryEntry | null {
  const id = str(entry.id);
  if (!id) return null;
  return {
    id,
    rawInput: strOr(entry.rawInput, ''),
    promptType: strOr(entry.promptType, ''),
    targetAI: strOr(entry.targetAI, ''),
    content: strOr(entry.content, ''),
    source: strOr(entry.source, 'builder') as PromptHistoryEntry['source'],
    tags: strArray(entry.tags),
    projectId: nullableStr(entry.projectId),
    createdAt: strOr(entry.createdAt, new Date().toISOString()),
  };
}

function buildSkillAudit(entry: Record_): SkillAuditRecord | null {
  const id = str(entry.id);
  const skillId = str(entry.skillId);
  if (!id || !skillId) return null;
  return {
    id,
    skillId,
    skillName: strOr(entry.skillName, ''),
    sourceKind: strOr(entry.sourceKind, 'installed') as SkillAuditRecord['sourceKind'],
    sourceLabel: strOr(entry.sourceLabel, ''),
    projectId: nullableStr(entry.projectId),
    verdict: strOr(entry.verdict, 'unknown') as SkillAuditRecord['verdict'],
    score: num(entry.score, 0),
    findings: Array.isArray(entry.findings) ? (entry.findings as SkillAuditRecord['findings']) : [],
    filesScanned: num(entry.filesScanned, 0),
    bytesScanned: num(entry.bytesScanned, 0),
    deepReview: entry.deepReview === true,
    cliName: nullableStr(entry.cliName),
    aiSummary: nullableStr(entry.aiSummary),
    aiError: nullableStr(entry.aiError),
    createdAt: strOr(entry.createdAt, new Date().toISOString()),
  };
}

/**
 * Turns whatever was in the chosen file into data that is safe to persist, or an
 * error explaining why it isn't a backup. Nothing is written here: the caller gets
 * a fully built payload and can commit it in one go.
 *
 * Two settings decide what the app will later execute or read: `cliArgs` goes into
 * the argv of every headless CLI spawn, and a project's `folderPath`/`runCommands`
 * decide which directories the filesystem handlers accept and what the Run button
 * starts. They are normalized rather than trusted verbatim, and `warnings` tells the
 * user when a backup carried them so they can look before running anything.
 */
export function parseBackup(value: unknown): ParsedBackup {
  if (!isRecord(value)) return { ok: false, error: 'That file is not a valid AgentMate backup.' };
  if (value.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `That backup was written in an unsupported format (version ${String(value.version)}).`,
    };
  }
  if (!isRecord(value.data)) {
    return { ok: false, error: 'That file is not a valid AgentMate backup.' };
  }

  const raw = value.data;
  const data: BackupData = {};
  const skipped: Record<string, number> = {};

  const collect = <T>(
    key: keyof BackupData,
    label: string,
    build: (entry: Record_) => T | null,
  ): T[] | undefined => {
    const result = mapEntries(raw[key], build);
    if (!result) return undefined;
    if (result.skipped > 0) skipped[label] = result.skipped;
    return result.items;
  };

  data.projects = collect('projects', 'projects', buildProject);
  data.activity = collect('activity', 'activity events', buildActivity);
  data.templates = collect('templates', 'templates', buildTemplate);
  data.repositories = collect('repositories', 'skill repositories', (entry) =>
    buildKeyedRecord<SkillRepository>(entry),
  );
  data.mcpRepositories = collect('mcpRepositories', 'MCP repositories', (entry) =>
    buildKeyedRecord<McpRepository>(entry),
  );
  data.projectDrafts = collect('projectDrafts', 'project drafts', buildProjectDraft);
  data.scheduledTasks = collect('scheduledTasks', 'scheduled tasks', buildScheduledTask);
  data.promptHistory = collect('promptHistory', 'prompt history entries', buildPromptHistory);
  data.skillAudits = collect('skillAudits', 'skill audits', buildSkillAudit);
  data.appNotifications = collect('appNotifications', 'notifications', buildAppNotification);

  const warnings: string[] = [];
  if (isRecord(raw.settings)) {
    data.settings = buildSettings(raw.settings);
    if (Object.keys(data.settings.cliArgs ?? {}).length > 0) {
      warnings.push(
        'This backup set custom CLI arguments. Review them in Settings before running an agent.',
      );
    }
  }
  if (data.projects?.some((project) => project.runCommands.length > 0)) {
    warnings.push(
      'This backup set project run commands. Check them on each project before using Run.',
    );
  }

  for (const [label, count] of Object.entries(skipped)) {
    warnings.push(`Skipped ${count} unreadable ${label}.`);
  }

  return { ok: true, data, skipped, warnings };
}
