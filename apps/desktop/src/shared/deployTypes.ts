/**
 * Plain data the Deploy section passes between the main process and the renderer. Nothing here
 * carries a secret: sudo passwords only travel from the renderer into an install call.
 */

/** How the app reaches a server's core: a tunnel to its socket, its stdio bridge, or the DevHost. */
export type DeployTransport = 'streamlocal' | 'bridge' | 'dev-tcp';

/** What the app remembers about the core it installed on a server. */
export interface DeployCoreRecord {
  version: string;
  /** The release folder on the server. */
  release: string;
  transport: DeployTransport;
  installedAt: number;
  /** The server's own name for its OS, such as "Ubuntu 24.04.1 LTS", at install time. */
  os: string;
  /** What `uname -m` said, such as x86_64. */
  architecture: string;
}

/** A saved server from the Remote section, with its core if one is installed. */
export interface DeployServer {
  id: string;
  nickname: string;
  host: string;
  port: number;
  username: string;
  core: DeployCoreRecord | null;
  /** Only the DevHost, a development stand-in for a server; it cannot be installed or removed. */
  dev?: boolean;
}

export type DeploySudoMode = 'root' | 'passwordless' | 'password';

/** A read-only look at a server before an install. */
export interface DeployPreflight {
  os: string;
  supported: boolean;
  architecture: string;
  /** Whether there is a server core build for this processor. */
  architectureSupported: boolean;
  systemd: boolean;
  /** Null when sudo is missing on a non-root login (listed in `problems`). */
  sudo: DeploySudoMode | null;
  loginUser: string;
  /** Whether the saved login password can be tried for sudo. */
  hasSavedPassword: boolean;
  transport: 'streamlocal' | 'bridge';
  selinux: 'enforcing' | 'permissive' | 'disabled' | 'absent';
  freeDiskMb: number | null;
  installed: { version: string } | null;
  /** The core version this app installs; null when this build has none to offer. */
  available: string | null;
  /** What stands in the way of an install; empty when it can go ahead. */
  problems: string[];
}

export type DeploySetupPhase =
  | 'preflight'
  | 'download'
  | 'upload'
  | 'verify'
  | 'group'
  | 'extract'
  | 'selinux'
  | 'unit'
  | 'switch'
  | 'start'
  | 'cleanup'
  | 'rollback'
  | 'health'
  | 'stop'
  | 'remove';

export interface DeploySetupProgress {
  phase: DeploySetupPhase;
  title: string;
  status: 'running' | 'done' | 'failed';
  /** Why a step failed, or what a finished step wants the user to know. */
  detail?: string;
  /** How much of the upload reached the server, 0 to 100. */
  percent?: number;
}

export interface DeploySetupProgressEvent {
  serverId: string;
  progress: DeploySetupProgress;
}

export interface DeployInstallResult {
  version: string;
  release: string;
  transport: 'streamlocal' | 'bridge';
  /** The version this install replaced, if any. */
  previousVersion: string | null;
}

export interface DeployInstallInput {
  serverId: string;
  /** Null tries the saved login password, when sudo asks for one. */
  sudoPassword: string | null;
}

export interface DeployUninstallInput extends DeployInstallInput {
  keepData: boolean;
}

export interface DeployHealth {
  version: string;
  apiVersion: number;
  startedAtUnixMs: number;
  checkedAt: number;
}
