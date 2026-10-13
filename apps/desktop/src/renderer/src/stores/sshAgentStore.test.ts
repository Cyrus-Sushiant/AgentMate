import type { SshAgentProgress } from '@shared/apiTypes';
import { beforeEach, describe, expect, it } from 'vitest';
import { currentBridge, type FakeBridge } from '../../../test/renderer/agentmatBridge';
import { initSshAgentStatus, sendSshAgentMessage, useSshAgentStore } from './sshAgentStore';

let bridge: FakeBridge;

beforeEach(() => {
  bridge = currentBridge();
  useSshAgentStore.setState({ sessions: {} });
});

function progress(patch: Partial<SshAgentProgress>): SshAgentProgress {
  return { sessionId: 's1', phase: 'thinking', step: 1, ...patch };
}

describe('sendSshAgentMessage', () => {
  it('sends the text to main and reports that it was taken', async () => {
    bridge.$set('sshAgent.sendMessage', async () => true);
    expect(await sendSshAgentMessage('s1', 'only look at /var/log')).toBe(true);
    expect(bridge.$fn('sshAgent.sendMessage')).toHaveBeenCalledWith('s1', 'only look at /var/log');
  });

  it('reports a task that is already over, so the caller keeps the text', async () => {
    bridge.$set('sshAgent.sendMessage', async () => false);
    expect(await sendSshAgentMessage('s1', 'too late')).toBe(false);
  });

  it('lets a failure reach the caller', async () => {
    bridge.$set('sshAgent.sendMessage', async () => {
      throw new Error('ipc down');
    });
    await expect(sendSshAgentMessage('s1', 'hello')).rejects.toThrow('ipc down');
  });
});

describe('following progress', () => {
  it('keeps how many messages the AI has not read yet, and drops it once it has', () => {
    initSshAgentStatus();

    bridge.$emit('sshAgent.onProgress', progress({ phase: 'running', command: 'df -h' }));
    expect(useSshAgentStore.getState().sessions.s1?.queuedMessages).toBeUndefined();

    bridge.$emit(
      'sshAgent.onProgress',
      progress({ phase: 'running', command: 'df -h', queuedMessages: 2 }),
    );
    expect(useSshAgentStore.getState().sessions.s1).toMatchObject({
      phase: 'running',
      command: 'df -h',
      queuedMessages: 2,
    });

    // The next step asked the AI with them, and the run reports no queue.
    bridge.$emit('sshAgent.onProgress', progress({ phase: 'thinking', step: 2 }));
    expect(useSshAgentStore.getState().sessions.s1?.queuedMessages).toBeUndefined();
  });
});
