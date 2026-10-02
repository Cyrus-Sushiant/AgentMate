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
});
