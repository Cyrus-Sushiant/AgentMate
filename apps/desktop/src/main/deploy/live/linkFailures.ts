import { coreErrorCode } from '../../../shared/coreErrors';
import type { DeployConnectionState } from '../../../shared/deployTypes';
import { sshErrorCode } from '../../../shared/sshErrors';
import { VaultLockedError } from '../../ssh/vaultErrors';

/**
 * Which failures a server's link keeps retrying, and which wait for the user. A reboot, a dropped
 * tunnel or a core answering 503 pass by themselves; an ended session, a revoked device, a locked
 * vault or a changed host key do not, so retrying them only makes noise.
 */

export type BlockedState = Extract<
  DeployConnectionState,
  'offline' | 'needs-sign-in' | 'needs-re-enroll' | 'locked'
>;

/** A connection that cannot be opened until something changes, such as the core being installed. */
export class LinkBlockedError extends Error {
  readonly state: BlockedState;

  constructor(state: BlockedState, message: string) {
    super(message);
    this.name = 'LinkBlockedError';
    this.state = state;
  }
}

/** The state to wait in for this failure, or null when it is worth trying again. */
export function blockedState(error: unknown): BlockedState | null {
  if (error instanceof LinkBlockedError) return error.state;
  if (error instanceof VaultLockedError) return 'locked';
  switch (coreErrorCode(error)) {
    case 'sessionExpired':
    case 'sessionRevoked':
    case 'lockedOut':
      return 'needs-sign-in';
    case 'deviceRevoked':
    case 'deviceUnknown':
      return 'needs-re-enroll';
    case 'notEnrolled':
    case 'tlsPinMismatch':
      return 'offline';
    default:
      break;
  }
  return sshErrorCode(error) === 'host-key-changed' ? 'offline' : null;
}
