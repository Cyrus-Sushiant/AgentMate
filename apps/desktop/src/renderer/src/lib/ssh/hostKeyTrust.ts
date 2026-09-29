import { sshErrorCode } from '@shared/sshErrors';
import { promptHostKeyTrust } from '@/stores/hostKeyPromptStore';

/**
 * Runs an SSH connect and, when the server's host key changed, lets the user decide. Only an
 * explicit "trust" stores the new key, and main re-reads the key before storing it, so what gets
 * trusted is the key the user was shown.
 *
 * Shared by every place the app connects to a saved server, so the question always looks the same.
 */
export async function withHostKeyTrust<T>(serverId: string, attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (sshErrorCode(error) !== 'host-key-changed') throw error;

    const status = await window.agentmat.ssh.hostKeyStatus(serverId);
    // Someone trusted the new key while this connect was failing (another tab, say).
    if (status.stored === status.presented) return attempt();

    const trusted = await promptHostKeyTrust(status);
    if (!trusted) {
      throw new Error(`Not connected to ${status.nickname}: its new host key was not trusted.`);
    }
    await window.agentmat.ssh.trustHostKey(serverId, status.presented);
    return attempt();
  }
}
