import { describe, expect, it } from 'vitest';
import { encodeCoreError } from '../../../shared/coreErrors';
import { encodeSshError } from '../../../shared/sshErrors';
import { VaultLockedError } from '../../ssh/vaultErrors';
import { HubStartError } from '../connection/liveHub';
import { blockedState, LinkBlockedError } from './linkFailures';

/**
 * A link keeps trying through anything that can pass by itself (a reboot, a dropped tunnel, a
 * core answering 503), and stops for what only the user can fix, saying which.
 */

describe('blockedState', () => {
  it('waits for a sign-in when the session is over or the account is locked', () => {
    for (const code of ['sessionExpired', 'sessionRevoked', 'lockedOut'] as const) {
      expect(blockedState(new Error(encodeCoreError(code, 'no')))).toBe('needs-sign-in');
    }
  });

  it('waits for a new enrollment when the core no longer knows this device', () => {
    for (const code of ['deviceRevoked', 'deviceUnknown'] as const) {
      expect(blockedState(new Error(encodeCoreError(code, 'no')))).toBe('needs-re-enroll');
    }
  });

  it('waits for the vault when a secret it needs is locked', () => {
    expect(blockedState(new VaultLockedError())).toBe('locked');
  });

  it('stays offline without retrying for what needs fixing elsewhere', () => {
    expect(blockedState(new Error(encodeCoreError('notEnrolled', 'no')))).toBe('offline');
    expect(blockedState(new Error(encodeSshError('host-key-changed', 'no')))).toBe('offline');
    expect(blockedState(new LinkBlockedError('offline', 'Not installed.'))).toBe('offline');
  });

  it('keeps trying through everything else', () => {
    expect(blockedState(new HubStartError('WebSocket failed to connect.', 503))).toBeNull();
    expect(blockedState(new Error(encodeCoreError('rateLimited', 'slow down')))).toBeNull();
    expect(blockedState(new Error('connect ECONNREFUSED 10.0.0.5:22'))).toBeNull();
    expect(blockedState('a string')).toBeNull();
  });
});
