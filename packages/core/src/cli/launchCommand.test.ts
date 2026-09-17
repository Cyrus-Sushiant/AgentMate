import { describe, expect, it } from 'vitest';
import { buildAgentLaunchCommand } from './launchCommand.js';

describe('buildAgentLaunchCommand', () => {
  it('starts a CLI with nothing saved exactly as typed by hand', () => {
    // The Haiku regression: no model anywhere in Settings must mean no --model on the line.
    expect(buildAgentLaunchCommand({ cliId: 'claude-code', shellKind: 'powershell' })).toBe(
      'claude',
    );
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'powershell',
        savedArgs: '',
        launchDefaults: {},
      }),
    ).toBe('claude');
  });

  it('adds only the status hook settings when that is all there is', () => {
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'powershell',
        hookSettingsPath: 'C:\\Users\\me\\AppData\\Roaming\\AgentMate\\agent-hooks\\claude.json',
      }),
    ).toBe(
      'claude --settings C:\\Users\\me\\AppData\\Roaming\\AgentMate\\agent-hooks\\claude.json',
    );
  });

  it('quotes a hook settings path with spaces for the shell it is typed into', () => {
    const path = 'C:\\Users\\A B\\hooks.json';
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'powershell',
        hookSettingsPath: path,
      }),
    ).toBe("claude --settings 'C:\\Users\\A B\\hooks.json'");
    expect(
      buildAgentLaunchCommand({ cliId: 'claude-code', shellKind: 'cmd', hookSettingsPath: path }),
    ).toBe('claude --settings "C:\\Users\\A B\\hooks.json"');
  });

  it('sends a model saved in the Arguments box', () => {
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'posix',
        savedArgs: '--model haiku',
      }),
    ).toBe('claude --model haiku');
  });

  it('puts launch defaults before the saved arguments', () => {
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'posix',
        savedArgs: '--verbose',
        launchDefaults: { model: 'opus', effort: 'high', mode: 'auto' },
      }),
    ).toBe('claude --model opus --effort high --permission-mode auto --verbose');
  });

  it('lets saved arguments win over a launch default for the same flag', () => {
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'posix',
        savedArgs: '--model haiku',
        launchDefaults: { model: 'opus', mode: 'plan' },
      }),
    ).toBe('claude --permission-mode plan --model haiku');
  });

  it('drops a run arg the saved arguments already set, unless the run args win', () => {
    const base = {
      cliId: 'claude-code',
      shellKind: 'posix' as const,
      savedArgs: '--model haiku --verbose',
      runArgs: ['--model', 'opus', '--effort', 'high'],
    };
    expect(buildAgentLaunchCommand(base)).toBe('claude --model haiku --verbose --effort high');
    expect(buildAgentLaunchCommand({ ...base, runArgsWin: true })).toBe(
      'claude --verbose --model opus --effort high',
    );
  });

  it('skips saved arguments and launch defaults for a bare start', () => {
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'posix',
        savedArgs: '--model haiku',
        launchDefaults: { mode: 'auto' },
        hookSettingsPath: '/tmp/hooks.json',
        skipSavedArgs: true,
      }),
    ).toBe('claude --settings /tmp/hooks.json');
  });

  it('keeps leading words right after the executable', () => {
    expect(
      buildAgentLaunchCommand({
        cliId: 'codex-cli',
        shellKind: 'posix',
        leadingArgs: ['resume', 'abc-123'],
        launchDefaults: { mode: 'read-only' },
      }),
    ).toBe('codex resume abc-123 --sandbox read-only');
  });

  it('leaves an effort off for a model that has none', () => {
    expect(
      buildAgentLaunchCommand({
        cliId: 'claude-code',
        shellKind: 'posix',
        launchDefaults: { model: 'haiku', effort: 'high' },
      }),
    ).toBe('claude --model haiku');
  });

  it('returns null for a CLI it does not know', () => {
    expect(buildAgentLaunchCommand({ cliId: 'nope', shellKind: 'posix' })).toBeNull();
  });
});
