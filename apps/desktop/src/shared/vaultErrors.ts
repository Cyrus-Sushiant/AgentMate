export type VaultErrorCode =
  | 'locked'
  | 'uninitialized'
  | 'exists'
  | 'not-found'
  | 'invalid'
  | 'corrupt'
  | 'weak-password'
  | 'forbidden';

const CODE = /\[vault:([a-z-]+)\]\s*/;
const REMOTE_PREFIX = /^Error invoking remote method '[^']+': (?:\w*Error: )?/;

/** Electron only carries an error's message over IPC, so the code rides along inside it. */
export function encodeVaultError(code: VaultErrorCode, message: string): string {
  return `[vault:${code}] ${message}`;
}

export function vaultErrorCode(error: unknown): VaultErrorCode | null {
  const message = error instanceof Error ? error.message : String(error);
  return (message.match(CODE)?.[1] as VaultErrorCode | undefined) ?? null;
}

/** The human part of the message, without Electron's wrapper or the code tag. */
export function vaultErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(REMOTE_PREFIX, '').replace(CODE, '');
}
