import type { RdpAgentHistoryRun, SshAgentHistoryRun } from '@shared/apiTypes';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { SshAgentHistoryDialog } from './SshAgentHistoryDialog';

const rdpRun: RdpAgentHistoryRun = {
  id: 'run-1',
  sessionId: 'rdp-1',
  prompt: 'Open Notepad and type hello',
  aiLabel: 'Claude Code',
  startedAt: Date.now() - 60_000,
  endedAt: Date.now(),
  status: 'finished',
  entries: [
    {
      kind: 'action',
      at: Date.now() - 50_000,
      action: 'KEY win+r',
      outcome: 'Pressed Win+R',
      ok: true,
    },
    {
      kind: 'action',
      at: Date.now() - 40_000,
      action: 'CLICK 900 900',
      outcome: 'The session closed before the click landed',
      ok: false,
    },
    { kind: 'finished', at: Date.now(), text: 'Notepad shows hello.' },
  ],
};

describe('SshAgentHistoryDialog', () => {
  it('loads from a custom source and shows desktop actions', async () => {
    const load = vi.fn(async () => [rdpRun]);
    renderWithProviders(
      <SshAgentHistoryDialog
        sessionId="rdp-1"
        sessionTitle="Office PC"
        open
        onOpenChange={() => undefined}
        source={{ kind: 'rdp', queryKey: ['rdp-agent-history', 'rdp-1'], load, live: undefined }}
      />,
    );

    expect(await screen.findByText('KEY win+r')).toBeInTheDocument();
    expect(load).toHaveBeenCalled();
    expect(screen.getByText('Pressed Win+R')).toBeInTheDocument();
    expect(screen.getByText('CLICK 900 900')).toBeInTheDocument();
    expect(screen.getByText('The session closed before the click landed')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/2 actions/)).toBeInTheDocument();
    expect(screen.getByText(/Every task the AI ran in Office PC/)).toHaveTextContent(/each action/);
  });

  it('reads the terminal history by default', async () => {
    const sshRun: SshAgentHistoryRun = {
      id: 'run-2',
      sessionId: 'ssh-1',
      prompt: 'Check disk usage',
      aiLabel: 'Codex',
      startedAt: Date.now() - 1000,
      endedAt: Date.now(),
      status: 'finished',
      entries: [
        {
          kind: 'command',
          at: Date.now(),
          command: 'df -h',
          output: '/dev/sda1 50%',
          exitCode: 0,
          timedOut: false,
        },
      ],
    };
    const { bridge } = renderWithProviders(
      <SshAgentHistoryDialog
        sessionId="ssh-1"
        sessionTitle="web-1"
        open
        onOpenChange={() => undefined}
      />,
      { bridge: { 'sshAgent.history': [sshRun] } },
    );

    expect(await screen.findByText('df -h')).toBeInTheDocument();
    expect(bridge.$fn('sshAgent.history')).toHaveBeenCalledWith('ssh-1');
    expect(screen.getByText(/1 command/)).toBeInTheDocument();
  });

  it('shows what the user told the AI mid-run as their own message, in order', async () => {
    const at = Date.now();
    const run: SshAgentHistoryRun = {
      id: 'run-3',
      sessionId: 'ssh-1',
      prompt: 'Clean up the server',
      aiLabel: 'Codex',
      startedAt: at - 3000,
      endedAt: at,
      status: 'finished',
      entries: [
        { kind: 'message', at: at - 2000, text: 'leave /var/lib/docker alone' },
        { kind: 'skipped', at: at - 1500, command: 'rm -rf /var/lib/docker' },
        {
          kind: 'command',
          at: at - 1000,
          command: 'df -h',
          output: '/dev/sda1 50%',
          exitCode: 0,
          timedOut: false,
        },
        { kind: 'finished', at, text: 'Cleaned up.' },
      ],
    };
    renderWithProviders(
      <SshAgentHistoryDialog
        sessionId="ssh-1"
        sessionTitle="web-1"
        open
        onOpenChange={() => undefined}
      />,
      { bridge: { 'sshAgent.history': [run] } },
    );

    const message = await screen.findByText('leave /var/lib/docker alone');
    // The same bubble the user's answers get: their words, on their side, labelled as them.
    expect(message.parentElement).toHaveClass('items-end');
    expect(message.parentElement).toHaveTextContent(/You ·/);
    // It sits between the prompt and what the AI did afterwards. The prompt is also the task's
    // title in the list on the left, which comes first in the page, so only the timeline is read.
    const order = screen
      .getAllByText(/Clean up the server|leave \/var\/lib\/docker alone|df -h|Cleaned up\./)
      .map((el) => el.textContent)
      .slice(-4);
    expect(order).toEqual([
      'Clean up the server',
      'leave /var/lib/docker alone',
      'df -h',
      'Cleaned up.',
    ]);
  });

  it('puts the message in the copied transcript', async () => {
    const at = Date.now();
    const run: SshAgentHistoryRun = {
      id: 'run-4',
      sessionId: 'ssh-1',
      prompt: 'Clean up the server',
      aiLabel: 'Codex',
      startedAt: at - 2000,
      endedAt: at,
      status: 'finished',
      entries: [
        { kind: 'message', at: at - 1000, text: 'leave /var/lib/docker alone' },
        { kind: 'finished', at, text: 'Cleaned up.' },
      ],
    };
    const { user } = renderWithProviders(
      <SshAgentHistoryDialog
        sessionId="ssh-1"
        sessionTitle="web-1"
        open
        onOpenChange={() => undefined}
      />,
      { bridge: { 'sshAgent.history': [run] } },
    );

    await user.click(await screen.findByRole('button', { name: /Copy transcript/ }));
    // user-event gives the page a clipboard of its own, so the copy is read back from it.
    await vi.waitFor(async () =>
      expect(await navigator.clipboard.readText()).toContain(
        'You told the AI: leave /var/lib/docker alone',
      ),
    );
  });
});
