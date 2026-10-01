/**
 * The Servers vault's refusal while its passkey is locked, as a class of its own, so callers far
 * from the vault (the Deploy section's lasting connections) can wait for the unlock instead of
 * retrying. It lives apart from vault.ts so they can know it without loading the vault.
 */

export const VAULT_LOCKED_MESSAGE = 'The vault is locked. Unlock it with your passkey first.';

export class VaultLockedError extends Error {
  constructor() {
    super(VAULT_LOCKED_MESSAGE);
    this.name = 'VaultLockedError';
  }
}
