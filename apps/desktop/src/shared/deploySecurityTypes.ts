/**
 * What the Deploy section's Security area sends to the main process: users and roles, devices and
 * sessions, enrollment codes and the audit trail of one server's core. Answers are the core's own
 * contract types (UserInfo, DeviceInfo, AuditPage...). Passwords only ever travel inwards, from a
 * dialog to the core; nothing here is stored.
 */

export type DeployRole = 'owner' | 'admin' | 'operator' | 'viewer';

/** Most powerful first, as the core nests them: each includes what the ones after it may do. */
export const DEPLOY_ROLES: readonly DeployRole[] = ['owner', 'admin', 'operator', 'viewer'];

export interface DeployCreateUserInput {
  serverId: string;
  userName: string;
  /** The first password. The core checks it against its rules and keeps only a hash. */
  password: string;
  role: DeployRole;
}

export interface DeployUserTarget {
  serverId: string;
  userId: string;
}

export interface DeploySetRoleInput extends DeployUserTarget {
  role: DeployRole;
}

export interface DeploySetDisabledInput extends DeployUserTarget {
  disabled: boolean;
}

export interface DeployResetPasswordInput extends DeployUserTarget {
  password: string;
}

export interface DeployEnrollmentCodeInput {
  serverId: string;
  /** Whose code it is; the signed-in user's own when left out (for another computer of theirs). */
  userName?: string;
  /** 1 to 1440; the core's default (15) when left out. */
  validMinutes?: number;
}

/** Redeems an Owner's code on this computer: a new device key, then a sign-in. */
export interface DeployRedeemCodeInput {
  serverId: string;
  code: string;
  userName: string;
  password: string;
}

export type DeployAuditResult = 'success' | 'denied' | 'failed' | 'cancelled';

export const DEPLOY_AUDIT_RESULTS: readonly DeployAuditResult[] = [
  'success',
  'denied',
  'failed',
  'cancelled',
];

/** Every filter given has to match. An action ending in a dot ("auth.") matches the whole group. */
export interface DeployAuditFilter {
  action?: string;
  /** A user name or user id. */
  actor?: string;
  result?: DeployAuditResult;
  fromUnixMs?: number;
  toUnixMs?: number;
}

export interface DeployAuditQueryInput extends DeployAuditFilter {
  serverId: string;
  /** Older than this event id: the page before, as `nextBeforeId` said. */
  beforeId?: number;
  limit?: number;
}

export type DeployAuditExportFormat = 'json' | 'csv';

export interface DeployAuditExportInput {
  serverId: string;
  format: DeployAuditExportFormat;
  filter: DeployAuditFilter;
}

export interface DeployAuditExportResult {
  /** False when the save dialog was cancelled. */
  saved: boolean;
  path?: string;
  /** How many events went into the file. */
  count?: number;
  /** More events matched than one export takes; the newest ones are in the file. */
  truncated?: boolean;
}
