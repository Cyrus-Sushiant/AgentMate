import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  CliUpdateCheckResult,
  InstalledCli,
  Project,
  ProjectNotificationSettings,
  PromptTemplate,
  ActivityEvent,
  ScheduledTask,
  ScheduledTaskStatus,
  SkillRepository,
  SkillRepositoryIndex,
  SkillRepositorySourceType,
} from '@agentmat/core';
import { IPC } from '../shared/ipcChannels';
import type {
  CreateTerminalOptions,
  CreateProjectInput,
  CreateScheduledTasksInput,
  SaveTemplateInput,
  DirectoryEntry,
  InstalledSkillRecord,
  AddPromptHistoryInput,
  PromptHistoryEntry,
  TranslateTextInput,
  SystemStatsSample,
  IpGeoInfo,
  DetectChatIdResult,
  NotificationSendResult,
  SendTestNotificationInput,
  ConfirmationForwardedPayload,
} from '../shared/apiTypes';

interface TerminalDataPayload {
  sessionId: string;
  data: string;
}
interface TerminalExitPayload {
  sessionId: string;
  exitCode: number;
}

const cli = {
  detectAll: (): Promise<InstalledCli[]> => ipcRenderer.invoke(IPC.cli.detectAll),
  getInstallCommand: (cliId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.cli.getInstallCommand, cliId),
  checkForUpdate: (cliId: string, currentVersion: string | null): Promise<CliUpdateCheckResult> =>
    ipcRenderer.invoke(IPC.cli.checkForUpdate, cliId, currentVersion),
  getUpdateCommand: (cliId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.cli.getUpdateCommand, cliId),
};

const terminal = {
  create: (options: CreateTerminalOptions = {}): Promise<string> =>
    ipcRenderer.invoke(IPC.terminal.create, options),
  write: (sessionId: string, data: string): Promise<void> =>
    ipcRenderer.invoke(IPC.terminal.write, sessionId, data),
  resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke(IPC.terminal.resize, sessionId, cols, rows),
  kill: (sessionId: string): Promise<void> => ipcRenderer.invoke(IPC.terminal.kill, sessionId),
  onData: (callback: (payload: TerminalDataPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalDataPayload): void =>
      callback(payload);
    ipcRenderer.on(IPC.terminal.onData, listener);
    return () => ipcRenderer.removeListener(IPC.terminal.onData, listener);
  },
  onExit: (callback: (payload: TerminalExitPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalExitPayload): void =>
      callback(payload);
    ipcRenderer.on(IPC.terminal.onExit, listener);
    return () => ipcRenderer.removeListener(IPC.terminal.onExit, listener);
  },
};

const projects = {
  list: (): Promise<Project[]> => ipcRenderer.invoke(IPC.projects.list),
  create: (input: CreateProjectInput): Promise<Project> =>
    ipcRenderer.invoke(IPC.projects.create, input),
  update: (projectId: string, updates: Partial<CreateProjectInput>): Promise<Project> =>
    ipcRenderer.invoke(IPC.projects.update, projectId, updates),
  delete: (projectId: string): Promise<void> => ipcRenderer.invoke(IPC.projects.delete, projectId),
  bootstrap: (projectId: string): Promise<{ createdFiles: string[] }> =>
    ipcRenderer.invoke(IPC.projects.bootstrap, projectId),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.projects.pickFolder),
  updateNotifications: (projectId: string, notifications: ProjectNotificationSettings): Promise<Project> =>
    ipcRenderer.invoke(IPC.projects.updateNotifications, projectId, notifications),
};

const skills = {
  listRepositories: (): Promise<SkillRepository[]> =>
    ipcRenderer.invoke(IPC.skills.listRepositories),
  addRepository: (input: {
    name: string;
    sourceType: SkillRepositorySourceType;
    source: string;
  }): Promise<SkillRepository> => ipcRenderer.invoke(IPC.skills.addRepository, input),
  removeRepository: (repositoryId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.skills.removeRepository, repositoryId),
  refreshRepository: (repositoryId: string): Promise<SkillRepositoryIndex> =>
    ipcRenderer.invoke(IPC.skills.refreshRepository, repositoryId),
  getRepositoryIndex: (repositoryId: string): Promise<SkillRepositoryIndex> =>
    ipcRenderer.invoke(IPC.skills.getRepositoryIndex, repositoryId),
  pickLocalRepository: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.skills.pickLocalRepository),
  install: (params: { projectId: string; repositoryId: string; skillId: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.skills.install, params),
  remove: (params: { projectId: string; skillId: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.skills.remove, params),
  listInstalled: (projectId: string): Promise<InstalledSkillRecord[]> =>
    ipcRenderer.invoke(IPC.skills.listInstalled, projectId),
};

const fs = {
  readFile: (path: string): Promise<string> => ipcRenderer.invoke(IPC.fs.readFile, path),
  writeFile: (path: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.fs.writeFile, path, content),
  listDirectory: (path: string): Promise<DirectoryEntry[]> =>
    ipcRenderer.invoke(IPC.fs.listDirectory, path),
  writeScratchFile: (fileName: string, content: string): Promise<string> =>
    ipcRenderer.invoke(IPC.fs.writeScratchFile, fileName, content),
  saveFileAs: (defaultFileName: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.fs.saveFileAs, defaultFileName, content),
};

const settings = {
  get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settings.get),
  update: (updates: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.settings.update, updates),
};

const templates = {
  list: (): Promise<PromptTemplate[]> => ipcRenderer.invoke(IPC.templates.list),
  save: (input: SaveTemplateInput): Promise<PromptTemplate> =>
    ipcRenderer.invoke(IPC.templates.save, input),
  delete: (templateId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.templates.delete, templateId),
};

const activity = {
  list: (): Promise<ActivityEvent[]> => ipcRenderer.invoke(IPC.activity.list),
};

const shellApi = {
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.shell.openExternal, url),
};

const promptHistory = {
  list: (): Promise<PromptHistoryEntry[]> => ipcRenderer.invoke(IPC.promptHistory.list),
  search: (query: string): Promise<PromptHistoryEntry[]> =>
    ipcRenderer.invoke(IPC.promptHistory.search, query),
  add: (input: AddPromptHistoryInput): Promise<PromptHistoryEntry> =>
    ipcRenderer.invoke(IPC.promptHistory.add, input),
  remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.promptHistory.remove, id),
  setTags: (id: string, tags: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC.promptHistory.setTags, id, tags),
};

const translate = {
  text: (input: TranslateTextInput): Promise<string> => ipcRenderer.invoke(IPC.translate.text, input),
};

const system = {
  sample: (): Promise<SystemStatsSample> => ipcRenderer.invoke(IPC.system.sample),
};

const ipGeo = {
  lookup: (): Promise<IpGeoInfo> => ipcRenderer.invoke(IPC.ipGeo.lookup),
};

const scheduledTasks = {
  list: (): Promise<ScheduledTask[]> => ipcRenderer.invoke(IPC.scheduledTasks.list),
  listByProject: (projectId: string): Promise<ScheduledTask[]> =>
    ipcRenderer.invoke(IPC.scheduledTasks.listByProject, projectId),
  createMany: (input: CreateScheduledTasksInput): Promise<ScheduledTask[]> =>
    ipcRenderer.invoke(IPC.scheduledTasks.createMany, input),
  updateStatus: (taskId: string, status: ScheduledTaskStatus): Promise<void> =>
    ipcRenderer.invoke(IPC.scheduledTasks.updateStatus, taskId, status),
  remove: (taskId: string): Promise<void> => ipcRenderer.invoke(IPC.scheduledTasks.remove, taskId),
};

const notifications = {
  sendTest: (input: SendTestNotificationInput): Promise<NotificationSendResult> =>
    ipcRenderer.invoke(IPC.notifications.sendTest, input),
  detectChatId: (): Promise<DetectChatIdResult> => ipcRenderer.invoke(IPC.notifications.detectChatId),
  onConfirmationForwarded: (callback: (payload: ConfirmationForwardedPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ConfirmationForwardedPayload): void =>
      callback(payload);
    ipcRenderer.on(IPC.notifications.onConfirmationForwarded, listener);
    return () => ipcRenderer.removeListener(IPC.notifications.onConfirmationForwarded, listener);
  },
};

const windowControls = {
  minimize: (): Promise<void> => ipcRenderer.invoke(IPC.window.minimize),
  maximizeToggle: (): Promise<void> => ipcRenderer.invoke(IPC.window.maximizeToggle),
  close: (): Promise<void> => ipcRenderer.invoke(IPC.window.close),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.window.isMaximized),
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void =>
      callback(isMaximized);
    ipcRenderer.on(IPC.window.onMaximizedChange, listener);
    return () => ipcRenderer.removeListener(IPC.window.onMaximizedChange, listener);
  },
};

const agentmatApi = {
  platform: process.platform,
  cli,
  terminal,
  projects,
  skills,
  fs,
  settings,
  templates,
  activity,
  shell: shellApi,
  window: windowControls,
  promptHistory,
  translate,
  system,
  ipGeo,
  scheduledTasks,
  notifications,
};

export type AgentmatApi = typeof agentmatApi;

contextBridge.exposeInMainWorld('agentmat', agentmatApi);
