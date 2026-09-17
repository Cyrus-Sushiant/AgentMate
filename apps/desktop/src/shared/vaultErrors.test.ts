import { describe, expect, it } from 'vitest';
import { encodeVaultError, vaultErrorCode, vaultErrorMessage } from './vaultErrors';

describe('vault errors across IPC', () => {
  it('survives the wrapping Electron adds to rejected invokes', () => {
    const remote = new Error(
      `Error invoking remote method 'vault:list': Error: ${encodeVaultError('locked', 'The vault is locked.')}`,
    );
    expect(vaultErrorCode(remote)).toBe('locked');
    expect(vaultErrorMessage(remote)).toBe('The vault is locked.');
  });

  it('falls back gracefully for other errors', () => {
    const remote = new Error("Error invoking remote method 'vault:save': Error: disk full");
    expect(vaultErrorCode(remote)).toBeNull();
    expect(vaultErrorMessage(remote)).toBe('disk full');
    expect(vaultErrorCode('nope')).toBeNull();
    expect(vaultErrorMessage('plain text')).toBe('plain text');
  });
});
