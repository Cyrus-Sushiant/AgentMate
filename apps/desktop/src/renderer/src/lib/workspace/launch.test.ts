import type { Project } from '@agentmat/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The launch helpers against the real CLI store, with only the terminal side stubbed out. What
 * they hand the workspace as `launchInput` is exactly what the new tab types into its shell.
 */

const addTerminal = vi.fn((_projectId: string, _tab: { launchInput?: string }) => 'tab-1');

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/terminal/terminalRuntime', () => ({
  terminalRuntime: { deliverPrompt: vi.fn(() => Promise.resolve(true)) },
}));
vi.mock('@/stores/terminalStore', () => ({
  defaultNewSession: () => ({ title: 'PowerShell', shell: 'powershell.exe' }),
  useTerminalStore: { getState: () => ({ openSession: vi.fn() }) },
}));
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: { getState: () => ({ openProject: vi.fn(), addTerminal }) },
}));

const settingsUpdate = vi.fn((_patch: unknown) => Promise.resolve({}));

function stubAgentmate(hookPath: string | null = null): void {
  vi.stubGlobal('window', {
    agentmat: {
      platform: 'win32',
      settings: { update: settingsUpdate },
      agents: { statusHookSettings: vi.fn(() => Promise.resolve(hookPath)) },
    },
  });
}

const project = { id: 'p1', folderPath: 'E:\\proj', cliId: null } as unknown as Project;

async function load() {
  const { useCliStore } = await import('@/stores/cliStore');
  const launch = await import('./launch');
  const openCli = await import('@/lib/openCli');
  return { useCliStore, ...launch, ...openCli };
}

function typed(): string | undefined {
  return addTerminal.mock.calls.at(-1)?.[1].launchInput;
}

beforeEach(() => {
  vi.resetModules();
  addTerminal.mockClear();
  settingsUpdate.mockClear();
  stubAgentmate();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('launchAgentTab', () => {
  it('starts Claude Code with no flags when nothing is saved', async () => {
    const { launchAgentTab } = await load();
    expect(launchAgentTab(project, 'claude-code')).toBe('tab-1');
    expect(typed()).toBe('claude\r');
  });

  it('ignores what the CLI was last run on', async () => {
    // Release builds before the fix turned this into `--model haiku` on every new tab.
    const { useCliStore, launchAgentTab } = await load();
    useCliStore.setState({
      lastRunInfoByCli: { 'claude-code': { model: 'claude-haiku-4-5', effort: 'low' } },
    });
    launchAgentTab(project, 'claude-code');
    expect(typed()).toBe('claude\r');
    expect(typed()).not.toContain('--model');
  });

  it('sends what Settings hold: launch defaults, then saved arguments', async () => {
    const { useCliStore, launchAgentTab } = await load();
    useCliStore.setState({
      cliArgs: { 'claude-code': '--verbose' },
      cliLaunchDefaults: { 'claude-code': { mode: 'auto' } },
    });
    launchAgentTab(project, 'claude-code');
    expect(typed()).toBe('claude --permission-mode auto --verbose\r');
  });

  it('stops sending the model once it is removed from the Arguments box', async () => {
    const { useCliStore, launchAgentTab } = await load();
    const { configuredArgsWithout } = await import('@agentmat/core');
    useCliStore.setState({ cliArgs: { 'claude-code': '--model haiku' } });
    launchAgentTab(project, 'claude-code');
    expect(typed()).toBe('claude --model haiku\r');

    // The same call the "Remove it" button in Launch defaults makes.
    const saved = useCliStore.getState().cliArgs['claude-code'] ?? '';
    useCliStore
      .getState()
      .setCliArgs('claude-code', configuredArgsWithout(saved, ['--model', 'haiku']));
    expect(settingsUpdate).toHaveBeenLastCalledWith({ cliArgs: {} });

    launchAgentTab(project, 'claude-code');
    expect(typed()).toBe('claude\r');
  });

  it('starts bare when asked to skip saved settings', async () => {
    const { useCliStore, launchAgentTab } = await load();
    useCliStore.setState({
      cliArgs: { 'claude-code': '--model haiku' },
      cliLaunchDefaults: { 'claude-code': { model: 'opus', mode: 'plan' } },
    });
    launchAgentTab(project, 'claude-code', undefined, { skipSavedArgs: true });
    expect(typed()).toBe('claude\r');
  });

  it('adds status hooks once they have been prepared', async () => {
    stubAgentmate('C:\\Users\\A B\\hooks.json');
    const { prepareStatusHooks, launchAgentTab } = await load();
    prepareStatusHooks(['claude-code']);
    await vi.waitFor(() => {
      launchAgentTab(project, 'claude-code');
      expect(typed()).toBe("claude --settings 'C:\\Users\\A B\\hooks.json'\r");
    });
  });

  it('opens nothing for an unknown CLI', async () => {
    const { launchAgentTab } = await load();
    expect(launchAgentTab(project, 'nope')).toBeNull();
    expect(addTerminal).not.toHaveBeenCalled();
  });
});

describe('launchPromptTab', () => {
  it('lets the model picked for the run beat one saved in Settings', async () => {
    const { useCliStore, launchPromptTab } = await load();
    useCliStore.setState({ cliArgs: { 'claude-code': '--model haiku --verbose' } });
    launchPromptTab(project, {
      cliId: 'claude-code',
      prompt: 'hello',
      runArgs: ['--model', 'opus', '--effort', 'high'],
    });
    expect(typed()).toBe('claude --verbose --model opus --effort high\r');
  });
});

describe('launchResumeTab', () => {
  it('resumes Claude Code without adding a model', async () => {
    const { launchResumeTab } = await load();
    launchResumeTab(project, { provider: 'claude-code', id: 'abc', title: 'x', firstPrompt: '' });
    expect(typed()).toBe('claude --resume abc\r');
  });

  it('puts the resume words right after codex', async () => {
    const { launchResumeTab } = await load();
    launchResumeTab(project, { provider: 'codex', id: 'abc', title: 'x', firstPrompt: '' });
    expect(typed()).toBe('codex resume abc\r');
  });
});

describe('cliLaunchCommand', () => {
  it('matches what a workspace tab types, without hooks', async () => {
    const { useCliStore, cliLaunchCommand } = await load();
    expect(cliLaunchCommand('claude-code')).toBe('claude');
    useCliStore.setState({
      cliArgs: { 'claude-code': '--verbose' },
      cliLaunchDefaults: { 'claude-code': { model: 'sonnet' } },
    });
    expect(cliLaunchCommand('claude-code')).toBe('claude --model sonnet --verbose');
  });
});
