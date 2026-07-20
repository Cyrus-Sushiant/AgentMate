import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  CliUpdateCheckResult,
  DetectedClaudeHook,
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
  McpRepository,
  McpRepositoryIndex,
  McpRepositorySourceType,
  InstalledAgentTool,
} from '@agentmat/core';
import { IPC } from '../shared/ipcChannels';
import type {
  CreateTerminalOptions,
  CreateProjectInput,
  CreateScheduledTasksInput,
  SaveTemplateInput,
  DirectoryEntry,
  InstalledSkillRecord,
  InstalledMcpServerRecord,
  SkillsShDetail,
  SkillsShSearchResult,
  InstallFromSkillsShInput,
  AddPromptHistoryInput,
  PromptHistoryEntry,
  TranslateTextInput,
  AskAiInput,
  AskAiResult,
  SystemStatsSample,
  IpGeoInfo,
  DetectChatIdResult,
  NotificationSendResult,
  SendTestNotificationInput,
  ConfirmationForwardedPayload,
  GitStatus,
  GitOpResult,
  CreatePullRequestInput,
  CreatePullRequestResult,
  RemoteState,
  RemoteNetworkInterface,
  RemotePairingInfo,
  RemoteScreenSize,
  RemoteFileProgress,
  RemoteLogEvent,
  StartHostInput,
  UpdateStatus,
} from '../shared/apiTypes';
import type { RemoteInputEvent, RemoteRtcMessage } from '../shared/remoteProtocol';

interface TerminalDataPayload {
  sessionId: string;
  data: string;
}
interface TerminalExitPayload {
  sessionId: string;
  exitCode: number;
}

const appInfo = {
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.app.getVersion),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.app.checkForUpdates),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.app.downloadUpdate),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke(IPC.app.quitAndInstall),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void =>
      callback(status);
    ipcRenderer.on(IPC.app.onUpdateStatus, listener);
    return () => ipcRenderer.removeListener(IPC.app.onUpdateStatus, listener);
  },
};

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
  updateNotifications: (
    projectId: string,
    notifications: ProjectNotificationSettings,
  ): Promise<Project> =>
    ipcRenderer.invoke(IPC.projects.updateNotifications, projectId, notifications),
  listClaudeHooks: (projectId: string): Promise<DetectedClaudeHook[]> =>
    ipcRenderer.invoke(IPC.projects.listClaudeHooks, projectId),
  updateClaudeHook: (
    projectId: string,
    hookId: string,
    updates: { matcher?: string; hook: Record<string, unknown> },
  ): Promise<void> => ipcRenderer.invoke(IPC.projects.updateClaudeHook, projectId, hookId, updates),
  deleteClaudeHook: (projectId: string, hookId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.projects.deleteClaudeHook, projectId, hookId),
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
  searchSkillsSh: (query: string): Promise<SkillsShSearchResult[]> =>
    ipcRenderer.invoke(IPC.skills.searchSkillsSh, query),
  getSkillsShDetail: (skillPath: string): Promise<SkillsShDetail> =>
    ipcRenderer.invoke(IPC.skills.getSkillsShDetail, skillPath),
  installFromSkillsSh: (input: InstallFromSkillsShInput): Promise<void> =>
    ipcRenderer.invoke(IPC.skills.installFromSkillsSh, input),
};

const mcp = {
  listRepositories: (): Promise<McpRepository[]> => ipcRenderer.invoke(IPC.mcp.listRepositories),
  addRepository: (input: {
    name: string;
    sourceType: McpRepositorySourceType;
    source: string;
  }): Promise<McpRepository> => ipcRenderer.invoke(IPC.mcp.addRepository, input),
  removeRepository: (repositoryId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.mcp.removeRepository, repositoryId),
  refreshRepository: (repositoryId: string): Promise<McpRepositoryIndex> =>
    ipcRenderer.invoke(IPC.mcp.refreshRepository, repositoryId),
  getRepositoryIndex: (repositoryId: string): Promise<McpRepositoryIndex> =>
    ipcRenderer.invoke(IPC.mcp.getRepositoryIndex, repositoryId),
  pickLocalRepository: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.mcp.pickLocalRepository),
  install: (params: {
    projectId: string;
    repositoryId: string;
    serverId: string;
    env?: Record<string, string>;
  }): Promise<void> => ipcRenderer.invoke(IPC.mcp.install, params),
  remove: (params: { projectId: string; serverId: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.mcp.remove, params),
  listInstalled: (projectId: string): Promise<InstalledMcpServerRecord[]> =>
    ipcRenderer.invoke(IPC.mcp.listInstalled, projectId),
};

const tools = {
  detectAll: (): Promise<InstalledAgentTool[]> => ipcRenderer.invoke(IPC.tools.detectAll),
  getInstallCommand: (toolId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.tools.getInstallCommand, toolId),
  getUninstallCommand: (toolId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.tools.getUninstallCommand, toolId),
  getInteractiveLaunchCommand: (toolId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.tools.getInteractiveLaunchCommand, toolId),
  getDockerCommand: (
    toolId: string,
    action: 'run' | 'start' | 'stop' | 'reset' | 'remove',
  ): Promise<string | null> => ipcRenderer.invoke(IPC.tools.getDockerCommand, toolId, action),
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
  openPath: (path: string): Promise<void> => ipcRenderer.invoke(IPC.shell.openPath, path),
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
  text: (input: TranslateTextInput): Promise<string> =>
    ipcRenderer.invoke(IPC.translate.text, input),
};

const ai = {
  ask: (input: AskAiInput): Promise<AskAiResult> => ipcRenderer.invoke(IPC.ai.ask, input),
  listOllamaModels: (): Promise<string[]> => ipcRenderer.invoke(IPC.ai.listOllamaModels),
  listGeminiModels: (): Promise<string[]> => ipcRenderer.invoke(IPC.ai.listGeminiModels),
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
  detectChatId: (): Promise<DetectChatIdResult> =>
    ipcRenderer.invoke(IPC.notifications.detectChatId),
  onConfirmationForwarded: (
    callback: (payload: ConfirmationForwardedPayload) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: ConfirmationForwardedPayload,
    ): void => callback(payload);
    ipcRenderer.on(IPC.notifications.onConfirmationForwarded, listener);
    return () => ipcRenderer.removeListener(IPC.notifications.onConfirmationForwarded, listener);
  },
};

const git = {
  status: (projectId: string): Promise<GitStatus> => ipcRenderer.invoke(IPC.git.status, projectId),
  changeSummary: (projectId: string): Promise<string> =>
    ipcRenderer.invoke(IPC.git.changeSummary, projectId),
  fetch: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.fetch, projectId),
  pull: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.pull, projectId),
  push: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.push, projectId),
  sync: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.sync, projectId),
  createBranch: (projectId: string, branchName: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.createBranch, projectId, branchName),
  commit: (projectId: string, message: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.commit, projectId, message),
  createPullRequest: (input: CreatePullRequestInput): Promise<CreatePullRequestResult> =>
    ipcRenderer.invoke(IPC.git.createPullRequest, input),
};

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const remote = {
  getState: (): Promise<RemoteState> => ipcRenderer.invoke(IPC.remote.getState),
  listInterfaces: (): Promise<RemoteNetworkInterface[]> =>
    ipcRenderer.invoke(IPC.remote.listInterfaces),
  startHost: (input: StartHostInput): Promise<RemoteState> =>
    ipcRenderer.invoke(IPC.remote.startHost, input),
  stopHost: (): Promise<void> => ipcRenderer.invoke(IPC.remote.stopHost),
  generatePairingCode: (): Promise<RemotePairingInfo> =>
    ipcRenderer.invoke(IPC.remote.generatePairingCode),
  connect: (code: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.remote.connect, code),
  disconnect: (): Promise<void> => ipcRenderer.invoke(IPC.remote.disconnect),
  sendClipboard: (): Promise<void> => ipcRenderer.invoke(IPC.remote.sendClipboard),
  sendFile: (): Promise<void> => ipcRenderer.invoke(IPC.remote.sendFile),

  // Fire-and-forget, high-frequency channels.
  sendInput: (event: RemoteInputEvent): void => ipcRenderer.send(IPC.remote.sendInput, event),
  setScreenInfo: (size: RemoteScreenSize): void => ipcRenderer.send(IPC.remote.setScreenInfo, size),
  hostTile: (tile: ArrayBuffer): void => ipcRenderer.send(IPC.remote.hostTile, tile),
  rtcSignal: (peerId: string, message: RemoteRtcMessage): void =>
    ipcRenderer.send(IPC.remote.rtcSignal, { peerId, message }),
  rtcPeerState: (peerId: string, connected: boolean): void =>
    ipcRenderer.send(IPC.remote.rtcPeerState, { peerId, connected }),

  onState: (cb: (state: RemoteState) => void): (() => void) => subscribe(IPC.remote.onState, cb),
  onRtcSignal: (cb: (payload: { peerId: string; message: RemoteRtcMessage }) => void): (() => void) =>
    subscribe(IPC.remote.onRtcSignal, cb),
  onRtcPeerGone: (cb: (peerId: string) => void): (() => void) =>
    subscribe(IPC.remote.onRtcPeerGone, cb),
  onCaptureRefresh: (cb: () => void): (() => void) => subscribe(IPC.remote.onCaptureRefresh, cb),
  onTileDemand: (cb: (demand: boolean) => void): (() => void) =>
    subscribe(IPC.remote.onTileDemand, cb),
  onCaptureStart: (cb: () => void): (() => void) => subscribe(IPC.remote.onCaptureStart, cb),
  onCaptureStop: (cb: () => void): (() => void) => subscribe(IPC.remote.onCaptureStop, cb),
  onFrameTile: (cb: (tile: Uint8Array) => void): (() => void) =>
    subscribe(IPC.remote.onFrameTile, cb),
  onScreenInfo: (cb: (size: RemoteScreenSize) => void): (() => void) =>
    subscribe(IPC.remote.onScreenInfo, cb),
  onFileProgress: (cb: (progress: RemoteFileProgress) => void): (() => void) =>
    subscribe(IPC.remote.onFileProgress, cb),
  onLog: (cb: (event: RemoteLogEvent) => void): (() => void) => subscribe(IPC.remote.onLog, cb),
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
  app: appInfo,
  cli,
  terminal,
  projects,
  skills,
  mcp,
  tools,
  fs,
  settings,
  templates,
  activity,
  shell: shellApi,
  window: windowControls,
  promptHistory,
  translate,
  ai,
  system,
  ipGeo,
  scheduledTasks,
  notifications,
  git,
  remote,
};

export type AgentmatApi = typeof agentmatApi;

contextBridge.exposeInMainWorld('agentmat', agentmatApi);
