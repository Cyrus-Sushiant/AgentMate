import { describe, expect, it } from 'vitest';
import { coreErrorCode, coreErrorMessage, encodeCoreError } from './coreErrors';

/** A server core's refusal keeps its code across IPC, so the renderer can act on it. */
describe('core error codes', () => {
  it('survive the trip through Electron IPC', () => {
    const crossed = new Error(
      `Error invoking remote method 'deploy:signIn': Error: ${encodeCoreError('totpRequired', 'Enter the code from your authenticator app.')}`,
    );

    expect(coreErrorCode(crossed)).toBe('totpRequired');
    expect(coreErrorMessage(crossed)).toBe('Enter the code from your authenticator app.');
  });

  it('leave no SSH tag in the message either, since a core call can fail on its SSH leg', () => {
    const crossed = new Error(
      "Error invoking remote method 'deploy:access': Error: [ssh:host-key-changed] The host key of prod.example changed.",
    );

    expect(coreErrorCode(crossed)).toBeNull();
    expect(coreErrorMessage(crossed)).toBe('The host key of prod.example changed.');
  });

  it('read as nothing for errors without one, or with a code this app does not know', () => {
    expect(coreErrorCode(new Error('disk full'))).toBeNull();
    expect(coreErrorCode(new Error('[core:launchRockets] no'))).toBeNull();
    expect(coreErrorMessage(new Error('disk full'))).toBe('disk full');
  });
});
