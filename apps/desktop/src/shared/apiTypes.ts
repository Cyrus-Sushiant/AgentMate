import type { AgentType, AiProvider, ProjectNotificationSettings } from '@agentmat/core';

export type { AiProvider };

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
  runCommand: string;
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

/** Detail fetched on demand for a single skills.sh skill (description isn't in search results). */
export interface SkillsShDetail {
  description: string | null;
  installsLabel: string | null;
}

export interface InstallFromSkillsShInput {
  projectId: string;
  owner: string;
  repo: string;
  skillName: string;
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

export interface AskAiHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAiInput {
  provider: AiProvider;
  /** Model id — an OpenAI/Gemini model name, or an Ollama model tag from listOllamaModels(). */
  model: string;
  prompt: string;
  /** Prior turns in the conversation, oldest first. Omitted for one-off (non-chat) prompts. */
  history?: AskAiHistoryMessage[];
}

export interface AskAiResult {
  ok: boolean;
  text: string;
  error?: string;
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

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  hasRemote: boolean;
  files: GitFileChange[];
}

export interface GitOpResult {
  ok: boolean;
  message: string;
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

export interface DiskUsage {
  /** Drive letter (Windows) or device name (macOS/Linux) — stable across samples. */
  id: string;
  label: string;
  readBytesPerSec: number;
  writeBytesPerSec: number;
}

export interface GpuUsage {
  /** GPU index reported by `nvidia-smi` — stable across samples. */
  id: string;
  label: string;
  percent: number;
  memUsedBytes: number;
  memTotalBytes: number;
}

export interface SystemStatsSample {
  timestamp: number;
  cpuPercent: number;
  memPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  /** Empty when no fixed disk could be queried. */
  disks: DiskUsage[];
  /**
   * Empty when no GPU could be queried. NVIDIA GPUs (via `nvidia-smi`) get
   * precise usage; on Windows, one additional non-NVIDIA GPU (e.g. an
   * integrated Intel/AMD chip) is included with best-effort usage — see
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

/** This machine's outbound connection to a remote host (controller side). */
export interface RemoteConnectionInfo {
  status: RemoteConnectionStatus;
  remoteDeviceName: string | null;
  remoteScreen: RemoteScreenSize | null;
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
