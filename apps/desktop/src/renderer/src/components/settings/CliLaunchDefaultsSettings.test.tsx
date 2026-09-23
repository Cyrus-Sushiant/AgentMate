// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCliStore } from '@/stores/cliStore';
import { CliLaunchDefaultsSettings } from './CliLaunchDefaultsSettings';

/**
 * The Launch defaults section with the real CLI store. It shows only what terminals start with:
 * the background task arguments from AI CLI Manager never show up here, since tabs don't use them.
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
  it('says Not set when nothing is set here', async () => {
    renderSection();
    const row = await claudeRow();
    expect(within(row).getByText('Not set')).toBeTruthy();

    const panel = await openClaudeRow();
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

  it('ignores a model saved in the Arguments box, since tabs never send it', async () => {
    useCliStore.setState({ cliArgs: { 'claude-code': '--model haiku --verbose' } });
    renderSection();
    const row = await claudeRow();
    expect(within(row).getByText('Not set')).toBeTruthy();
    expect(within(row).queryByText(/Haiku/)).toBeNull();

    const panel = await openClaudeRow();
    expect(panel.querySelector('code.font-mono')?.textContent).toBe('claude (no flags added)');
  });

  it('previews the command a terminal types', async () => {
    useCliStore.setState({
      cliArgs: { 'claude-code': '--verbose' },
      cliLaunchDefaults: { 'claude-code': { model: 'opus', mode: 'auto' } },
    });
    renderSection();
    const panel = await openClaudeRow();
    const preview = panel.querySelector('code.font-mono');
    expect(preview?.textContent).toBe('claude --model opus --permission-mode auto');
  });
});
