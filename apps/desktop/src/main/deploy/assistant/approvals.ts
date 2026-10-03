import type { SecretEnvelope } from '../../../shared/apiTypes';
import { encodeCoreError } from '../../../shared/coreErrors';
import type { ExecApproval } from '../../../shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { ICoreHub } from '../../../shared/deploy/protocol/generated/TypedSignalR.Client/AgentMate.ServerCore.Contracts';
import { signMessage } from '../auth/deviceKey';
import type { DeployState } from '../state';

/**
 * Approvals for the Deploy AI's commands (E09 T5). Only a user's click on Approve leads here: the
 * core hands out a single-use nonce, and this computer's device key signs it together with the
 * exact command text, the device and the session. The core checks the signature against the key
 * it enrolled before it runs the command, so a command the user did not approve, or one changed
 * after they did, cannot run.
 */

/** The text the core verifies (its ExecApprovals.Message), field for field. */
export function execApprovalMessage(
  nonceId: string,
  nonce: string,
  deviceId: string,
  sessionId: string,
  command: string,
): string {
  return ['agentmate-core/exec/v1', nonceId, nonce, deviceId, sessionId, command].join('\n');
}

export interface ApprovalSignerDeps {
  state: Pick<DeployState, 'device'>;
  unseal: (envelope: SecretEnvelope) => Promise<string>;
}

export function approvalSigner(
  deps: ApprovalSignerDeps,
): (serverId: string, hub: ICoreHub, command: string) => Promise<ExecApproval> {
  return async (serverId, hub, command) => {
    const device = await deps.state.device(serverId);
    if (!device?.sessionId) {
      throw new Error(encodeCoreError('sessionExpired', 'Sign in to this server core again.'));
    }
    const nonce = await hub.newExecApproval();
    const privateKey = await deps.unseal(device.privateKey);
    const message = execApprovalMessage(
      nonce.nonceId,
      nonce.nonce,
      device.deviceId,
      device.sessionId,
      command,
    );
    return { nonceId: nonce.nonceId, signature: signMessage(privateKey, message) };
  };
}
