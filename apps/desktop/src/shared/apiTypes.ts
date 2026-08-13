import type {
  AgentType,
  AiProvider,
  ProjectNotificationSettings,
  ProjectRunCommand,
  UsageProviderConfig,
} from '@agentmat/core';

export type { AiProvider };

/** Payload for enabling/configuring a Usage provider (settings key + API key). */
export interface SetUsageProviderConfigInput {
  providerId: string;
  config: UsageProviderConfig;
}

/** main -> widget window: which widget instance changed. */
export interface WidgetUpdatedPayload {
  id: string;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string | null;
  releaseNotes: string | null;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
}

/** Pushed to the renderer over IPC.app.onUpdateStatus as the main-process auto-updater progresses. */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; info: UpdateInfo }
  | { state: 'not-available' }
  | { state: 'downloading'; info: UpdateInfo; progress: UpdateDownloadProgress }
  | { state: 'downloaded'; info: UpdateInfo }
  | { state: 'error'; message: string };

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
  /** Launch commands the Run button can start. Empty when none are set. */
  runCommands: ProjectRunCommand[];
  /** CLI_REGISTRY id for this project's AI actions; null means the app default in Settings. */
  cliId?: string | null;
  /** Icon image inlined as a data URL; null (or omitted) leaves the project on the folder glyph. */
  iconDataUrl?: string | null;
  /** Site this project lives at; the favicon fetch reads it. */
  websiteUrl?: string;
  /** Git repository the code lives in, stored as a link only. */
  repoUrl?: string;
  /** Optional: the create/edit form doesn't collect it; the Prompt dialog defines it later. */
  prompt?: string;
}

export interface FaviconResult {
  /** The icon itself, ready to store on the project. */
  dataUrl: string;
  /** Where it came from, so the UI can say which site answered after redirects. */
  sourceUrl: string;
  /** The normalized site URL, which is what gets saved as the project's websiteUrl. */
  siteUrl: string;
}

export interface BootstrapResult {
  /** Agent the scaffold was written for, e.g. "Claude Code". */
  agentLabel: string;
  createdFiles: string[];
  /** Files left untouched because they already existed. */
  skippedFiles: string[];
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
  /** CLI agent ids (e.g. 'claude-code', 'cursor') this skill was installed for. Unset for repo-based skills, which aren't agent-specific. */
  agents?: string[];
  /** How the skill's own CLI was run ('npm-global' or 'npx'), so removal uses the same route. */
  installMethod?: string;
}

/** Compares an installed repo-based skill's stored version against its repository's current version. */
export interface SkillUpdateInfo {
  skillId: string;
  repositoryId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export interface InstalledMcpServerRecord {
  serverId: string;
  repositoryId: string;
  version: string;
  installedAt: string;
}

/** A single hit from a live skills.sh search, before its description has been fetched. */
export interface SkillsShSearchResult {
  id: string;
  name: string;
  owner: string;
  repo: string;
  installs: number;
  official: boolean;
  url: string;
  installCommand: string;
}

/** What a folder looks like as a skill repository, shown while the user types or picks a path. */
export interface LocalSkillFolderPreview {
  path: string;
  /** Folder name, offered as the repository name when the user left that field empty. */
  suggestedName: string;
  skillNames: string[];
  /** True when the folder carries its own repository.json instead of being scanned. */
  hasManifest: boolean;
  /** Why the folder can't be used, or null when it can. */
  error: string | null;
}

/** Detail fetched on demand for a single skills.sh skill (description isn't in search results). */
export interface SkillsShDetail {
  description: string | null;
  installsLabel: string | null;
}

export interface InstallFromSkillsShInput {
  /** null installs globally to ~/.claude/skills instead of a project. */
  projectId: string | null;
  owner: string;
  repo: string;
  skillName: string;
  /** CLI agent ids (e.g. 'claude-code', 'cursor') the skill was installed for. */
  agents: string[];
}

/** One probed command behind the UI UX Pro Max wizard's prerequisite step. */
export interface UiProToolProbe {
  found: boolean;
  version: string | null;
}

/**
 * What the `uipro` CLI needs to be able to run: Node and npm to install it, and Python 3 for the
 * skill's own search/design-system scripts. `uipro` itself is reported so the wizard can skip the
 * global npm install when it is already there.
 */
export interface UiProPrerequisites {
  node: UiProToolProbe;
  npm: UiProToolProbe;
  /** True when either `python3` or `python` resolves to a Python 3.x. */
  python: UiProToolProbe;
  /** The command that found Python, so the wizard can show the one that works here. */
  pythonCommand: string | null;
  uipro: UiProToolProbe;
}

export interface RecordUiProInstallInput {
  /** null records a global install (~/.claude/skills and friends) instead of a project one. */
  projectId: string | null;
  /** `--ai` values the skill was installed for, or ['all']. */
  agents: string[];
  /** Which route was used, kept so the removal command matches the install. */
  method: string;
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
  /** Set when the entry came from a project-scoped flow (e.g. a bootstrap description). */
  projectId: string | null;
  createdAt: string;
}

export interface AddPromptHistoryInput {
  rawInput: string;
  promptType: string;
  targetAI: string;
  content: string;
  source: PromptHistorySource;
  /** Links this entry to a project, so it shows up in that project's history. */
  projectId?: string | null;
}

export interface BackupExportResult {
  ok: boolean;
  /** Absolute path the backup was written to; unset when the save dialog was canceled. */
  path?: string;
}

export interface BackupImportResult {
  ok: boolean;
  error?: string;
}

export interface TranslateTextInput {
  text: string;
  targetLang: string;
}

export interface TranscribeAudioInput {
  /**
   * Mono 32-bit float PCM samples at 16 kHz, the only shape Whisper accepts.
   * The renderer resamples the microphone capture before sending, so the main
   * process never needs ffmpeg or any other audio tool.
   */
  samples: Float32Array;
  /** BCP-47-ish Whisper language code, or 'auto' to let the model detect it. */
  language: string;
}

export interface TranscribeAudioResult {
  ok: boolean;
  text: string;
  error?: string;
}

/**
 * First-run model download progress. Whisper weights are fetched once and
 * cached under userData, so this only reports during the initial download.
 */
export interface SpeechModelProgress {
  /** 0–100, or null while the total size is still unknown. */
  percent: number | null;
  file: string;
}

export interface SpeechModelState {
  /** True once the weights are on disk, so transcription can run offline. */
  ready: boolean;
  modelId: string;
}

export interface AskAiHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAiInput {
  provider: AiProvider;
  /** Model id: an OpenAI/Gemini model name, or an Ollama model tag from listOllamaModels(). */
  model: string;
  prompt: string;
  /** Prior turns in the conversation, oldest first. Omitted for one-off (non-chat) prompts. */
  history?: AskAiHistoryMessage[];
  /** Caller-generated id that ai.cancel(requestId) can abort this request with. */
  requestId?: string;
}

export interface AskAiResult {
  ok: boolean;
  text: string;
  error?: string;
  /** True when the caller aborted the request, so the UI can stay quiet about it. */
  cancelled?: boolean;
}

export interface CreateProjectDraftInput {
  projectId: string;
  rawInput: string;
  promptType: string;
  targetAI: string;
  content: string;
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

export interface GitFileChange {
  path: string;
  /** Index (staged) status character from `git status --porcelain`. */
  x: string;
  /** Worktree (unstaged) status character from `git status --porcelain`. */
  y: string;
}

export interface GitBranchInfo {
  name: string;
  /** Present as a local `refs/heads` branch. */
  local: boolean;
  /** Present on the primary remote (usually origin). */
  remote: boolean;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  /** ISO-8601 committer date. */
  date: string;
  subject: string;
  parents: string[];
}

export interface GitDayCount {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface GitBranchHistory {
  branch: string;
  commits: GitCommitInfo[];
  /** Daily commit counts covering the last 12 weeks, including empty days. */
  activity: GitDayCount[];
}

export interface RenameBranchInput {
  projectId: string;
  from: string;
  to: string;
  /** Push the new name and delete the old one on the primary remote. */
  updateRemote?: boolean;
}

export interface DeleteBranchInput {
  projectId: string;
  branchName: string;
  /** Also `git push --delete` on the primary remote. */
  deleteRemote?: boolean;
  /** Use `git branch -D` when the branch is not fully merged. */
  force?: boolean;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  /** Best-effort guess at the repo's primary branch, e.g. "main" vs "master". */
  defaultBranch: string | null;
  ahead: number;
  behind: number;
  hasRemote: boolean;
  files: GitFileChange[];
  branches: GitBranchInfo[];
}

export interface GitOpResult {
  ok: boolean;
  message: string;
}

export interface GitTagInfo {
  /** Most recent tag reachable from HEAD, or null when the repo has none yet. */
  latestTag: string | null;
  /** Newest tags first, capped to a handful for display. */
  recentTags: string[];
  /** Commits made after `latestTag` (all commits when there is no tag yet). */
  commitsSinceLatestTag: number;
  hasRemote: boolean;
}

export interface CreateTagInput {
  projectId: string;
  tag: string;
  /** Annotation message; falls back to the tag name when empty. */
  message?: string;
  /** Push the new tag to origin after creating it. */
  push: boolean;
}

export interface ApplyVersionInput {
  projectId: string;
  /** Tag being prepared, e.g. "v1.7.0"; the manifests get it without the leading "v". */
  tag: string;
  /** Lets git.cancelAiPrompt(requestId) stop the run. */
  requestId?: string;
}

export interface ApplyVersionResult {
  ok: boolean;
  /** What the CLI reported it did. */
  output: string;
  /** Working-tree paths that differ from before the run. */
  changedFiles: string[];
  /** True if HEAD moved during the run, e.g. the CLI ran `npm version` and committed on its own. */
  committedByCli?: boolean;
  cliName?: string | null;
  error?: string;
  cancelled?: boolean;
}

export interface SuggestTagResult {
  ok: boolean;
  /** Suggested tag name, e.g. "v1.6.2". */
  tag?: string;
  /** One-line rationale from the CLI, when it gave one. */
  reason?: string;
  /** Release notes for the tag annotation. */
  message?: string;
  /** Display name of the CLI that answered. */
  cliName?: string | null;
  error?: string;
  /** True when the caller cancelled the run, so the UI can stay quiet about it. */
  cancelled?: boolean;
}

export interface SuggestGitTextResult {
  ok: boolean;
  /** Suggested branch name or commit message, when ok is true. */
  text?: string;
  /** Display name of the CLI that answered. */
  cliName?: string | null;
  error?: string;
  /** True when the caller cancelled the run, so the UI can stay quiet about it. */
  cancelled?: boolean;
}

export interface CreatePullRequestInput {
  projectId: string;
  title: string;
  body: string;
  base?: string;
}

export interface CreatePullRequestResult {
  ok: boolean;
  url?: string;
  error?: string;
  /** True when the GitHub CLI wasn't available and we opened a compare page in the browser instead. */
  usedFallback?: boolean;
}

export interface GitInitInput {
  projectId: string;
  /** Branch the fresh repository starts on, e.g. "master". */
  branch: string;
  /** Stage everything and record a first commit right after the init. */
  initialCommit: boolean;
  commitMessage?: string;
}

export type GithubOwnerType = 'user' | 'organization';

export interface GithubOwner {
  login: string;
  type: GithubOwnerType;
}

export interface GithubAccount {
  /** False when the GitHub CLI isn't installed at all. */
  cliAvailable: boolean;
  /** False when gh is there but nobody has logged in with it. */
  authenticated: boolean;
  login: string | null;
  /** The signed-in account first, then every organization it belongs to. */
  owners: GithubOwner[];
  error?: string;
}

/** Daily GitHub contribution counts for the dashboard activity chart. */
export interface GithubActivity {
  ok: boolean;
  cliAvailable: boolean;
  authenticated: boolean;
  login: string | null;
  /** Contributions in GitHub's current contribution year. */
  yearCount: number;
  /** Last 12 weeks of local calendar days, including days with no activity. */
  days: GitDayCount[];
  error?: string;
}

export interface GithubNotificationItem {
  id: string;
  unread: boolean;
  reason: string;
  title: string;
  type: string;
  repo: string;
  updatedAt: string;
  /** Browser URL when GitHub gave us enough to build one; otherwise the repo page. */
  url: string | null;
}

export interface GithubNotifications {
  ok: boolean;
  cliAvailable: boolean;
  authenticated: boolean;
  notifications: GithubNotificationItem[];
  error?: string;
}

export interface GithubRepoInfo {
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GithubRepoLookup {
  /** False only when the lookup itself failed, which is different from "no such repo". */
  ok: boolean;
  exists: boolean;
  repo?: GithubRepoInfo;
  error?: string;
}

export interface CreateGithubRepoInput {
  /** A user login or an organization login the account can create repos in. */
  owner: string;
  name: string;
  isPrivate: boolean;
  description?: string;
}

export interface CreateGithubRepoResult {
  ok: boolean;
  repo?: GithubRepoInfo;
  error?: string;
}

export interface ConnectRemoteInput {
  projectId: string;
  /** Remote URL, https or ssh. */
  url: string;
  /** Push the current branch with -u once the remote is wired up. */
  push: boolean;
}

export type PackageManagerEcosystem = 'node' | 'dotnet';
export type PackageManagerKind = 'npm' | 'yarn' | 'pnpm' | 'nuget';

export interface PackageInfo {
  name: string;
  currentVersion: string;
  /** Null when the latest-version lookup failed, distinct from "up to date". */
  latestVersion: string | null;
  isOutdated: boolean;
  isDev: boolean;
  /** False when only a declared range was found (e.g. node_modules missing). */
  isInstalled: boolean;
  /** Absolute path to the manifest this package was read from (package.json or a specific .csproj). */
  manifestPath: string;
  /** Human-readable name of the sub-project this package belongs to (e.g. its package.json "name", or a relative folder path). */
  projectLabel: string;
}

export interface PackageManagerSection {
  ecosystem: PackageManagerEcosystem;
  manager: PackageManagerKind;
  status: 'ok' | 'cli-missing' | 'error';
  message: string | null;
  packages: PackageInfo[];
}

export interface PackageScanResult {
  projectId: string;
  sections: PackageManagerSection[];
}

export interface PackageUpdateRequest {
  ecosystem: PackageManagerEcosystem;
  name: string;
  targetVersion: string;
  manifestPath: string;
}

export interface PackageUpdateProgress {
  projectId: string;
  ecosystem: PackageManagerEcosystem;
  packageName: string;
  status: 'running' | 'done' | 'error';
  message?: string;
  completed: number;
  total: number;
}

export interface PackageUpdateItemResult {
  name: string;
  ok: boolean;
  message: string;
}

export interface PackageUpdateResult {
  ok: boolean;
  results: PackageUpdateItemResult[];
}

export interface DiskUsage {
  /** Drive letter (Windows) or device name (macOS/Linux), stable across samples. */
  id: string;
  label: string;
  readBytesPerSec: number;
  writeBytesPerSec: number;
}

export interface GpuUsage {
  /** GPU index reported by `nvidia-smi`, stable across samples. */
  id: string;
  label: string;
  percent: number;
  memUsedBytes: number;
  memTotalBytes: number;
}

/** One app (possibly several processes) in a top-CPU, GPU, memory, or disk listing. */
export interface TopResourceApp {
  name: string;
  /** Heaviest process in the group, useful when processCount is 1. */
  pid: number;
  /** Share of the resource, 0-100, already scaled to match the dashboard graphs. */
  percent: number;
  processCount: number;
  /** Working set (CPU/memory) or dedicated GPU memory (GPU), when the OS reports it. */
  memBytes?: number;
  /** Disk read+write throughput, when listing top disk apps. */
  rateBytesPerSec?: number;
  /** Small PNG data URL of the app's file icon, when the OS can resolve it. */
  iconDataUrl?: string;
}

export type TopResourceKind = 'cpu' | 'gpu' | 'memory' | 'disk';

export interface TopResourceAppsResult {
  apps: TopResourceApp[];
  /**
   * False when this machine has no way to attribute the resource to processes
   * (typical for GPU on macOS without nvidia-smi, or disk I/O on macOS).
   */
  available: boolean;
}

export interface KillProcessResult {
  ok: boolean;
  error?: string;
}

export interface SystemStatsSample {
  timestamp: number;
  /** e.g. "Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz". */
  cpuModel: string;
  cpuCoreCount: number;
  /**
   * Aggregate CPU usage, 0-100. On Windows this is % Processor Time, the
   * same formula Windows 11 Task Manager uses (busy time / elapsed / cores).
   * On other platforms it is the average of cpuCorePercents.
   */
  cpuPercent: number;
  /** Per-logical-core usage, same order as reported by the OS. */
  cpuCorePercents: number[];
  memPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  /** Empty when no fixed disk could be queried. */
  disks: DiskUsage[];
  /**
   * Empty when no GPU could be queried. NVIDIA GPUs (via `nvidia-smi`) get
   * precise usage; on Windows, one additional non-NVIDIA GPU (e.g. an
   * integrated Intel/AMD chip) is included with best-effort usage; see
   * sampleOtherGpu in systemStats.ts for the accuracy caveat.
   */
  gpus: GpuUsage[];
  netRxBytesPerSec: number;
  netTxBytesPerSec: number;
  pings: PingResult[];
}

// --- Remote control ------------------------------------------------------------

export interface RemoteNetworkInterface {
  /** Adapter name, e.g. "Wi-Fi" or "eth0". */
  name: string;
  address: string;
}

export interface RemoteScreenSize {
  width: number;
  height: number;
}

/** A controller currently connected to this machine while it is hosting. */
export interface RemotePeerInfo {
  id: string;
  deviceName: string;
  address: string;
  connectedAt: number;
}

export type RemoteConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/** What an outbound connection is for: a full control session, or file transfer/browsing only (no screen capture/WebRTC). */
export type RemoteConnectIntent = 'control' | 'files';

/** This machine's outbound connection to a remote host (controller side). */
export interface RemoteConnectionInfo {
  status: RemoteConnectionStatus;
  remoteDeviceName: string | null;
  remoteScreen: RemoteScreenSize | null;
  intent: RemoteConnectIntent | null;
  error?: string;
}

/** A live one-time pairing code plus its QR rendering. */
export interface RemotePairingInfo {
  code: string;
  qrDataUrl: string;
  expiresAt: number;
}

export interface RemoteState {
  deviceName: string;
  hosting: boolean;
  hostIp: string | null;
  hostPort: number;
  /** Whether OS-level input injection is available on this platform. */
  inputSupported: boolean;
  pairing: RemotePairingInfo | null;
  peers: RemotePeerInfo[];
  connection: RemoteConnectionInfo;
  interfaces: RemoteNetworkInterface[];
}

/**
 * A remembered host, keyed by the durable per-device token the host issues on
 * first pairing (see `auth-ok`'s `deviceToken`). Lets the controller reconnect
 * with one click, no pairing code required, until the host revokes the token.
 */
export interface RemoteSavedServer {
  id: string;
  nickname: string;
  ip: string;
  port: number;
  deviceName: string;
  deviceToken: string;
  createdAt: number;
  lastConnectedAt: number;
}

/** Live transport quality for the controller's inbound video, sampled ~1/sec. */
export interface RemoteQualitySample {
  kbps: number;
  fps: number;
  rttMs: number | null;
  /** Packets lost since the previous sample (a delta, not the cumulative WebRTC stat). */
  packetsLost: number;
  jitter: number;
  width: number;
  height: number;
  codec: string | null;
}

export type RemoteFileDirection = 'incoming' | 'outgoing';

export interface RemoteFileProgress {
  transferId: string;
  name: string;
  direction: RemoteFileDirection;
  transferred: number;
  total: number;
  done: boolean;
  error?: string;
  /** Absolute path where an incoming file was saved (set when done). */
  savedPath?: string;
  /** Total resumable parts (10MB each) this transfer is split into. */
  partsTotal?: number;
  /** Parts that have been hashed and acked so far. */
  partsCompleted?: number;
  /** Whole-file SHA-256 matched between sender and receiver (set when done). */
  verified?: boolean;
  /** True while auto-reconnecting after a dropped connection mid-transfer. */
  resuming?: boolean;
  /** Retry count for the part currently in flight (part-hash mismatch or timeout). */
  currentPartRetry?: number;
}

/** One entry in a remote-file-manager directory listing (mirrors `RemoteFileEntry` from the wire protocol). */
export interface RemoteFileManagerEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtimeMs: number;
}

export type RemoteLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface RemoteLogEvent {
  level: RemoteLogLevel;
  message: string;
  at: number;
}

export interface StartHostInput {
  ip: string;
  port: number;
}

export type PipelineRunStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'waiting'
  | 'requested'
  | 'pending'
  | 'unknown';

export type PipelineConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | 'neutral'
  | 'stale'
  | null;

export interface GithubWorkflowInfo {
  id: number;
  name: string;
  path: string;
  state: string;
  htmlUrl: string;
  badgeUrl: string;
}

export interface GithubWorkflowRunInfo {
  id: number;
  workflowId: number;
  name: string;
  displayTitle: string;
  runNumber: number;
  headBranch: string;
  status: PipelineRunStatus;
  conclusion: PipelineConclusion;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPipelineStatus {
  projectId: string;
  cliAvailable: boolean;
  authenticated: boolean;
  github: { owner: string; repo: string } | null;
  error?: string;
  workflows: GithubWorkflowInfo[];
  /** Latest run for each workflow id, or null when that workflow has never run. */
  runsByWorkflowId: Record<number, GithubWorkflowRunInfo | null>;
}

export interface GithubActionsDayCount {
  date: string;
  passed: number;
  failed: number;
}

export interface GithubActionsHistoryItem {
  id: number;
  projectId: string | null;
  projectName: string;
  repo: string;
  workflowName: string;
  displayTitle: string;
  runNumber: number;
  headBranch: string;
  status: PipelineRunStatus;
  conclusion: PipelineConclusion;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GithubActionsActivity {
  ok: boolean;
  cliAvailable: boolean;
  authenticated: boolean;
  /** Last 14 local calendar days, including days with no runs. */
  days: GithubActionsDayCount[];
  /** Newest first. */
  runs: GithubActionsHistoryItem[];
  weekPassed: number;
  weekFailed: number;
  runningCount: number;
  repoCount: number;
  error?: string;
}

export interface GithubActionsRunErrorInput {
  repo: string;
  runId: number;
  workflowName?: string;
  displayTitle?: string;
  runNumber?: number;
  headBranch?: string;
}

export type GithubActionsRunErrorResult =
  | { ok: true; text: string }
  | { ok: false; error: string };
