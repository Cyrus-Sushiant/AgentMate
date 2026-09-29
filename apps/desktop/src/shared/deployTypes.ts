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
  /** Whether this computer has a device on the core (not whether it is signed in right now). */
  enrolled: boolean;
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
  | 'owner'
  | 'enroll'
  | 'sign-in'
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
  /** The core runs, but this computer's access could not be set up; it can be retried. */
  enrollmentError?: string;
}

/** A user on a core: the owner to create on a new one, or who to sign in as. */
export interface DeployAccountInput {
  userName: string;
  password: string;
}

export interface DeployInstallInput {
  serverId: string;
  /** Null tries the saved login password, when sudo asks for one. */
  sudoPassword: string | null;
  /** Sets up this computer's access right after the install; left out, it is done later. */
  account?: DeployAccountInput;
}

/** Enrolls this computer over SSH (again, after a revocation): its own device key for a user. */
export interface DeployEnrollInput {
  serverId: string;
  sudoPassword: string | null;
  account: DeployAccountInput;
}

export interface DeploySignInInput {
  serverId: string;
  password: string;
  totpCode?: string;
  recoveryCode?: string;
}

export interface DeployStepUpInput {
  serverId: string;
  password?: string;
  totpCode?: string;
}

/**
 * Whether this computer can act on a server's core: signed in; enrolled but with no live session;
 * refused by the core as a device (revoked or unknown, so enroll again); never enrolled here; or
 * not reachable right now.
 */
export type DeployAccessState =
  | 'signed-in'
  | 'needs-sign-in'
  | 'needs-re-enroll'
  | 'not-enrolled'
  | 'unreachable';

export interface DeployAccess {
  state: DeployAccessState;
  user?: { userName: string; roles: string[]; twoFactorEnabled: boolean };
  /** For 'unreachable' and a locked account: what went wrong. */
  message?: string;
}

/** A new authenticator key, as text and as a QR code image (a data URL). */
export interface DeployTotpSetup {
  sharedKey: string;
  authenticatorUri: string;
  qrDataUrl: string;
}

export interface DeployUninstallInput {
  serverId: string;
  sudoPassword: string | null;
  keepData: boolean;
}

export interface DeployHealth {
  version: string;
  apiVersion: number;
  startedAtUnixMs: number;
  checkedAt: number;
}
