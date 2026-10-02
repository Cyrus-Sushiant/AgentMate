import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRdpAgentStore } from '@/stores/rdpAgentStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { RdpAskAiDialog } from './RdpAskAiDialog';

const installed = [
  { id: 'claude-code', installed: true },
  { id: 'opencode', installed: true },
  { id: 'aider', installed: true },
  { id: 'codex-cli', installed: false },
];

function renderDialog(detected = installed) {
  return renderWithProviders(
    <RdpAskAiDialog sessionId="s1" open onOpenChange={() => undefined} />,
    { bridge: { 'cli.detectAll': detected } },
  );
}

async function cliPicker(): Promise<HTMLElement> {
  const pickers = await screen.findAllByRole('combobox');
  await waitFor(() => expect(pickers[0]).not.toBeDisabled());
  return pickers[0];
}

describe('RdpAskAiDialog', () => {
  it('only offers installed CLIs that can look at a screenshot', async () => {
    const { user } = renderDialog();
    const picker = await cliPicker();
    await waitFor(() => expect(picker).toHaveTextContent('Claude Code CLI'));

    await user.click(picker);
    const options = await screen.findAllByRole('option');
    const labels = options.map((option) => option.textContent);
    expect(labels).toContain('Claude Code CLI');
    expect(labels.some((label) => label?.includes('needs a model that can see images'))).toBe(true);
    expect(labels).not.toContain('OpenCode');
    expect(labels).not.toContain('Aider');
    expect(labels).not.toContain('Codex CLI');
  });

  it('tells the user screenshots go to the AI', async () => {
    renderDialog();
    expect(
      await screen.findByText(/Screenshots of this desktop are sent to the AI you pick/),
    ).toBeInTheDocument();
  });

  it('describes the risky-action guard in terms of the desktop', async () => {
    renderDialog();
    expect(
      await screen.findByText('Ask before shortcuts like Win+R or Alt+F4 and before typing text.'),
    ).toBeInTheDocument();
  });

  it('starts the task with the chosen mode and CLI', async () => {
    const { user, bridge } = renderDialog();
    const picker = await cliPicker();
    await waitFor(() => expect(picker).toHaveTextContent('Claude Code CLI'));

    await user.type(screen.getByRole('textbox'), 'Open Notepad and type hello');
    await user.click(screen.getByRole('button', { name: /Fully autonomous/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() =>
      expect(bridge.$fn('rdpAgent.start')).toHaveBeenCalledWith({
        sessionId: 's1',
        prompt: 'Open Notepad and type hello',
        mode: 'autonomous',
        cliId: 'claude-code',
        modelId: null,
        effort: null,
      }),
    );
  });

  it('uses the Settings provider when no vision CLI is installed', async () => {
    const { user, bridge } = renderDialog([{ id: 'opencode', installed: true }]);
    const picker = await cliPicker();
    await waitFor(() => expect(picker).toHaveTextContent(/AI provider/));
    expect(screen.getByText(/No installed agent CLI can look at a screenshot/)).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'Close the browser');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() =>
      expect(bridge.$fn('rdpAgent.start')).toHaveBeenCalledWith(
        expect.objectContaining({ cliId: null, mode: 'approve-all' }),
      ),
    );
  });

  it('will not start without a task', async () => {
    renderDialog();
    const picker = await cliPicker();
    await waitFor(() => expect(picker).toHaveTextContent('Claude Code CLI'));
    const start = screen.getByRole('button', { name: 'Start' });
    expect(start).toBeDisabled();
  });

  it('seeds the mode picked last time', async () => {
    useRdpAgentStore.setState({ lastMode: 'approve-risky' });
    renderDialog();
    const dialog = await screen.findByRole('dialog');
    const guarded = within(dialog).getByRole('button', { name: /Auto, guard risky ones/ });
    expect(guarded.className).toMatch(/border-primary/);
  });
});
