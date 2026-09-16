import type {
  ActivityEvent,
  AgentHistorySession,
  AppNotification,
  AppSettings,
  BlueprintPreset,
  BlueprintRevision,
  BlueprintStepId,
  BootstrapPlan,
  CliUpdateCheckResult,
  CodeqlInstallProgress,
  CodeqlLocalStatus,
  CustomDesktopPet,
  DesktopPromptBuildWidgetInstance,
  DesktopWidgetInstance,
  DetectedClaudeHook,
  GitChangeEntry,
  InstalledAgentTool,
  InstalledCli,
  KeepAwakeMode,
  McpRepository,
  McpRepositoryIndex,
  McpRepositorySourceType,
  OpenWidgetOptions,
  Project,
  ProjectBlueprint,
  ProjectDraft,
  ProjectDraftStatus,
  ProjectGithubAction,
  ProjectNotificationSettings,
  PromptTemplate,
  ProviderUsage,
  ProxySettings,
  ScannerPreflight,
  ScheduledTask,
  ScheduledTaskStatus,
  SecurityScannerSettings,
  SecurityScanOptions,
  SecurityScanProgress,
  SecurityScanRecord,
  SkillRepository,
  SkillRepositoryIndex,
  SkillRepositorySourceType,
  ToolUpdateCheckResult,
  UsageProviderConfig,
  UsageResetAlertSettings,
  UsageThresholdAlertSettings,
  WidgetMode,
  WidgetSize,
  WidgetStyle,
} from '@agentmat/core';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ActiveScan,
  AddPromptHistoryInput,
  AgentRunInfoMap,
  AgentSessionEntry,
  AgentStatusMap,
  ApplyVersionInput,
  ApplyVersionResult,
  AskAiInput,
  AskAiResult,
  AssessRunInput,
  AssessRunResult,
  AuditSourcePreview,
  AuditSourceSkill,
  BackupExportResult,
  BackupImportResult,
  BlueprintAgentFileResult,
  BlueprintAgentFileTarget,
  BlueprintAttachmentInput,
  BlueprintAttachmentResult,
  BlueprintSectionPatch,
  BootstrapResult,
  ConfirmationForwardedPayload,
  ConnectRemoteInput,
  CreateGithubRepoInput,
  CreateGithubRepoResult,
  CreateProjectDraftInput,
  CreateProjectInput,
  CreatePullRequestInput,
  CreatePullRequestResult,
  CreateScheduledTasksInput,
  CreateSshSessionOptions,
  CreateTagInput,
  CreateTerminalOptions,
  DeleteBranchInput,
  DetectChatIdResult,
  DirectoryEntry,
  DockerActionResult,
  DockerContainer,
  DockerRemoveOptions,
  FaviconResult,
  FavoriteSkillInput,
  FavoriteSkillRecord,
  GitBranchHistory,
  GitDiffSide,
  GitDiscardResult,
  GitFileDiff,
  GithubAccount,
  GithubActionsActivity,
  GithubActionsRunErrorInput,
  GithubActionsRunErrorResult,
  GithubActivity,
  GithubNotifications,
  GithubPipelineActionResult,
  GithubRepoLookup,
  GithubRunAnnotationsInput,
  GithubRunAnnotationsResult,
  GithubRunCancelRequest,
  GithubWorkflowDispatchRequest,
  GithubWorkflowRefsResult,
  GitInitInput,
  GitOpResult,
  GitStatus,
  GitTagInfo,
  InstalledMcpServerRecord,
  InstalledSkillRecord,
  InstallFromSkillsShInput,
  IpGeoInfo,
  KeepAwakeStatus,
  KillProcessResult,
  LocalSkillFolderPreview,
  NotificationSendResult,
  OllamaConnectionTest,
  PackageScanResult,
  PackageUpdateProgress,
  PackageUpdateRequest,
  PackageUpdateResult,
  ProjectPipelineStatus,
  PromptHistoryEntry,
  ProxyStatus,
  ProxyTestResult,
  RecordUiProInstallInput,
  RemoteFileManagerEntry,
  RemoteFileProgress,
  RemoteLogEvent,
  RemoteNetworkInterface,
  RemotePairingInfo,
  RemoteSavedServer,
  RemoteScreenSize,
  RemoteState,
  RenameBranchInput,
  RunSkillAuditInput,
  RunSkillAuditResult,
  SaveBlueprintPresetInput,
  SaveSshServerInput,
  SaveTemplateInput,
  SendTestNotificationInput,
  SkillAuditRecord,
  SkillsShDetail,
  SkillsShSearchResult,
  SkillUpdateInfo,
  SkillUsageReport,
  SpeechModelProgress,
  SpeechModelState,
  SshAgentProgress,
  SshAttachResult,
  SshDataPayload,
  SshExitPayload,
  SshSavedServer,
  SshVaultStatus,
  StartHostInput,
  StartSshAgentTaskInput,
  SuggestGitTextResult,
  SuggestTagResult,
  SwapVersionFileInput,
  SystemStatsSample,
  TerminalAttachResult,
  TerminalClipboardPaste,
  TerminalUsageResult,
  TopResourceAppsResult,
  TopResourceKind,
  TranscribeAudioInput,
  TranscribeAudioResult,
  TranslateTextInput,
  UiProPrerequisites,
  UiProUpdateCheck,
  UpdateStatus,
  WorkspaceGitState,
} from '../shared/apiTypes';
import type { GrammarCheckInput, GrammarCheckResult, GrammarLocalStatus } from '../shared/grammar';
import { IPC } from '../shared/ipcChannels';
import type { PetPipelineMessage, PetSnoozeState, PetWorkArea } from '../shared/pet';
import type { RemoteInputEvent, RemoteRtcMessage } from '../shared/remoteProtocol';
import type { SpellcheckMenuPayload } from '../shared/spellcheck';

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
  /** Starts a shell, or reconnects to a running one when `sessionId` names it. */
  create: (options: CreateTerminalOptions = {}): Promise<TerminalAttachResult | null> =>
    ipcRenderer.invoke(IPC.terminal.create, options),
  write: (sessionId: string, data: string): Promise<void> =>
    ipcRenderer.invoke(IPC.terminal.write, sessionId, data),
  resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke(IPC.terminal.resize, sessionId, cols, rows),
  kill: (sessionId: string): Promise<void> => ipcRenderer.invoke(IPC.terminal.kill, sessionId),
  /** Every running shell with the CPU and memory its whole process tree is using. */
  usage: (): Promise<TerminalUsageResult> => ipcRenderer.invoke(IPC.terminal.usage),
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

const ssh = {
  listServers: (): Promise<SshSavedServer[]> => ipcRenderer.invoke(IPC.ssh.listServers),
  saveServer: (input: SaveSshServerInput): Promise<SshSavedServer> =>
    ipcRenderer.invoke(IPC.ssh.saveServer, input),
  removeServer: (id: string): Promise<void> => ipcRenderer.invoke(IPC.ssh.removeServer, id),
  pickPrivateKeyFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.ssh.pickPrivateKeyFile),
  vaultStatus: (): Promise<SshVaultStatus> => ipcRenderer.invoke(IPC.ssh.vaultStatus),
  unlockVault: (passphrase: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.ssh.unlockVault, passphrase),
  setPasskey: (passphrase: string | null): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.ssh.setPasskey, passphrase),
  /** Starts a shell for a saved server, or reconnects when `sessionId` names one still running. */
  create: (options: CreateSshSessionOptions): Promise<SshAttachResult> =>
    ipcRenderer.invoke(IPC.ssh.create, options),
  write: (sessionId: string, data: string): Promise<void> =>
    ipcRenderer.invoke(IPC.ssh.write, sessionId, data),
  resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke(IPC.ssh.resize, sessionId, cols, rows),
  kill: (sessionId: string): Promise<void> => ipcRenderer.invoke(IPC.ssh.kill, sessionId),
  onData: (callback: (payload: SshDataPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SshDataPayload): void =>
      callback(payload);
    ipcRenderer.on(IPC.ssh.onData, listener);
    return () => ipcRenderer.removeListener(IPC.ssh.onData, listener);
  },
  onExit: (callback: (payload: SshExitPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SshExitPayload): void =>
      callback(payload);
    ipcRenderer.on(IPC.ssh.onExit, listener);
    return () => ipcRenderer.removeListener(IPC.ssh.onExit, listener);
  },
};

const sshAgent = {
  /** Starts an AI task in an already-connected SSH session; rejects if one is already running there. */
  start: (input: StartSshAgentTaskInput): Promise<void> =>
    ipcRenderer.invoke(IPC.sshAgent.start, input),
  approveCommand: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.sshAgent.approveCommand, sessionId),
  skipCommand: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.sshAgent.skipCommand, sessionId),
  answerNeedsInput: (sessionId: string, answer: string): Promise<void> =>
    ipcRenderer.invoke(IPC.sshAgent.answerNeedsInput, sessionId, answer),
  stop: (sessionId: string): Promise<void> => ipcRenderer.invoke(IPC.sshAgent.stop, sessionId),
  onProgress: (callback: (progress: SshAgentProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: SshAgentProgress): void =>
      callback(progress);
    ipcRenderer.on(IPC.sshAgent.onProgress, listener);
    return () => ipcRenderer.removeListener(IPC.sshAgent.onProgress, listener);
  },
};

const power = {
  keepAwakeStatus: (): Promise<KeepAwakeStatus> => ipcRenderer.invoke(IPC.power.keepAwakeStatus),
  setKeepAwake: (mode: KeepAwakeMode): Promise<KeepAwakeStatus> =>
    ipcRenderer.invoke(IPC.power.setKeepAwake, mode),
  onKeepAwake: (callback: (status: KeepAwakeStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: KeepAwakeStatus): void =>
      callback(status);
    ipcRenderer.on(IPC.power.onKeepAwake, listener);
    return () => ipcRenderer.removeListener(IPC.power.onKeepAwake, listener);
  },
};

const agents = {
  /** Tells main which workspace tabs exist, so it can follow their agents' status. */
  sync: (entries: AgentSessionEntry[]): Promise<void> =>
    ipcRenderer.invoke(IPC.agents.sync, entries),
  /** The tabs on screen right now; finishing while visible and focused raises no notification. */
  setViewing: (visible: string[], focused: string | null): Promise<void> =>
    ipcRenderer.invoke(IPC.agents.setViewing, visible, focused),
  acknowledge: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.agents.acknowledge, sessionId),
  list: (): Promise<AgentStatusMap> => ipcRenderer.invoke(IPC.agents.list),
  /**
   * A settings file to pass as `--settings` when launching this CLI, which reports its status
   * back through hooks. Null when the CLI has no such hooks or they cannot run here.
   */
  statusHookSettings: (cliId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.agents.statusHookSettings, cliId),
  /** The model and effort each agent last reported. */
  runInfos: (): Promise<AgentRunInfoMap> => ipcRenderer.invoke(IPC.agents.runInfos),
  history: (projectId: string): Promise<AgentHistorySession[]> =>
    ipcRenderer.invoke(IPC.agents.history, projectId),
  onRunInfo: (callback: (changes: AgentRunInfoMap) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, changes: AgentRunInfoMap): void =>
      callback(changes);
    ipcRenderer.on(IPC.agents.onRunInfo, listener);
    return () => ipcRenderer.removeListener(IPC.agents.onRunInfo, listener);
  },
  onStatus: (callback: (changes: AgentStatusMap) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, changes: AgentStatusMap): void =>
      callback(changes);
    ipcRenderer.on(IPC.agents.onStatus, listener);
    return () => ipcRenderer.removeListener(IPC.agents.onStatus, listener);
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
  /** Moves a project in or out of the Archived group on the Projects page. */
  setArchived: (projectId: string, archived: boolean): Promise<Project> =>
    ipcRenderer.invoke(IPC.projects.setArchived, projectId, archived),
  bootstrap: (projectId: string): Promise<BootstrapResult> =>
    ipcRenderer.invoke(IPC.projects.bootstrap, projectId),
  bootstrapPlan: (projectId: string): Promise<BootstrapPlan> =>
    ipcRenderer.invoke(IPC.projects.bootstrapPlan, projectId),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.projects.pickFolder),
  /** Opens an image picker and returns the file inlined as a data URL, or null if cancelled. */
  pickIcon: (): Promise<string | null> => ipcRenderer.invoke(IPC.projects.pickIcon),
  /** Shrinks a dropped or pasted image to icon size and returns it as a data URL. */
  normalizeIcon: (dataUrl: string): Promise<string> =>
    ipcRenderer.invoke(IPC.projects.normalizeIcon, dataUrl),
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
  /** Skills the user has starred, newest first. */
  listFavorites: (): Promise<FavoriteSkillRecord[]> => ipcRenderer.invoke(IPC.skills.listFavorites),
  /** Stars a skill, or refreshes the details of one already starred. */
  addFavorite: (input: FavoriteSkillInput): Promise<FavoriteSkillRecord[]> =>
    ipcRenderer.invoke(IPC.skills.addFavorite, input),
  removeFavorite: (skillId: string): Promise<FavoriteSkillRecord[]> =>
    ipcRenderer.invoke(IPC.skills.removeFavorite, skillId),
  /** Skill invocations counted from the local agent session transcripts. */
  getUsage: (): Promise<SkillUsageReport> => ipcRenderer.invoke(IPC.skills.getUsage),
  /** Re-reads every transcript from scratch instead of only the newly appended bytes. */
  rescanUsage: (): Promise<SkillUsageReport> => ipcRenderer.invoke(IPC.skills.rescanUsage),
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

const security = {
  preflight: (projectId: string): Promise<ScannerPreflight[]> =>
    ipcRenderer.invoke(IPC.security.preflight, projectId),
  runScan: (
    projectId: string,
    options: Partial<SecurityScanOptions>,
    runId: string,
  ): Promise<SecurityScanRecord> =>
    ipcRenderer.invoke(IPC.security.runScan, projectId, options, runId),
  cancelScan: (runId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.security.cancelScan, runId),
  activeScan: (projectId: string): Promise<ActiveScan | null> =>
    ipcRenderer.invoke(IPC.security.activeScan, projectId),
  history: (projectId: string): Promise<SecurityScanRecord[]> =>
    ipcRenderer.invoke(IPC.security.history, projectId),
  getScan: (id: string): Promise<SecurityScanRecord | null> =>
    ipcRenderer.invoke(IPC.security.getScan, id),
  latest: (projectId: string): Promise<SecurityScanRecord | null> =>
    ipcRenderer.invoke(IPC.security.latest, projectId),
  deleteScan: (id: string): Promise<void> => ipcRenderer.invoke(IPC.security.deleteScan, id),
  getConfig: (projectId: string): Promise<SecurityScannerSettings> =>
    ipcRenderer.invoke(IPC.security.getConfig, projectId),
  setConfig: (projectId: string, config: SecurityScannerSettings): Promise<void> =>
    ipcRenderer.invoke(IPC.security.setConfig, projectId, config),
  suggestCodeqlLanguage: (projectId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.security.suggestCodeqlLanguage, projectId),
  onScanProgress: (callback: (payload: SecurityScanProgress) => void): (() => void) =>
    subscribe(IPC.security.onScanProgress, callback),
  codeqlStatus: (): Promise<CodeqlLocalStatus> => ipcRenderer.invoke(IPC.security.codeqlStatus),
  installCodeql: (): Promise<CodeqlLocalStatus> => ipcRenderer.invoke(IPC.security.installCodeql),
  cancelCodeqlInstall: (): Promise<void> => ipcRenderer.invoke(IPC.security.cancelCodeqlInstall),
  removeCodeql: (): Promise<CodeqlLocalStatus> => ipcRenderer.invoke(IPC.security.removeCodeql),
  openCodeqlFolder: (): Promise<void> => ipcRenderer.invoke(IPC.security.openCodeqlFolder),
  onCodeqlProgress: (callback: (payload: CodeqlInstallProgress) => void): (() => void) =>
    subscribe(IPC.security.onCodeqlProgress, callback),
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

const docker = {
  availability: (): Promise<boolean> => ipcRenderer.invoke(IPC.docker.availability),
  list: (): Promise<DockerContainer[]> => ipcRenderer.invoke(IPC.docker.list),
  listForProject: (folderPath: string): Promise<DockerContainer[]> =>
    ipcRenderer.invoke(IPC.docker.listForProject, folderPath),
  start: (id: string): Promise<DockerActionResult> => ipcRenderer.invoke(IPC.docker.start, id),
  stop: (id: string): Promise<DockerActionResult> => ipcRenderer.invoke(IPC.docker.stop, id),
  restart: (id: string): Promise<DockerActionResult> => ipcRenderer.invoke(IPC.docker.restart, id),
  remove: (id: string, options: DockerRemoveOptions): Promise<DockerActionResult> =>
    ipcRenderer.invoke(IPC.docker.remove, id, options),
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
  openInEditor: (path: string): Promise<void> => ipcRenderer.invoke(IPC.shell.openInEditor, path),
  /** The file system path of a file dropped into the window. Empty for files not on disk. */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
};

const terminalClipboard = {
  /** Saves pasted image bytes to a file and returns its path, for pasting into an agent CLI. */
  saveImage: (bytes: Uint8Array, mime: string): Promise<string> =>
    ipcRenderer.invoke(IPC.terminalClipboard.saveImage, bytes, mime),
  /** What the system clipboard holds for a terminal: text, or paths for copied files and
   * images. Null when it holds nothing a terminal can use. */
  read: (): Promise<TerminalClipboardPaste | null> =>
    ipcRenderer.invoke(IPC.terminalClipboard.read),
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
  /** Moves an entry to another project, or detaches it when `projectId` is null. */
  setProject: (id: string, projectId: string | null): Promise<void> =>
    ipcRenderer.invoke(IPC.promptHistory.setProject, id, projectId),
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
  /** Sizes a generated prompt with the default AI CLI: complexity, model, and effort. */
  assessRun: (input: AssessRunInput): Promise<AssessRunResult> =>
    ipcRenderer.invoke(IPC.ai.assessRun, input),
  /** Stops an assessRun() that was given the same requestId. */
  cancelAssessRun: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.ai.cancelAssessRun, requestId),
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

const blueprints = {
  get: (projectId: string): Promise<ProjectBlueprint> =>
    ipcRenderer.invoke(IPC.blueprints.get, projectId),
  updateSection: (
    projectId: string,
    stepId: BlueprintStepId,
    patch: BlueprintSectionPatch,
  ): Promise<ProjectBlueprint> =>
    ipcRenderer.invoke(IPC.blueprints.updateSection, projectId, stepId, patch),
  setFinalPrompt: (projectId: string, text: string): Promise<ProjectBlueprint> =>
    ipcRenderer.invoke(IPC.blueprints.setFinalPrompt, projectId, text),
  setDocsFolder: (projectId: string, folder: string): Promise<ProjectBlueprint> =>
    ipcRenderer.invoke(IPC.blueprints.setDocsFolder, projectId, folder),
  setConfirmBeforeWriting: (projectId: string, value: boolean): Promise<ProjectBlueprint> =>
    ipcRenderer.invoke(IPC.blueprints.setConfirmBeforeWriting, projectId, value),
  /** Null when the picker was cancelled, so the caller can tell that from "nothing changed". */
  pickAttachments: (
    projectId: string,
    stepId: BlueprintStepId,
  ): Promise<BlueprintAttachmentResult | null> =>
    ipcRenderer.invoke(IPC.blueprints.pickAttachments, projectId, stepId),
  addAttachment: (
    projectId: string,
    stepId: BlueprintStepId,
    input: BlueprintAttachmentInput,
  ): Promise<BlueprintAttachmentResult> =>
    ipcRenderer.invoke(IPC.blueprints.addAttachment, projectId, stepId, input),
  renameAttachment: (
    projectId: string,
    stepId: BlueprintStepId,
    attachmentId: string,
    displayName: string,
  ): Promise<ProjectBlueprint> =>
    ipcRenderer.invoke(
      IPC.blueprints.renameAttachment,
      projectId,
      stepId,
      attachmentId,
      displayName,
    ),
  removeAttachment: (
    projectId: string,
    stepId: BlueprintStepId,
    attachmentId: string,
  ): Promise<ProjectBlueprint> =>
    ipcRenderer.invoke(IPC.blueprints.removeAttachment, projectId, stepId, attachmentId),
  /** Absolute path of one attachment, for handing to the OS through shell.openPath. */
  attachmentPath: (projectId: string, attachmentId: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.blueprints.attachmentPath, projectId, attachmentId),
  /** `stepId` of null asks for the final prompt's history rather than a section's. */
  listRevisions: (
    projectId: string,
    stepId: BlueprintStepId | null,
  ): Promise<BlueprintRevision[]> =>
    ipcRenderer.invoke(IPC.blueprints.listRevisions, projectId, stepId),
  agentFileTarget: (projectId: string): Promise<BlueprintAgentFileTarget> =>
    ipcRenderer.invoke(IPC.blueprints.agentFileTarget, projectId),
  syncAgentFile: (projectId: string): Promise<BlueprintAgentFileResult> =>
    ipcRenderer.invoke(IPC.blueprints.syncAgentFile, projectId),
  listPresets: (): Promise<BlueprintPreset[]> => ipcRenderer.invoke(IPC.blueprints.listPresets),
  savePreset: (input: SaveBlueprintPresetInput): Promise<BlueprintPreset[]> =>
    ipcRenderer.invoke(IPC.blueprints.savePreset, input),
  deletePreset: (presetId: string): Promise<BlueprintPreset[]> =>
    ipcRenderer.invoke(IPC.blueprints.deletePreset, presetId),
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
  /** Commits everything, or only `paths` (repo-relative) when given. */
  commit: (projectId: string, message: string, paths?: string[]): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.commit, projectId, message, paths),
  /** Tag state for the repo, or for one tag series (e.g. "web-v") when a prefix is given. */
  tags: (projectId: string, prefix?: string): Promise<GitTagInfo> =>
    ipcRenderer.invoke(IPC.git.tags, projectId, prefix),
  createTag: (input: CreateTagInput): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.createTag, input),
  suggestTag: (projectId: string, requestId?: string, prefix?: string): Promise<SuggestTagResult> =>
    ipcRenderer.invoke(IPC.git.suggestTag, projectId, requestId, prefix),
  /** Kills the CLI process behind an in-flight suggestTag(requestId). */
  cancelSuggestTag: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.git.cancelSuggestTag, requestId),
  /** Runs the CLI over the project's files to bump every version string to `tag`. */
  applyVersion: (input: ApplyVersionInput): Promise<ApplyVersionResult> =>
    ipcRenderer.invoke(IPC.git.applyVersion, input),
  cancelApplyVersion: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.git.cancelApplyVersion, requestId),
  /** Reverts one file the version bump changed, or puts the bump's edit back. */
  swapVersionFile: (input: SwapVersionFileInput): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.swapVersionFile, input),
  suggestBranchName: (projectId: string, requestId?: string): Promise<SuggestGitTextResult> =>
    ipcRenderer.invoke(IPC.git.suggestBranchName, projectId, requestId),
  /** Kills the CLI process behind an in-flight suggestBranchName(requestId). */
  cancelSuggestBranchName: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.git.cancelSuggestBranchName, requestId),
  /** `scope: 'staged'` describes only what is staged, for a commit of just those changes. */
  suggestCommitMessage: (
    projectId: string,
    requestId?: string,
    scope?: 'staged' | 'all',
  ): Promise<SuggestGitTextResult> =>
    ipcRenderer.invoke(IPC.git.suggestCommitMessage, projectId, requestId, scope),
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
  /** Asks main to watch this project's `.git`, so outside commits reach the open Git tab. */
  watchRepo: (projectId: string): Promise<void> => ipcRenderer.invoke(IPC.git.watchRepo, projectId),
  unwatchRepo: (projectId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.git.unwatchRepo, projectId),
  onRepoChanged: (callback: (projectId: string) => void): (() => void) =>
    subscribe(IPC.git.onRepoChanged, callback),
  /** Branch, sync counts and every change, grouped the way the workspace panel lists them. */
  workspaceState: (projectId: string): Promise<WorkspaceGitState> =>
    ipcRenderer.invoke(IPC.git.workspaceState, projectId),
  /** Pushes a fresh state through onWorkspaceState whenever files in the project change. */
  watchWorkingTree: (projectId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.git.watchWorkingTree, projectId),
  unwatchWorkingTree: (projectId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.git.unwatchWorkingTree, projectId),
  onWorkspaceState: (
    callback: (projectId: string, state: WorkspaceGitState) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      projectId: string,
      state: WorkspaceGitState,
    ): void => callback(projectId, state);
    ipcRenderer.on(IPC.git.onWorkspaceState, listener);
    return () => ipcRenderer.removeListener(IPC.git.onWorkspaceState, listener);
  },
  stage: (projectId: string, paths: string[]): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.stage, projectId, paths),
  unstage: (projectId: string, paths: string[]): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.unstage, projectId, paths),
  /** Throws away working tree changes (or trashes untracked files); the result can be undone. */
  discard: (
    projectId: string,
    paths: string[],
    side: 'unstaged' | 'untracked',
  ): Promise<GitDiscardResult> => ipcRenderer.invoke(IPC.git.discard, projectId, paths, side),
  undoDiscard: (projectId: string, token: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.undoDiscard, projectId, token),
  resolveConflict: (
    projectId: string,
    path: string,
    pick: 'ours' | 'theirs',
  ): Promise<GitOpResult> => ipcRenderer.invoke(IPC.git.resolveConflict, projectId, path, pick),
  abortOperation: (projectId: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.abortOperation, projectId),
  /** Commits only what is staged, optionally pushing the branch right after. */
  commitStaged: (projectId: string, message: string, push: boolean): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.git.commitStaged, projectId, message, push),
  fileDiff: (
    projectId: string,
    path: string,
    side: GitDiffSide,
    origPath?: string,
  ): Promise<GitFileDiff> => ipcRenderer.invoke(IPC.git.fileDiff, projectId, path, side, origPath),
  /** The files a commit changed, with line counts. */
  commitFiles: (projectId: string, hash: string): Promise<GitChangeEntry[]> =>
    ipcRenderer.invoke(IPC.git.commitFiles, projectId, hash),
  /** One file as a commit changed it. */
  commitFileDiff: (
    projectId: string,
    hash: string,
    path: string,
    origPath?: string,
  ): Promise<GitFileDiff> =>
    ipcRenderer.invoke(IPC.git.commitFileDiff, projectId, hash, path, origPath),
};

const pipelines = {
  status: (projectId: string): Promise<ProjectPipelineStatus> =>
    ipcRenderer.invoke(IPC.pipelines.status, projectId),
  setMuted: (projectId: string, actions: ProjectGithubAction[]): Promise<ProjectPipelineStatus> =>
    ipcRenderer.invoke(IPC.pipelines.setMuted, projectId, actions),
  dashboardActivity: (): Promise<GithubActionsActivity> =>
    ipcRenderer.invoke(IPC.pipelines.dashboardActivity),
  runError: (input: GithubActionsRunErrorInput): Promise<GithubActionsRunErrorResult> =>
    ipcRenderer.invoke(IPC.pipelines.runError, input),
  /** Warnings, notices and failures the run's jobs left behind. */
  runAnnotations: (input: GithubRunAnnotationsInput): Promise<GithubRunAnnotationsResult> =>
    ipcRenderer.invoke(IPC.pipelines.runAnnotations, input),
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
  setDragGuard: (active: boolean): void => ipcRenderer.send(IPC.pet.setDragGuard, active),
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

const proxy = {
  /** Where the app's requests are going right now, plus what this machine is set to. */
  status: (): Promise<ProxyStatus> => ipcRenderer.invoke(IPC.proxy.status),
  /** Probes a candidate server without saving it, so a bad one never takes the app offline. */
  test: (candidate: ProxySettings): Promise<ProxyTestResult> =>
    ipcRenderer.invoke(IPC.proxy.test, candidate),
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
  ssh,
  sshAgent,
  agents,
  power,
  projects,
  skills,
  mcp,
  security,
  tools,
  docker,
  fs,
  settings,
  templates,
  activity,
  shell: shellApi,
  terminalClipboard,
  spellcheck,
  grammar,
  proxy,
  window: windowControls,
  remoteSessionWindow: remoteSessionWindowControls,
  promptHistory,
  translate,
  ai,
  speech,
  system,
  ipGeo,
  projectDrafts,
  blueprints,
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
