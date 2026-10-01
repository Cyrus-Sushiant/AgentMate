import type { IpcMainInvokeEvent } from 'electron';
import {
  DEPLOY_AUDIT_RESULTS,
  DEPLOY_ROLES,
  type DeployAuditExportInput,
  type DeployAuditFilter,
  type DeployAuditQueryInput,
  type DeployAuditResult,
  type DeployCreateUserInput,
  type DeployEnrollmentCodeInput,
  type DeployRedeemCodeInput,
  type DeployRole,
} from '../../shared/deploySecurityTypes';
import { IPC } from '../../shared/ipcChannels';
import type { DeploySecurity } from '../deploy/security';
import type { DeployService } from '../deploy/service';
import type { DeployIpcRegistry } from './deploy';

/**
 * The Security area's channels: users and roles, devices and sessions, enrollment codes and the
 * audit trail of a server's core. Like every Deploy channel they answer only the main window, and
 * each argument is checked here before the core is asked. The core checks everything again and
 * decides who may do what; nothing here grants a right.
 */

export interface DeploySecurityHandlerDeps {
  ipc: DeployIpcRegistry;
  security: DeploySecurity;
  service: Pick<DeployService, 'redeemEnrollmentCode'>;
  /** True only for the main window's own frame. */
  guard: (event: IpcMainInvokeEvent) => boolean;
}

const SERVER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Identity's allowed user name characters on the core; a user id fits it too. */
const USER_NAME = /^[A-Za-z0-9._@-]{1,64}$/;
/** What people type for a code: its letters and digits, with dashes or spaces between groups. */
const CODE = /^(?=.*[A-Za-z0-9])[A-Za-z0-9 -]{1,64}$/;
const ACTION = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_PASSWORD = 1024;
const MAX_VALID_MINUTES = 24 * 60;
const MAX_AUDIT_PAGE = 200;

function object(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(`Expected ${what}.`);
  return value as Record<string, unknown>;
}

function serverId(value: unknown): string {
  if (typeof value !== 'string' || !SERVER_ID.test(value)) {
    throw new Error('That is not a saved server.');
  }
  return value;
}

function id(value: unknown, what: string): string {
  if (typeof value !== 'string' || !GUID.test(value)) throw new Error(`That is not a ${what}.`);
  return value;
}

function userName(value: unknown): string {
  if (typeof value !== 'string' || !USER_NAME.test(value)) {
    throw new Error('A user name has 1 to 64 letters, digits, dots, dashes, underscores or @.');
  }
  return value;
}

function password(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PASSWORD) {
    throw new Error('The password must be text.');
  }
  return value;
}

function role(value: unknown): DeployRole {
  if (!DEPLOY_ROLES.includes(value as DeployRole)) {
    throw new Error('A role is one of owner, admin, operator or viewer.');
  }
  return value as DeployRole;
}

function integer(value: unknown, min: number, max: number, what: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`The ${what} is out of range.`);
  }
  return value;
}

/** Optional text filters: empty means "no filter". */
function optional<T>(value: unknown, check: (value: unknown) => T): T | undefined {
  return value === undefined || value === null || value === '' ? undefined : check(value);
}

function createUserInput(value: unknown): DeployCreateUserInput {
  const input = object(value, 'a new user');
  return {
    serverId: serverId(input.serverId),
    userName: userName(input.userName),
    password: password(input.password),
    role: role(input.role),
  };
}

function target(value: unknown): {
  serverId: string;
  userId: string;
  input: Record<string, unknown>;
} {
  const input = object(value, 'a user');
  return { serverId: serverId(input.serverId), userId: id(input.userId, 'user'), input };
}

function enrollmentCodeInput(value: unknown): DeployEnrollmentCodeInput {
  const input = object(value, 'an enrollment code request');
  const name = optional(input.userName, userName);
  const minutes = optional(input.validMinutes, (minutes) =>
    integer(minutes, 1, MAX_VALID_MINUTES, 'validity'),
  );
  return {
    serverId: serverId(input.serverId),
    ...(name === undefined ? {} : { userName: name }),
    ...(minutes === undefined ? {} : { validMinutes: minutes }),
  };
}

function redeemInput(value: unknown): DeployRedeemCodeInput {
  const input = object(value, 'an enrollment code');
  if (typeof input.code !== 'string' || !CODE.test(input.code)) {
    throw new Error('An enrollment code has letters and digits, in groups.');
  }
  return {
    serverId: serverId(input.serverId),
    code: input.code,
    userName: userName(input.userName),
    password: password(input.password),
  };
}

function auditFilter(input: Record<string, unknown>): DeployAuditFilter {
  const action = optional(input.action, (value) => {
    if (typeof value !== 'string' || !ACTION.test(value)) throw new Error('That is not an action.');
    return value;
  });
  const actor = optional(input.actor, userName);
  const result = optional(input.result, (value) => {
    if (!DEPLOY_AUDIT_RESULTS.includes(value as DeployAuditResult)) {
      throw new Error('A result is success, denied, failed or cancelled.');
    }
    return value as DeployAuditResult;
  });
  const time = (value: unknown) => integer(value, 0, Number.MAX_SAFE_INTEGER, 'time');
  const from = optional(input.fromUnixMs, time);
  const to = optional(input.toUnixMs, time);
  return {
    ...(action === undefined ? {} : { action }),
    ...(actor === undefined ? {} : { actor }),
    ...(result === undefined ? {} : { result }),
    ...(from === undefined ? {} : { fromUnixMs: from }),
    ...(to === undefined ? {} : { toUnixMs: to }),
  };
}

function auditQueryInput(value: unknown): DeployAuditQueryInput {
  const input = object(value, 'an audit query');
  const beforeId = optional(input.beforeId, (before) =>
    integer(before, 1, Number.MAX_SAFE_INTEGER, 'page'),
  );
  const limit = optional(input.limit, (count) => integer(count, 1, MAX_AUDIT_PAGE, 'page size'));
  return {
    serverId: serverId(input.serverId),
    ...auditFilter(input),
    ...(beforeId === undefined ? {} : { beforeId }),
    ...(limit === undefined ? {} : { limit }),
  };
}

function auditExportInput(value: unknown): DeployAuditExportInput {
  const input = object(value, 'an audit export');
  if (input.format !== 'json' && input.format !== 'csv') {
    throw new Error('An export is JSON or CSV.');
  }
  return {
    serverId: serverId(input.serverId),
    format: input.format,
    filter: auditFilter(object(input.filter, 'an audit filter')),
  };
}

export function registerDeploySecurityHandlers({
  ipc,
  security,
  service,
  guard,
}: DeploySecurityHandlerDeps): void {
  const handle = (channel: string, run: (...args: unknown[]) => unknown) => {
    ipc.handle(channel, async (event, ...args) => {
      if (!guard(event)) throw new Error('Deploy is only available in the main window.');
      return run(...args);
    });
  };

  handle(IPC.deploySecurity.listUsers, (server) => security.listUsers(serverId(server)));
  handle(IPC.deploySecurity.createUser, (input) => security.createUser(createUserInput(input)));
  handle(IPC.deploySecurity.setUserRole, (input) => {
    const user = target(input);
    return security.setUserRole({
      serverId: user.serverId,
      userId: user.userId,
      role: role(user.input.role),
    });
  });
  handle(IPC.deploySecurity.setUserDisabled, (input) => {
    const user = target(input);
    if (typeof user.input.disabled !== 'boolean') throw new Error('Say whether to disable.');
    return security.setUserDisabled({
      serverId: user.serverId,
      userId: user.userId,
      disabled: user.input.disabled,
    });
  });
  handle(IPC.deploySecurity.resetUserPassword, (input) => {
    const user = target(input);
    return security.resetUserPassword({
      serverId: user.serverId,
      userId: user.userId,
      password: password(user.input.password),
    });
  });
  handle(IPC.deploySecurity.deleteUser, (input) => {
    const user = target(input);
    return security.deleteUser({ serverId: user.serverId, userId: user.userId });
  });
  handle(IPC.deploySecurity.createEnrollmentCode, (input) =>
    security.createEnrollmentCode(enrollmentCodeInput(input)),
  );
  handle(IPC.deploySecurity.redeemEnrollmentCode, (input) =>
    service.redeemEnrollmentCode(redeemInput(input)),
  );
  handle(IPC.deploySecurity.listDevices, (server) => security.listDevices(serverId(server)));
  handle(IPC.deploySecurity.revokeDevice, (server, device) =>
    security.revokeDevice(serverId(server), id(device, 'device')),
  );
  handle(IPC.deploySecurity.listSessions, (server) => security.listSessions(serverId(server)));
  handle(IPC.deploySecurity.revokeSession, (server, session) =>
    security.revokeSession(serverId(server), id(session, 'session')),
  );
  handle(IPC.deploySecurity.revokeOtherSessions, (server) =>
    security.revokeOtherSessions(serverId(server)),
  );
  handle(IPC.deploySecurity.queryAudit, (input) => security.queryAudit(auditQueryInput(input)));
  handle(IPC.deploySecurity.verifyAudit, (server) => security.verifyAudit(serverId(server)));
  handle(IPC.deploySecurity.exportAudit, (input) => security.exportAudit(auditExportInput(input)));
}
