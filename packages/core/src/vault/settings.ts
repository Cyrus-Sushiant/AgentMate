/** Minutes without vault activity before it locks. 0 means never. */
export const VAULT_AUTO_LOCK_CHOICES = [1, 5, 15, 30, 60, 0] as const;
export const DEFAULT_VAULT_AUTO_LOCK_MINUTES = 15;

/** Seconds before a copied secret is cleared from the clipboard. 0 means never. */
export const VAULT_CLIPBOARD_CLEAR_CHOICES = [10, 20, 30, 60, 90, 0] as const;
export const DEFAULT_VAULT_CLIPBOARD_CLEAR_SECONDS = 30;

export function normalizeVaultAutoLockMinutes(value: unknown): number {
  return (VAULT_AUTO_LOCK_CHOICES as readonly unknown[]).includes(value)
    ? (value as number)
    : DEFAULT_VAULT_AUTO_LOCK_MINUTES;
}

export function normalizeVaultClipboardClearSeconds(value: unknown): number {
  return (VAULT_CLIPBOARD_CLEAR_CHOICES as readonly unknown[]).includes(value)
    ? (value as number)
    : DEFAULT_VAULT_CLIPBOARD_CLEAR_SECONDS;
}
