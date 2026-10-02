import { describe, expect, it } from 'vitest';
import { encodeSshError, sshErrorCode, sshErrorMessage } from './sshErrors';

/**
 * Electron only carries an error's message across IPC, so SSH failures that the renderer has to
 * react to (a changed host key, a sudo password) carry a code inside the message.
 */
describe('ssh error codes', () => {
  it('round-trips a code through a plain message', () => {
    const message = encodeSshError('host-key-changed', 'The host key changed.');

    expect(sshErrorCode(new Error(message))).toBe('host-key-changed');
    expect(sshErrorMessage(new Error(message))).toBe('The host key changed.');
  });

  it('reads the code through Electron’s IPC wrapper', () => {
    const wrapped = new Error(
      `Error invoking remote method 'ssh:create': Error: ${encodeSshError('sudo-password-required', 'Needs the sudo password.')}`,
    );

    expect(sshErrorCode(wrapped)).toBe('sudo-password-required');
    expect(sshErrorMessage(wrapped)).toBe('Needs the sudo password.');
  });

  it('returns no code for an ordinary error', () => {
    expect(sshErrorCode(new Error('Could not reach example.com:22.'))).toBeNull();
    expect(sshErrorMessage(new Error('Could not reach example.com:22.'))).toBe(
      'Could not reach example.com:22.',
    );
  });

  it('accepts non-Error values', () => {
    expect(sshErrorCode(encodeSshError('sudo-password-rejected', 'No.'))).toBe(
      'sudo-password-rejected',
    );
    expect(sshErrorCode(undefined)).toBeNull();
    expect(sshErrorMessage(encodeSshError('sudo-password-rejected', 'No.'))).toBe('No.');
  });

  it('carries a locked Servers vault', () => {
    const message = encodeSshError('vault-locked', 'The vault is locked.');

    expect(sshErrorCode(new Error(message))).toBe('vault-locked');
  });

  it('ignores codes it does not know', () => {
    expect(sshErrorCode(new Error('[ssh:made-up] nope'))).toBeNull();
  });
});
