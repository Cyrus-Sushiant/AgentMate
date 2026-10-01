import type { CloudflarePermissionId } from './cloudflareTypes';
import { sshErrorMessage } from './sshErrors';

/**
 * Cloudflare failures the page reacts to rather than just shows: a permission the token lacks
 * (named, so the guided fix can say what to add), a token Cloudflare no longer accepts, no token
 * saved yet, and a saved token locked behind the Servers passkey. Electron only carries an
 * error's message across IPC, so the code rides inside it, as with the SSH and core errors.
 */
export type CloudflareErrorCode = 'missing-permission' | 'token-rejected' | 'no-token' | 'locked';

const CODES: ReadonlySet<string> = new Set<CloudflareErrorCode>([
  'missing-permission',
  'token-rejected',
  'no-token',
  'locked',
]);
const PERMISSIONS: ReadonlySet<string> = new Set<CloudflarePermissionId>([
  'zone',
  'dns',
  'zoneSettings',
  'cachePurge',
  'waf',
  'accessRules',
]);
const TAG = /\[cloudflare:([a-z-]+)(?::([A-Za-z]+))?\]\s*/;

export function encodeCloudflareError(
  code: CloudflareErrorCode,
  message: string,
  permission?: CloudflarePermissionId,
): string {
  return `[cloudflare:${code}${permission ? `:${permission}` : ''}] ${message}`;
}

function tag(error: unknown): RegExpMatchArray | null {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(TAG);
}

export function cloudflareErrorCode(error: unknown): CloudflareErrorCode | null {
  const code = tag(error)?.[1];
  return code && CODES.has(code) ? (code as CloudflareErrorCode) : null;
}

/** For a missing-permission error, the permission the token needs. */
export function cloudflareErrorPermission(error: unknown): CloudflarePermissionId | null {
  const permission = tag(error)?.[2];
  return permission && PERMISSIONS.has(permission) ? (permission as CloudflarePermissionId) : null;
}

/** The human part of the message, without Electron's wrapper or the code tag. */
export function cloudflareErrorMessage(error: unknown): string {
  return sshErrorMessage(error).replace(TAG, '');
}
