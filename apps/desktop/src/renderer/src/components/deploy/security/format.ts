import { DEPLOY_ROLES, type DeployRole } from '@shared/deploySecurityTypes';
import { shortAge } from '@/lib/time';

/** Words for the Security area: roles, and times relative to now. */

export const ROLE_LABEL: Record<DeployRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
};

/** What each role may do; each includes the ones below it. */
export const ROLE_SUMMARY: Record<DeployRole, string> = {
  owner: 'Everything, including users and the security of the server.',
  admin: 'Runs the server: commands, websites, firewall, certificates and the audit trail.',
  operator: 'Deploys and runs apps, updates packages and restarts services.',
  viewer: 'Sees everything and changes nothing.',
};

export function isRole(value: string | undefined): value is DeployRole {
  return DEPLOY_ROLES.includes(value as DeployRole);
}

export function roleLabel(role: string | undefined): string {
  return isRole(role) ? ROLE_LABEL[role] : 'No role';
}

/** "an Admin", "a Viewer". */
export function withArticle(role: DeployRole): string {
  return `${role === 'viewer' ? 'a' : 'an'} ${ROLE_LABEL[role]}`;
}

/** Whether these roles include `role`, the way the core nests them. */
export function hasRole(roles: readonly string[] | undefined, role: DeployRole): boolean {
  const needed = DEPLOY_ROLES.indexOf(role);
  return (roles ?? []).some((held) => isRole(held) && DEPLOY_ROLES.indexOf(held) <= needed);
}

export function ago(unixMs: number, now = Date.now()): string {
  return now - unixMs < 60_000 ? 'just now' : `${shortAge(unixMs, now)} ago`;
}

/** "in 15m", "in 3d". */
export function fromNow(unixMs: number, now = Date.now()): string {
  return `in ${shortAge(now, unixMs)}`;
}

export function clockTime(unixMs: number): string {
  return new Date(unixMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(unixMs: number): string {
  return new Date(unixMs).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
