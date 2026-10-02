import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type RdpAgentSessionState, useRdpAgentStore } from '@/stores/rdpAgentStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { RdpAgentStatusBar } from './RdpAgentStatusBar';

function renderBar(state: Partial<RdpAgentSessionState> | null, onOpenHistory = vi.fn()) {
  if (state) {
    useRdpAgentStore.setState({
      sessions: { s1: { mode: 'approve-all', phase: 'thinking', step: 1, ...state } },
    });
  }
  return {
    ...renderWithProviders(<RdpAgentStatusBar sessionId="s1" onOpenHistory={onOpenHistory} />),
    onOpenHistory,
  };
}

describe('RdpAgentStatusBar', () => {
  it('renders nothing without a task', () => {
    const { container } = renderBar(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the step while the AI looks at the screen, with Stop', async () => {
    const { user, bridge } = renderBar({ phase: 'thinking', step: 3 });
    expect(screen.getByText(/Step 3/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(bridge.$fn('rdpAgent.stop')).toHaveBeenCalledWith('s1');
  });

  it('offers Approve and Skip on a proposed action', async () => {
    const { user, bridge } = renderBar({
      phase: 'proposed',
      action: 'TYPE "hello"',
      message: 'Types text into the focused window.',
    });
    expect(screen.getByText('TYPE "hello"')).toBeInTheDocument();
    expect(screen.getByText(/Types text into the focused window/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(bridge.$fn('rdpAgent.approveAction')).toHaveBeenCalledWith('s1');
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(bridge.$fn('rdpAgent.skipAction')).toHaveBeenCalledWith('s1');
  });

  it('shows the action being carried out', () => {
    renderBar({ phase: 'acting', action: 'CLICK 100 200' });
    expect(screen.getByText('CLICK 100 200')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('sends an answer to a question', async () => {
    const { user, bridge } = renderBar({ phase: 'needs-input', message: 'Which file?' });
    expect(screen.getByText('Which file?')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Your answer/), 'report.docx{Enter}');
    expect(bridge.$fn('rdpAgent.answerNeedsInput')).toHaveBeenCalledWith('s1', 'report.docx');
  });

  it('offers Continue and Stop on a paused run', async () => {
    const { user, bridge } = renderBar({
      phase: 'error',
      canContinue: true,
      message: 'The screenshot timed out.',
    });
    expect(screen.getByText('The screenshot timed out.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(bridge.$fn('rdpAgent.continueTask')).toHaveBeenCalledWith('s1');
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(bridge.$fn('rdpAgent.stop')).toHaveBeenCalledWith('s1');
    expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
  });

  it('lets a finished run be dismissed', async () => {
    const { user } = renderBar({ phase: 'finished', message: 'Notepad is open.' });
    expect(screen.getByText('Notepad is open.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(useRdpAgentStore.getState().sessions.s1).toBeUndefined();
  });

  it('opens the history', async () => {
    const { user, onOpenHistory } = renderBar({ phase: 'stopped', message: 'You took over.' });
    await user.click(screen.getByRole('button', { name: /History/ }));
    expect(onOpenHistory).toHaveBeenCalled();
  });
});
