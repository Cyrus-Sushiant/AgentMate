import { encodeSshError } from '@shared/sshErrors';
import type { SshHostKeyStatus } from '@shared/sshHostKey';
import { describe, expect, it, vi } from 'vitest';
import { installAgentmatBridge } from '../../../../test/renderer/agentmatBridge';
import { answerHostKeyPrompt, useHostKeyPromptStore } from '../../stores/hostKeyPromptStore';
import { withHostKeyTrust } from './hostKeyTrust';

/**
 * Any SSH connection the app makes (a terminal tab today, Deploy tomorrow) can hit a changed host
 * key. The user sees both fingerprints and decides; nothing is trusted without that answer.
 */

const status: SshHostKeyStatus = {
  serverId: 'srv-1',
  nickname: 'prod',
  host: 'prod.example',
  port: 22,
  stored: 'ab'.repeat(32),
  presented: 'cd'.repeat(32),
};

const hostKeyChanged = () =>
  new Error(
    `Error invoking remote method 'ssh:create': Error: ${encodeSshError('host-key-changed', 'The host key changed.')}`,
  );

describe('withHostKeyTrust', () => {
  it('passes a successful connection straight through', async () => {
    const attempt = vi.fn().mockResolvedValue('connected');

    await expect(withHostKeyTrust('srv-1', attempt)).resolves.toBe('connected');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('rethrows failures that are not about the host key', async () => {
    const attempt = vi.fn().mockRejectedValue(new Error('Could not reach prod.example:22.'));

    await expect(withHostKeyTrust('srv-1', attempt)).rejects.toThrow(
      'Could not reach prod.example:22.',
    );
  });

  it('asks, trusts the presented key and tries again when the user agrees', async () => {
    const trust = vi.fn(async () => undefined);
    installAgentmatBridge({ 'ssh.hostKeyStatus': status, 'ssh.trustHostKey': trust });
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(hostKeyChanged())
      .mockResolvedValueOnce('connected');

    const result = withHostKeyTrust('srv-1', attempt);
    await vi.waitFor(() => expect(useHostKeyPromptStore.getState().request).not.toBeNull());
    expect(useHostKeyPromptStore.getState().request).toMatchObject(status);
    answerHostKeyPrompt(true);

    await expect(result).resolves.toBe('connected');
    expect(trust).toHaveBeenCalledWith('srv-1', status.presented);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('does not connect or trust anything when the user declines', async () => {
    const trust = vi.fn(async () => undefined);
    installAgentmatBridge({ 'ssh.hostKeyStatus': status, 'ssh.trustHostKey': trust });
    const attempt = vi.fn().mockRejectedValue(hostKeyChanged());

    const result = withHostKeyTrust('srv-1', attempt);
    await vi.waitFor(() => expect(useHostKeyPromptStore.getState().request).not.toBeNull());
    answerHostKeyPrompt(false);

    await expect(result).rejects.toThrow(/prod.*not trusted/);
    expect(trust).not.toHaveBeenCalled();
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('retries without asking when the key was trusted meanwhile', async () => {
    installAgentmatBridge({ 'ssh.hostKeyStatus': { ...status, stored: status.presented } });
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(hostKeyChanged())
      .mockResolvedValueOnce('connected');

    await expect(withHostKeyTrust('srv-1', attempt)).resolves.toBe('connected');
    expect(useHostKeyPromptStore.getState().request).toBeNull();
  });

  it('answers an older question with no when a newer one arrives', async () => {
    installAgentmatBridge({ 'ssh.hostKeyStatus': status });
    const first = withHostKeyTrust('srv-1', vi.fn().mockRejectedValue(hostKeyChanged()));
    await vi.waitFor(() => expect(useHostKeyPromptStore.getState().request).not.toBeNull());

    const second = withHostKeyTrust('srv-1', vi.fn().mockRejectedValue(hostKeyChanged()));
    await expect(first).rejects.toThrow(/not trusted/);
    answerHostKeyPrompt(false);
    await expect(second).rejects.toThrow(/not trusted/);
  });

  it('ignores an answer when nothing was asked', () => {
    answerHostKeyPrompt(true);

    expect(useHostKeyPromptStore.getState().request).toBeNull();
  });
});
