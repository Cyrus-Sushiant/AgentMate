import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  AppNotification,
  BootstrapPlan,
  CliUpdateCheckResult,
  CustomDesktopPet,
  DetectedClaudeHook,
  InstalledCli,
  Project,
  ProjectDraft,
  ProjectDraftStatus,
  ProjectGithubAction,
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
  ToolUpdateCheckResult,
  ProviderUsage,
  UsageProviderConfig,
  UsageResetAlertSettings,
  UsageThresholdAlertSettings,
  DesktopWidgetInstance,
  DesktopPromptBuildWidgetInstance,
  OpenWidgetOptions,
  WidgetMode,
  WidgetSize,
  WidgetStyle,
} from '@agentmat/core';
import { IPC } from '../shared/ipcChannels';
import type { PetPipelineMessage, PetSnoozeState, PetWorkArea } from '../shared/pet';
import type { SpellcheckMenuPayload } from '../shared/spellcheck';
import type { GrammarCheckInput, GrammarCheckResult, GrammarLocalStatus } from '../shared/grammar';
import type {
  BootstrapResult,
  CreateTerminalOptions,
  CreateProjectInput,
  CreateProjectDraftInput,
  CreateScheduledTasksInput,
  FaviconResult,
  SaveTemplateInput,
  DirectoryEntry,
  InstalledSkillRecord,
  LocalSkillFolderPreview,
  SkillUpdateInfo,
  InstalledMcpServerRecord,
  SkillsShDetail,
  SkillsShSearchResult,
  InstallFromSkillsShInput,
  UiProPrerequisites,
  UiProUpdateCheck,
  RecordUiProInstallInput,
  AuditSourcePreview,
  AuditSourceSkill,
  RunSkillAuditInput,
  RunSkillAuditResult,
  SkillAuditRecord,
  AddPromptHistoryInput,
  PromptHistoryEntry,
  BackupExportResult,
  BackupImportResult,
  TranslateTextInput,
  TranscribeAudioInput,
  TranscribeAudioResult,
  SpeechModelProgress,
  SpeechModelState,
  AskAiInput,
  AskAiResult,
  OllamaConnectionTest,
  SystemStatsSample,
  TopResourceAppsResult,
  TopResourceKind,
  KillProcessResult,
  IpGeoInfo,
  DetectChatIdResult,
  NotificationSendResult,
  SendTestNotificationInput,
  ConfirmationForwardedPayload,
  GitStatus,
  GitOpResult,
  GitTagInfo,
  GitBranchHistory,
  RenameBranchInput,
  DeleteBranchInput,
  CreateTagInput,
  SuggestGitTextResult,
  SuggestTagResult,
  ApplyVersionInput,
  ApplyVersionResult,
  CreatePullRequestInput,
  CreatePullRequestResult,
  GitInitInput,
  GithubAccount,
  GithubActivity,
  GithubNotifications,
  GithubRepoLookup,
  CreateGithubRepoInput,
  CreateGithubRepoResult,
  ConnectRemoteInput,
  PackageScanResult,
  PackageUpdateProgress,
  PackageUpdateRequest,
  PackageUpdateResult,
  RemoteState,
  RemoteNetworkInterface,
  RemotePairingInfo,
  RemoteSavedServer,
  RemoteScreenSize,
  RemoteFileProgress,
  RemoteFileManagerEntry,
  RemoteLogEvent,
  StartHostInput,
  UpdateStatus,
  GithubPipelineActionResult,
  GithubRunCancelRequest,
  GithubWorkflowDispatchRequest,
  GithubWorkflowRefsResult,
  ProjectPipelineStatus,
  GithubActionsActivity,
  GithubActionsRunErrorInput,
  GithubActionsRunErrorResult,
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
  pauseDownload: (): Promise<void> => ipcRenderer.invoke(IPC.app.pauseDownload),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke(IPC.app.quitAndInstall),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void =>
      callback(status);
    ipcRenderer.on(IPC.app.onUpdateStatus, listener);
    return () => ipcRenderer.removeListener(IPC.app.onUpdateStatus, listener);
  },
  relaunch: (): Promise<void> => ipcRenderer.invoke(IPC.app.relaunch),
  /** A route that arrived while this window was still loading, or null. */
  pendingNavigate: (): Promise<string | null> => ipcRenderer.invoke(IPC.app.pendingNavigate),
  /** main asking the app window to show a route, e.g. after a click on the pet. */
  onNavigate: (callback: (route: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, route: string): void => callback(route);
    ipcRenderer.on(IPC.app.onNavigate, listener);
    return () => ipcRenderer.removeListener(IPC.app.onNavigate, listener);
  },
};

const backup = {
  export: (compress: boolean): Promise<BackupExportResult> =>
    ipcRenderer.invoke(IPC.backup.export, compress),
  import: (): Promise<BackupImportResult> => ipcRenderer.invoke(IPC.backup.import),
};

const cli = {
  detectAll: (force?: boolean): Promise<InstalledCli[]> =>
    ipcRenderer.invoke(IPC.cli.detectAll, force),
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
  reorder: (orderedIds: string[]): Promise<Project[]> =>
    ipcRenderer.invoke(IPC.projects.reorder, orderedIds),
  setPinned: (projectId: string, pinned: boolean): Promise<Project> =>
    ipcRenderer.invoke(IPC.projects.setPinned, projectId, pinned),
  bootstrap: (projectId: string): Promise<BootstrapResult> =>
    ipcRenderer.invoke(IPC.projects.bootstrap, projectId),
  bootstrapPlan: (projectId: string): Promise<BootstrapPlan> =>
    ipcRenderer.invoke(IPC.projects.bootstrapPlan, projectId),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.projects.pickFolder),
  /** Opens an image picker and returns the file inlined as a data URL, or null if cancelled. */
  pickIcon: (): Promise<string | null> => ipcRenderer.invoke(IPC.projects.pickIcon),
  /** Downloads a site's favicon; null when the site is unreachable or has no icon. */
  fetchFavicon: (siteUrl: string): Promise<FaviconResult | null> =>
    ipcRenderer.invoke(IPC.projects.fetchFavicon, siteUrl),
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
  /** `currentPath` seeds the dialog; it falls back to the projects folder from Settings. */
  pickLocalRepository: (currentPath?: string | null): Promise<string | null> =>
    ipcRenderer.invoke(IPC.skills.pickLocalRepository, currentPath ?? null),
  previewLocalRepository: (folderPath: string): Promise<LocalSkillFolderPreview> =>
    ipcRenderer.invoke(IPC.skills.previewLocalRepository, folderPath),
  onRepositoryChanged: (cb: (repositoryId: string) => void): (() => void) =>
    subscribe(IPC.skills.onRepositoryChanged, cb),
  install: (params: {
    projectId: string | null;
    repositoryId: string;
    skillId: string;
  }): Promise<void> => ipcRenderer.invoke(IPC.skills.install, params),
  remove: (params: { projectId: string | null; skillId: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.skills.remove, params),
  listInstalled: (projectId: string | null): Promise<InstalledSkillRecord[]> =>
    ipcRenderer.invoke(IPC.skills.listInstalled, projectId),
  checkForUpdates: (projectId: string | null): Promise<SkillUpdateInfo[]> =>
    ipcRenderer.invoke(IPC.skills.checkForUpdates, projectId),
  searchSkillsSh: (query: string): Promise<SkillsShSearchResult[]> =>
    ipcRenderer.invoke(IPC.skills.searchSkillsSh, query),
  getSkillsShDetail: (skillPath: string): Promise<SkillsShDetail> =>
    ipcRenderer.invoke(IPC.skills.getSkillsShDetail, skillPath),
  recordSkillsShInstall: (input: InstallFromSkillsShInput): Promise<void> =>
    ipcRenderer.invoke(IPC.skills.recordSkillsShInstall, input),
  checkUiProPrerequisites: (): Promise<UiProPrerequisites> =>
    ipcRenderer.invoke(IPC.skills.checkUiProPrerequisites),
  /** Compares the installed `uipro` CLI against the latest release on npm. */
  checkUiProUpdate: (): Promise<UiProUpdateCheck> =>
    ipcRenderer.invoke(IPC.skills.checkUiProUpdate),
  recordUiProInstall: (input: RecordUiProInstallInput): Promise<void> =>
    ipcRenderer.invoke(IPC.skills.recordUiProInstall, input),
  /** Scans a skill for prompt injection, exfiltration, and the other risk categories. */
  runAudit: (input: RunSkillAuditInput): Promise<RunSkillAuditResult> =>
    ipcRenderer.invoke(IPC.skills.runAudit, input),
  /** Stops the CLI review half of an audit started with the same requestId. */
  cancelAudit: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.skills.cancelAudit, requestId),
  /** Lists the skills at a folder path or GitHub address, so either can be checked ad hoc. */
  previewAuditSource: (input: string): Promise<AuditSourcePreview> =>
    ipcRenderer.invoke(IPC.skills.previewAuditSource, input),
  /** Skills present in a project's (or the global) skills dirs, installed by AgentMate or not. */
  listOnDiskSkills: (projectId: string | null): Promise<AuditSourceSkill[]> =>
    ipcRenderer.invoke(IPC.skills.listOnDiskSkills, projectId),
  listAudits: (options?: {
    skillId?: string | null;
    limit?: number;
  }): Promise<SkillAuditRecord[]> => ipcRenderer.invoke(IPC.skills.listAudits, options ?? {}),
  latestAuditPerSkill: (): Promise<SkillAuditRecord[]> =>
    ipcRenderer.invoke(IPC.skills.latestAuditPerSkill),
  getAudit: (id: string): Promise<SkillAuditRecord | null> =>
    ipcRenderer.invoke(IPC.skills.getAudit, id),
  removeAudit: (id: string): Promise<void> => ipcRenderer.invoke(IPC.skills.removeAudit, id),
  clearAudits: (): Promise<void> => ipcRenderer.invoke(IPC.skills.clearAudits),
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
  checkForUpdate: (toolId: string, currentVersion: string | null): Promise<ToolUpdateCheckResult> =>
    ipcRenderer.invoke(IPC.tools.checkForUpdate, toolId, currentVersion),
  getUpdateCommand: (toolId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.tools.getUpdateCommand, toolId),
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
  /** Pass a projectId to get only that project's entries. */
  list: (projectId?: string | null): Promise<PromptHistoryEntry[]> =>
    ipcRenderer.invoke(IPC.promptHistory.list, projectId),
  search: (query: string, projectId?: string | null): Promise<PromptHistoryEntry[]> =>
    ipcRenderer.invoke(IPC.promptHistory.search, query, projectId),
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
  /** Aborts an in-flight ask() that was given the same requestId. */
  cancel: (requestId: string): Promise<boolean> => ipcRenderer.invoke(IPC.ai.cancel, requestId),
  /** Lists installed Ollama models. Pass a baseUrl to probe a server that hasn't been saved yet. */
  listOllamaModels: (baseUrl?: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC.ai.listOllamaModels, baseUrl),
  /** Pings an Ollama server and reports its version and how many models it has. */
  testOllama: (baseUrl?: string): Promise<OllamaConnectionTest> =>
    ipcRenderer.invoke(IPC.ai.testOllama, baseUrl),
  listGeminiModels: (): Promise<string[]> => ipcRenderer.invoke(IPC.ai.listGeminiModels),
};

const speech = {
  transcribe: (input: TranscribeAudioInput): Promise<TranscribeAudioResult> =>
    ipcRenderer.invoke(IPC.speech.transcribe, input),
  getModelState: (): Promise<SpeechModelState> => ipcRenderer.invoke(IPC.speech.getModelState),
  onModelProgress: (callback: (progress: SpeechModelProgress) => void): (() => void) =>
    subscribe(IPC.speech.onModelProgress, callback),
};

const system = {
  sample: (): Promise<SystemStatsSample> => ipcRenderer.invoke(IPC.system.sample),
  topApps: (resource: TopResourceKind): Promise<TopResourceAppsResult> =>
    ipcRenderer.invoke(IPC.system.topApps, resource),
  killProcess: (pid: number): Promise<KillProcessResult> =>
    ipcRenderer.invoke(IPC.system.killProcess, pid),
};

const ipGeo = {
  lookup: (force?: boolean): Promise<IpGeoInfo> => ipcRenderer.invoke(IPC.ipGeo.lookup, force),
};

const projectDrafts = {
  listByProject: (projectId: string): Promise<ProjectDraft[]> =>
    ipcRenderer.invoke(IPC.projectDrafts.listByProject, projectId),
  create: (input: CreateProjectDraftInput): Promise<ProjectDraft> =>
    ipcRenderer.invoke(IPC.projectDrafts.create, input),
  updateStatus: (draftId: string, status: ProjectDraftStatus): Promise<void> =>
    ipcRenderer.invoke(IPC.projectDrafts.updateStatus, draftId, status),
  remove: (draftId: string): Promise<void> => ipcRenderer.invoke(IPC.projectDrafts.remove, draftId),
};

const promptBuildWidget = {
  listWidgets: (): Promise<DesktopPromptBuildWidgetInstance[]> =>
    ipcRenderer.invoke(IPC.promptBuildWidget.listWidgets),
  getWidget: (id: string): Promise<DesktopPromptBuildWidgetInstance | null> =>
    ipcRenderer.invoke(IPC.promptBuildWidget.getWidget, id),
  openWidget: (projectId: string, projectName: string): Promise<DesktopPromptBuildWidgetInstance> =>
    ipcRenderer.invoke(IPC.promptBuildWidget.openWidget, projectId, projectName),
  closeWidget: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.promptBuildWidget.closeWidget, id),
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
  /** Shows the message on the desktop companion, so the pet hook can be previewed. */
  sendPetTest: (input: SendTestNotificationInput): Promise<NotificationSendResult> =>
    ipcRenderer.invoke(IPC.notifications.sendPetTest, input),
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
  listFiles: (projectId: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC.git.listFiles, projectId),
  changeSummary: (projectId: string): Promise<string> =>
    ipcRenderer.invoke(IPC.git.changeSummary, projectId),
  fetch: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.fetch, projectId),
  pull: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.pull, projectId),
  push: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.push, projectId),
  sync: (projectId: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.sync, projectId),
  createBranch: (projectId: string, branchName: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.createBranch, projectId, branchName),
  checkoutBranch: (projectId: string, branchName: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.checkoutBranch, projectId, branchName),
  setDefaultBranch: (projectId: string, branchName: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.setDefaultBranch, projectId, branchName),
  renameBranch: (input: RenameBranchInput): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.renameBranch, input),
  deleteBranch: (input: DeleteBranchInput): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.deleteBranch, input),
  branchHistory: (projectId: string, branchName: string): Promise<GitBranchHistory> =>
    ipcRenderer.invoke(IPC.git.branchHistory, projectId, branchName),
  commit: (projectId: string, message: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.commit, projectId, message),
  tags: (projectId: string): Promise<GitTagInfo> => ipcRenderer.invoke(IPC.git.tags, projectId),
  createTag: (input: CreateTagInput): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.createTag, input),
  suggestTag: (projectId: string, requestId?: string): Promise<SuggestTagResult> =>
    ipcRenderer.invoke(IPC.git.suggestTag, projectId, requestId),
  /** Kills the CLI process behind an in-flight suggestTag(requestId). */
  cancelSuggestTag: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.git.cancelSuggestTag, requestId),
  /** Runs the CLI over the project's files to bump every version string to `tag`. */
  applyVersion: (input: ApplyVersionInput): Promise<ApplyVersionResult> =>
    ipcRenderer.invoke(IPC.git.applyVersion, input),
  cancelApplyVersion: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.git.cancelApplyVersion, requestId),
  suggestBranchName: (projectId: string, requestId?: string): Promise<SuggestGitTextResult> =>
    ipcRenderer.invoke(IPC.git.suggestBranchName, projectId, requestId),
  /** Kills the CLI process behind an in-flight suggestBranchName(requestId). */
  cancelSuggestBranchName: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.git.cancelSuggestBranchName, requestId),
  suggestCommitMessage: (projectId: string, requestId?: string): Promise<SuggestGitTextResult> =>
    ipcRenderer.invoke(IPC.git.suggestCommitMessage, projectId, requestId),
  /** Kills the CLI process behind an in-flight suggestCommitMessage(requestId). */
  cancelSuggestCommitMessage: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.git.cancelSuggestCommitMessage, requestId),
  createPullRequest: (input: CreatePullRequestInput): Promise<CreatePullRequestResult> =>
    ipcRenderer.invoke(IPC.git.createPullRequest, input),
  /** Creates the repository in the project folder, on the branch the caller picked. */
  init: (input: GitInitInput): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.init, input),
  /** Who the GitHub CLI is signed in as, plus the organizations that account belongs to. */
  githubAccount: (): Promise<GithubAccount> => ipcRenderer.invoke(IPC.git.githubAccount),
  /** Contribution counts for the signed-in GitHub user, used by the dashboard chart. */
  githubActivity: (): Promise<GithubActivity> => ipcRenderer.invoke(IPC.git.githubActivity),
  /** Unread GitHub notifications for the signed-in account. */
  githubNotifications: (): Promise<GithubNotifications> =>
    ipcRenderer.invoke(IPC.git.githubNotifications),
  /** Marks one GitHub notification thread as read. */
  githubMarkNotificationRead: (threadId: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.githubMarkNotificationRead, threadId),
  /** Marks every unread GitHub notification as read. */
  githubMarkNotificationsRead: (): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.githubMarkNotificationsRead),
  lookupGithubRepo: (owner: string, name: string): Promise<GithubRepoLookup> =>
    ipcRenderer.invoke(IPC.git.lookupGithubRepo, owner, name),
  createGithubRepo: (input: CreateGithubRepoInput): Promise<CreateGithubRepoResult> =>
    ipcRenderer.invoke(IPC.git.createGithubRepo, input),
  /** Points origin at `url`, and optionally pushes the current branch with -u. */
  connectRemote: (input: ConnectRemoteInput): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.connectRemote, input),
  /** Origin's URL for a folder path, as a browsable link. Null when there isn't one. */
  detectRemote: (folderPath: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.git.detectRemote, folderPath),
};

const pipelines = {
  status: (projectId: string): Promise<ProjectPipelineStatus> =>
    ipcRenderer.invoke(IPC.pipelines.status, projectId),
  setWatched: (projectId: string, actions: ProjectGithubAction[]): Promise<ProjectPipelineStatus> =>
    ipcRenderer.invoke(IPC.pipelines.setWatched, projectId, actions),
  dashboardActivity: (): Promise<GithubActionsActivity> =>
    ipcRenderer.invoke(IPC.pipelines.dashboardActivity),
  runError: (input: GithubActionsRunErrorInput): Promise<GithubActionsRunErrorResult> =>
    ipcRenderer.invoke(IPC.pipelines.runError, input),
  /** Branches and tags a manual run can be started from. */
  refs: (repo: string): Promise<GithubWorkflowRefsResult> =>
    ipcRenderer.invoke(IPC.pipelines.refs, repo),
  /** Starts a workflow by hand, the way GitHub's "Run workflow" button does. */
  dispatch: (input: GithubWorkflowDispatchRequest): Promise<GithubPipelineActionResult> =>
    ipcRenderer.invoke(IPC.pipelines.dispatch, input),
  /** Stops a queued or in-progress run. */
  cancelRun: (input: GithubRunCancelRequest): Promise<GithubPipelineActionResult> =>
    ipcRenderer.invoke(IPC.pipelines.cancelRun, input),
};

const appNotifications = {
  list: (): Promise<AppNotification[]> => ipcRenderer.invoke(IPC.appNotifications.list),
  unreadCount: (): Promise<number> => ipcRenderer.invoke(IPC.appNotifications.unreadCount),
  markRead: (notificationId: string): Promise<AppNotification[]> =>
    ipcRenderer.invoke(IPC.appNotifications.markRead, notificationId),
  markAllRead: (): Promise<AppNotification[]> =>
    ipcRenderer.invoke(IPC.appNotifications.markAllRead),
  remove: (notificationId: string): Promise<AppNotification[]> =>
    ipcRenderer.invoke(IPC.appNotifications.remove, notificationId),
  onChanged: (callback: () => void): (() => void) =>
    subscribe(IPC.appNotifications.onChanged, callback),
};

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const packages = {
  list: (projectId: string): Promise<PackageScanResult> =>
    ipcRenderer.invoke(IPC.packages.list, projectId),
  update: (projectId: string, updates: PackageUpdateRequest[]): Promise<PackageUpdateResult> =>
    ipcRenderer.invoke(IPC.packages.update, projectId, updates),
  onUpdateProgress: (cb: (progress: PackageUpdateProgress) => void): (() => void) =>
    subscribe(IPC.packages.onUpdateProgress, cb),
};

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
  connectFiles: (code: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.remote.connectFiles, code),
  disconnect: (): Promise<void> => ipcRenderer.invoke(IPC.remote.disconnect),
  listSavedServers: (): Promise<RemoteSavedServer[]> =>
    ipcRenderer.invoke(IPC.remote.listSavedServers),
  connectSaved: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.remote.connectSaved, id),
  connectSavedFiles: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.remote.connectSavedFiles, id),
  renameSavedServer: (id: string, nickname: string): Promise<void> =>
    ipcRenderer.invoke(IPC.remote.renameSavedServer, id, nickname),
  removeSavedServer: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.remote.removeSavedServer, id),
  openSessionWindow: (): Promise<void> => ipcRenderer.invoke(IPC.remote.openSessionWindow),
  sendClipboard: (): Promise<void> => ipcRenderer.invoke(IPC.remote.sendClipboard),
  sendFile: (): Promise<void> => ipcRenderer.invoke(IPC.remote.sendFile),
  getFileProgress: (): Promise<RemoteFileProgress[]> =>
    ipcRenderer.invoke(IPC.remote.getFileProgress),

  // Remote file manager: browse/mkdir/delete/rename/upload/download on the peer's filesystem.
  fmRoots: (): Promise<RemoteFileManagerEntry[]> => ipcRenderer.invoke(IPC.remote.fmRoots),
  fmList: (path: string | null): Promise<{ path: string; entries: RemoteFileManagerEntry[] }> =>
    ipcRenderer.invoke(IPC.remote.fmList, path),
  fmMkdir: (parentPath: string, name: string): Promise<void> =>
    ipcRenderer.invoke(IPC.remote.fmMkdir, parentPath, name),
  fmDelete: (path: string): Promise<void> => ipcRenderer.invoke(IPC.remote.fmDelete, path),
  fmRename: (path: string, newName: string): Promise<void> =>
    ipcRenderer.invoke(IPC.remote.fmRename, path, newName),
  fmUploadTo: (destDir: string): Promise<void> =>
    ipcRenderer.invoke(IPC.remote.fmUploadTo, destDir),
  fmDownload: (path: string): Promise<void> => ipcRenderer.invoke(IPC.remote.fmDownload, path),

  // Fire-and-forget, high-frequency channels.
  sendInput: (event: RemoteInputEvent): void => ipcRenderer.send(IPC.remote.sendInput, event),
  setScreenInfo: (size: RemoteScreenSize): void => ipcRenderer.send(IPC.remote.setScreenInfo, size),
  setDisplaySize: (size: RemoteScreenSize): void =>
    ipcRenderer.send(IPC.remote.setDisplaySize, size),
  hostTile: (tile: ArrayBuffer): void => ipcRenderer.send(IPC.remote.hostTile, tile),
  rtcSignal: (peerId: string, message: RemoteRtcMessage): void =>
    ipcRenderer.send(IPC.remote.rtcSignal, { peerId, message }),
  rtcPeerState: (peerId: string, connected: boolean): void =>
    ipcRenderer.send(IPC.remote.rtcPeerState, { peerId, connected }),
  clientRtcSignal: (message: RemoteRtcMessage): void =>
    ipcRenderer.send(IPC.remote.clientRtcSignal, message),
  rtcInput: (peerId: string, event: RemoteInputEvent): void =>
    ipcRenderer.send(IPC.remote.rtcInput, { peerId, event }),
  setCursorTracking: (enabled: boolean): void =>
    ipcRenderer.send(IPC.remote.setCursorTracking, enabled),
  benchSample: (): Promise<{ cpu: number; memory: number; at: number }> =>
    ipcRenderer.invoke(IPC.remote.benchSample),

  onState: (cb: (state: RemoteState) => void): (() => void) => subscribe(IPC.remote.onState, cb),
  onRtcSignal: (
    cb: (payload: { peerId: string; message: RemoteRtcMessage }) => void,
  ): (() => void) => subscribe(IPC.remote.onRtcSignal, cb),
  onRtcPeerGone: (cb: (peerId: string) => void): (() => void) =>
    subscribe(IPC.remote.onRtcPeerGone, cb),
  onClientRtcSignal: (cb: (message: RemoteRtcMessage) => void): (() => void) =>
    subscribe(IPC.remote.onClientRtcSignal, cb),
  onHostCursor: (cb: (point: { x: number; y: number; visible: boolean }) => void): (() => void) =>
    subscribe(IPC.remote.onHostCursor, cb),
  onCaptureRefresh: (cb: () => void): (() => void) => subscribe(IPC.remote.onCaptureRefresh, cb),
  onTileDemand: (cb: (demand: boolean) => void): (() => void) =>
    subscribe(IPC.remote.onTileDemand, cb),
  onCaptureStart: (cb: () => void): (() => void) => subscribe(IPC.remote.onCaptureStart, cb),
  onCaptureStop: (cb: () => void): (() => void) => subscribe(IPC.remote.onCaptureStop, cb),
  onFrameTile: (cb: (tile: Uint8Array) => void): (() => void) =>
    subscribe(IPC.remote.onFrameTile, cb),
  onScreenInfo: (cb: (size: RemoteScreenSize) => void): (() => void) =>
    subscribe(IPC.remote.onScreenInfo, cb),
  onPeerDisplaySize: (
    cb: (payload: { peerId: string; width: number; height: number }) => void,
  ): (() => void) => subscribe(IPC.remote.onPeerDisplaySize, cb),
  onFileProgress: (cb: (progress: RemoteFileProgress) => void): (() => void) =>
    subscribe(IPC.remote.onFileProgress, cb),
  onLog: (cb: (event: RemoteLogEvent) => void): (() => void) => subscribe(IPC.remote.onLog, cb),
};

const usage = {
  list: (): Promise<ProviderUsage[]> => ipcRenderer.invoke(IPC.usage.list),
  get: (providerId: string): Promise<ProviderUsage> =>
    ipcRenderer.invoke(IPC.usage.get, providerId),
  refresh: (): Promise<ProviderUsage[]> => ipcRenderer.invoke(IPC.usage.refresh),
  setProviderConfig: (providerId: string, config: UsageProviderConfig): Promise<void> =>
    ipcRenderer.invoke(IPC.usage.setProviderConfig, { providerId, config }),
  setResetAlerts: (alerts: UsageResetAlertSettings): Promise<void> =>
    ipcRenderer.invoke(IPC.usage.setResetAlerts, alerts),
  testResetAlert: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.usage.testResetAlert),
  setThresholdAlerts: (alerts: UsageThresholdAlertSettings): Promise<void> =>
    ipcRenderer.invoke(IPC.usage.setThresholdAlerts, alerts),
  testThresholdAlert: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.usage.testThresholdAlert),
  onThresholdAlert: (callback: (payload: { title: string; body: string }) => void): (() => void) =>
    subscribe(IPC.usage.onThresholdAlert, callback),
  listWidgets: (): Promise<DesktopWidgetInstance[]> => ipcRenderer.invoke(IPC.usage.listWidgets),
  getWidget: (id: string): Promise<DesktopWidgetInstance | null> =>
    ipcRenderer.invoke(IPC.usage.getWidget, id),
  openWidget: (providerId: string, options?: OpenWidgetOptions): Promise<DesktopWidgetInstance> =>
    ipcRenderer.invoke(IPC.usage.openWidget, providerId, options),
  closeWidget: (id: string): Promise<void> => ipcRenderer.invoke(IPC.usage.closeWidget, id),
  setWidgetStyle: (id: string, style: WidgetStyle): Promise<void> =>
    ipcRenderer.invoke(IPC.usage.setWidgetStyle, id, style),
  setWidgetSize: (id: string, size: WidgetSize): Promise<void> =>
    ipcRenderer.invoke(IPC.usage.setWidgetSize, id, size),
  setWidgetMode: (id: string, mode: WidgetMode): Promise<void> =>
    ipcRenderer.invoke(IPC.usage.setWidgetMode, id, mode),
  configureWidget: (id: string, patch: OpenWidgetOptions): Promise<void> =>
    ipcRenderer.invoke(IPC.usage.configureWidget, id, patch),
  onWidgetUpdated: (callback: (payload: { id: string }) => void): (() => void) =>
    subscribe(IPC.usage.onWidgetUpdated, callback),
};

const pet = {
  setClickThrough: (ignore: boolean): void => ipcRenderer.send(IPC.pet.setClickThrough, ignore),
  getWorkArea: (): Promise<PetWorkArea> => ipcRenderer.invoke(IPC.pet.getWorkArea),
  onDisplayChanged: (callback: (area: PetWorkArea) => void): (() => void) =>
    subscribe(IPC.pet.onDisplayChanged, callback),
  onSettingsChanged: (callback: () => void): (() => void) =>
    subscribe(IPC.pet.onSettingsChanged, callback),
  onPipelineMessage: (callback: (payload: PetPipelineMessage) => void): (() => void) =>
    subscribe(IPC.pet.onPipelineMessage, callback),
  importCustom: (): Promise<CustomDesktopPet | null> => ipcRenderer.invoke(IPC.pet.importCustom),
  removeCustom: (id: string): Promise<void> => ipcRenderer.invoke(IPC.pet.removeCustom, id),
  customDataUrls: (): Promise<Record<string, string>> => ipcRenderer.invoke(IPC.pet.customDataUrls),
  snooze: (minutes: number): Promise<PetSnoozeState> => ipcRenderer.invoke(IPC.pet.snooze, minutes),
  cancelSnooze: (): Promise<PetSnoozeState> => ipcRenderer.invoke(IPC.pet.cancelSnooze),
  getSnooze: (): Promise<PetSnoozeState> => ipcRenderer.invoke(IPC.pet.getSnooze),
  onSnoozeChanged: (callback: (state: PetSnoozeState) => void): (() => void) =>
    subscribe(IPC.pet.onSnoozeChanged, callback),
  showMainWindow: (route?: string): void => ipcRenderer.send(IPC.pet.showMainWindow, route),
};

const spellcheck = {
  onShowMenu: (callback: (payload: SpellcheckMenuPayload) => void): (() => void) =>
    subscribe(IPC.spellcheck.onShowMenu, callback),
  /** Resolves false when the platform has no custom dictionary (macOS). */
  addToDictionary: (word: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.spellcheck.addToDictionary, word),
};

const grammar = {
  /** Resolves with no issues when grammar checking is off, so callers don't have to check first. */
  check: (input: GrammarCheckInput): Promise<GrammarCheckResult> =>
    ipcRenderer.invoke(IPC.grammar.check, input),
  localStatus: (): Promise<GrammarLocalStatus> => ipcRenderer.invoke(IPC.grammar.localStatus),
  /** Starts the server if it isn't up; resolves with the status either way, error included. */
  startLocal: (): Promise<GrammarLocalStatus> => ipcRenderer.invoke(IPC.grammar.startLocal),
  stopLocal: (): Promise<GrammarLocalStatus> => ipcRenderer.invoke(IPC.grammar.stopLocal),
  /** Resolves with the folder that was opened. */
  openToolsFolder: (): Promise<string> => ipcRenderer.invoke(IPC.grammar.openToolsFolder),
  onLocalStatus: (callback: (status: GrammarLocalStatus) => void): (() => void) =>
    subscribe(IPC.grammar.onLocalStatus, callback),
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

const remoteSessionWindowControls = {
  minimize: (): Promise<void> => ipcRenderer.invoke(IPC.remoteSessionWindow.minimize),
  maximizeToggle: (): Promise<void> => ipcRenderer.invoke(IPC.remoteSessionWindow.maximizeToggle),
  close: (): Promise<void> => ipcRenderer.invoke(IPC.remoteSessionWindow.close),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.remoteSessionWindow.isMaximized),
  onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void =>
      callback(isMaximized);
    ipcRenderer.on(IPC.remoteSessionWindow.onMaximizedChange, listener);
    return () => ipcRenderer.removeListener(IPC.remoteSessionWindow.onMaximizedChange, listener);
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
  spellcheck,
  grammar,
  window: windowControls,
  remoteSessionWindow: remoteSessionWindowControls,
  promptHistory,
  translate,
  ai,
  speech,
  system,
  ipGeo,
  projectDrafts,
  promptBuildWidget,
  scheduledTasks,
  notifications,
  git,
  pipelines,
  appNotifications,
  packages,
  remote,
  usage,
  pet,
  backup,
};

export type AgentmatApi = typeof agentmatApi;

contextBridge.exposeInMainWorld('agentmat', agentmatApi);
