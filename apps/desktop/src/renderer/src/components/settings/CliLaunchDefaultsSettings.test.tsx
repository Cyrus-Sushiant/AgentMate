// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCliStore } from '@/stores/cliStore';
import { CliLaunchDefaultsSettings } from './CliLaunchDefaultsSettings';

/**
 * The Launch defaults section with the real CLI store. The point is that a flag saved in the
 * Arguments box is never hidden behind "Not set", and that "Remove it" really stops it.
 */

const settingsUpdate = vi.fn((_patch: unknown) => Promise.resolve({}));

function renderSection(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <CliLaunchDefaultsSettings />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

async function claudeRow(): Promise<HTMLElement> {
  const name = await screen.findByText(/^Claude Code/);
  const button = name.closest('button');
  if (!button) throw new Error('Claude Code row has no toggle');
  return button;
}

async function openClaudeRow(): Promise<HTMLElement> {
  const toggle = await claudeRow();
  fireEvent.click(toggle);
  const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
  if (!panel) throw new Error('Claude Code panel did not open');
  return panel;
}

beforeEach(() => {
  settingsUpdate.mockClear();
  Object.assign(window, {
    agentmat: {
      platform: 'win32',
      settings: { update: settingsUpdate },
      cli: {
        detectAll: () => Promise.resolve([{ id: 'claude-code', installed: true }]),
      },
      agents: { statusHookSettings: () => Promise.resolve(null) },
    },
  });
  useCliStore.setState({
    cliArgs: {},
    cliLaunchDefaults: {},
    cliOrder: [],
    lastRunInfoByCli: {},
  });
});

afterEach(() => {
  cleanup();
});

describe('CliLaunchDefaultsSettings', () => {
  it('says Not set when neither Settings nor the Arguments box sets anything', async () => {
    renderSection();
    const row = await claudeRow();
    expect(within(row).getByText('Not set')).toBeTruthy();

    const panel = await openClaudeRow();
    expect(within(panel).queryByText(/Still sent/)).toBeNull();
    expect(within(panel).getByText('(no flags added)')).toBeTruthy();
  });

  it('does not treat the last model a CLI ran on as a setting', async () => {
    useCliStore.setState({
      lastRunInfoByCli: { 'claude-code': { model: 'claude-haiku-4-5' } },
    });
    renderSection();
    const row = await claudeRow();
    expect(within(row).getByText('Not set')).toBeTruthy();
    expect(within(row).queryByText(/Haiku/)).toBeNull();
  });

  it('shows a model saved in the Arguments box instead of Not set', async () => {
    useCliStore.setState({ cliArgs: { 'claude-code': '--model haiku' } });
    renderSection();
    const row = await claudeRow();
    expect(within(row).queryByText('Not set')).toBeNull();
    expect(within(row).getByText(/Haiku/)).toBeTruthy();

    const panel = await openClaudeRow();
    const note = within(panel)
      .getByText(/Still sent/)
      .closest('div');
    expect(note?.textContent).toContain('--model haiku');
  });

  it('removes the model from the saved arguments and keeps the rest', async () => {
    useCliStore.setState({ cliArgs: { 'claude-code': '--verbose --model haiku' } });
    renderSection();
    const panel = await openClaudeRow();

    fireEvent.click(within(panel).getByRole('button', { name: 'Remove it' }));

    expect(useCliStore.getState().cliArgs['claude-code']).toBe('--verbose');
    expect(settingsUpdate).toHaveBeenLastCalledWith({ cliArgs: { 'claude-code': '--verbose' } });
    await waitFor(() => expect(within(panel).queryByText(/Still sent/)).toBeNull());
  });

  it('empties the Arguments box when the model was all it held', async () => {
    useCliStore.setState({ cliArgs: { 'claude-code': '--model haiku' } });
    renderSection();
    const panel = await openClaudeRow();
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove it' }));
    expect(useCliStore.getState().cliArgs).toEqual({});
    expect(settingsUpdate).toHaveBeenLastCalledWith({ cliArgs: {} });
    expect(within(await claudeRow()).getByText('Not set')).toBeTruthy();
  });

  it('marks a launch default the saved arguments override as skipped', async () => {
    useCliStore.setState({
      cliArgs: { 'claude-code': '--model haiku' },
      cliLaunchDefaults: { 'claude-code': { model: 'opus' } },
    });
    renderSection();
    const panel = await openClaudeRow();
    expect(
      within(panel).getByText(/Skipped: this CLI's saved arguments already set it/),
    ).toBeTruthy();
    // Overridden, not "still sent": the field is set here, so the other note would be wrong.
    expect(within(panel).queryByText(/Still sent/)).toBeNull();
  });

  it('shows a mode flag from the Arguments box with a way to remove it', async () => {
    useCliStore.setState({ cliArgs: { 'claude-code': '--permission-mode plan' } });
    renderSection();
    const panel = await openClaudeRow();
    expect(within(panel).getByText(/Still sent/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove it' }));
    expect(useCliStore.getState().cliArgs).toEqual({});
  });

  it('previews the full command, saved arguments included', async () => {
    useCliStore.setState({
      cliArgs: { 'claude-code': '--verbose' },
      cliLaunchDefaults: { 'claude-code': { mode: 'auto' } },
    });
    renderSection();
    const panel = await openClaudeRow();
    const preview = panel.querySelector('code.font-mono');
    expect(preview?.textContent).toBe('claude --permission-mode auto --verbose');
  });
});
