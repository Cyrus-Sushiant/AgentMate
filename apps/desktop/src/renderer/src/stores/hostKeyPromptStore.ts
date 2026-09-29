import type { SshHostKeyStatus } from '@shared/sshHostKey';
import { create } from 'zustand';

/**
 * The one open "this server's host key changed" question, answered by `HostKeyChangedDialog`.
 * A newer question answers the older one with "don't trust", so nobody waits forever.
 */

interface HostKeyPromptRequest extends SshHostKeyStatus {
  resolve: (trust: boolean) => void;
}

interface HostKeyPromptState {
  request: HostKeyPromptRequest | null;
}

export const useHostKeyPromptStore = create<HostKeyPromptState>(() => ({ request: null }));

export function promptHostKeyTrust(status: SshHostKeyStatus): Promise<boolean> {
  return new Promise((resolve) => {
    useHostKeyPromptStore.getState().request?.resolve(false);
    useHostKeyPromptStore.setState({ request: { ...status, resolve } });
  });
}

export function answerHostKeyPrompt(trust: boolean): void {
  const { request } = useHostKeyPromptStore.getState();
  if (!request) return;
  useHostKeyPromptStore.setState({ request: null });
  request.resolve(trust);
}
