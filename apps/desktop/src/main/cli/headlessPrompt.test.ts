import type { AppSettings } from '@agentmat/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * runHeadlessCliPrompt() is the one way every background AI task (commit messages, PR text, tag
 * suggestions, version bumps, run sizing, skill reviews, SSH tasks) starts a CLI. These pin that
 * it always starts it with the user's CLI settings, read fresh from the store on each run.
 */

interface Spawned {
  command: string;
  args: string[];
  stdin: string | null;
}

const spawned: Spawned[] = [];
const settings = { current: {} as Partial<AppSettings> };
/** CLI ids whose `--version` probe succeeds, i.e. that count as installed. */
const installed = new Set<string>(['claude']);

vi.mock('node:child_process', () => ({
  execFile: vi.fn(
    (
      file: string,
      argv: string[],
      _options: unknown,
      done: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      // Windows goes through `cmd.exe /d /s /c <command> ...args`.
      const [command, ...args] = file === 'cmd.exe' ? argv.slice(3) : [file, ...argv];
      const entry: Spawned = { command: command ?? '', args, stdin: null };
      spawned.push(entry);
      setTimeout(() => done(null, 'an answer', ''), 0);
      return {
        pid: 1,
        kill: vi.fn(),
        stdin: {
          end: (payload?: string) => {
            entry.stdin = payload ?? null;
          },
        },
      };
    },
  ),
}));
vi.mock('../packageManagers/execUtils', () => ({
  runCli: vi.fn(async (command: string) => {
    if (!installed.has(command)) throw new Error('not found');
    return { stdout: '1.0.0', stderr: '' };
  }),
}));
vi.mock('../store', () => ({
  store: {
    getSettings: async () => ({
      defaultCliId: null,
      cliArgs: {},
      cliLaunchDefaults: {},
      ...settings.current,
    }),
  },
}));

async function run(options: Parameters<typeof import('./headlessPrompt').runHeadlessCliPrompt>[2]) {
  const { runHeadlessCliPrompt } = await import('./headlessPrompt');
  const result = await runHeadlessCliPrompt('write a commit message', '/repo', options);
  expect(result.ok).toBe(true);
  const last = spawned.at(-1);
  if (!last) throw new Error('no CLI was started');
  return last;
}

beforeEach(() => {
  spawned.length = 0;
  installed.clear();
  installed.add('claude');
  settings.current = { defaultCliId: 'claude-code' };
});

describe('runHeadlessCliPrompt uses the user CLI settings', () => {
  it('starts the CLI bare when nothing is set', async () => {
    const started = await run({});
    expect(started.command).toBe('claude');
    expect(started.args).toEqual(['-p']);
    expect(started.stdin).toBe('write a commit message');
  });

  it('passes the saved Arguments box', async () => {
    settings.current = { defaultCliId: 'claude-code', cliArgs: { 'claude-code': '--verbose' } };
    expect((await run({})).args).toEqual(['-p', '--verbose']);
  });

  it('leaves Launch defaults out, those are for terminals only', async () => {
    settings.current = {
      defaultCliId: 'claude-code',
      cliLaunchDefaults: { 'claude-code': { model: 'opus', effort: 'high', mode: 'auto' } },
    };
    expect((await run({})).args).toEqual(['-p']);
  });

  it('reads the settings again on every run, so a change applies right away', async () => {
    settings.current = { defaultCliId: 'claude-code', cliArgs: { 'claude-code': '--model opus' } };
    expect((await run({})).args).toContain('opus');
    settings.current = { defaultCliId: 'claude-code', cliArgs: { 'claude-code': '--model sonnet' } };
    expect((await run({})).args).toContain('sonnet');
  });

  it('uses the settings of the project CLI when a project picks one', async () => {
    installed.add('codex');
    settings.current = {
      defaultCliId: 'claude-code',
      cliArgs: { 'claude-code': '--verbose', 'codex-cli': '--skip-git-repo-check' },
    };
    const started = await run({ preferredCliId: 'codex-cli' });
    expect(started.command).toBe('codex');
    expect(started.args).toContain('--skip-git-repo-check');
    expect(started.args).not.toContain('--verbose');
  });

  it('uses the settings of the CLI it falls back to', async () => {
    settings.current = {
      defaultCliId: 'claude-code',
      cliArgs: { 'claude-code': '--verbose', 'codex-cli': '--nope' },
    };
    // The project asked for Codex, which is not installed, so Claude Code answers instead.
    const started = await run({ preferredCliId: 'codex-cli' });
    expect(started.command).toBe('claude');
    expect(started.args).toEqual(['-p', '--verbose']);
  });

  it('lets a model picked for the run replace the saved one without doubling flags', async () => {
    settings.current = {
      defaultCliId: 'claude-code',
      cliArgs: { 'claude-code': '--model haiku --verbose' },
    };
    const { args } = await run({
      preferredCliId: 'claude-code',
      strictCli: true,
      runArgs: ['--model', 'sonnet', '--effort', 'high'],
    });
    expect(args).toEqual(['-p', '--verbose', '--model', 'sonnet', '--effort', 'high']);
  });

  it('ignores run args meant for a different CLI', async () => {
    settings.current = {
      defaultCliId: 'claude-code',
      cliArgs: { 'claude-code': '--model opus' },
    };
    const { args } = await run({ preferredCliId: 'codex-cli', runArgs: ['--model', 'gpt-x'] });
    expect(args).toEqual(['-p', '--model', 'opus']);
  });

  it('keeps the user settings on a run that may write files', async () => {
    settings.current = {
      defaultCliId: 'claude-code',
      cliArgs: { 'claude-code': '--verbose' },
      cliLaunchDefaults: { 'claude-code': { model: 'opus', mode: 'plan' } },
    };
    const { args } = await run({ allowWrites: true });
    expect(args).toEqual(['-p', '--permission-mode', 'acceptEdits', '--verbose']);
  });
});

describe('runHeadlessCliPrompt keeps terminal settings out', () => {
  // Regression guard, the mirror of the terminal one in lib/workspace/launch.test.ts: Launch
  // defaults are for terminals only and must never change a background run, for any CLI.
  it('uses the Arguments box and never the Launch defaults, for every headless CLI', async () => {
    const { CLI_REGISTRY, cliLaunchOptions } = await import('@agentmat/core');
    // Only CLIs that can run on this OS are ever picked for a background run.
    const headless = CLI_REGISTRY.filter(
      (cli) => cli.promptCommand && (cli.supportedOS as string[]).includes(process.platform),
    );
    expect(headless.length).toBeGreaterThan(0);

    for (const cli of headless) {
      installed.add(cli.versionCommand.command);
      const mode = cliLaunchOptions(cli.id)?.modes[0];
      settings.current = {
        defaultCliId: cli.id,
        cliArgs: { [cli.id]: '--agentmate-background-arg' },
        cliLaunchDefaults: {
          [cli.id]: { model: 'terminal-only-model', effort: 'max', mode: mode?.id },
        },
      };
      const { args } = await run({ preferredCliId: cli.id, strictCli: true });
      expect(args, cli.id).toContain('--agentmate-background-arg');
      expect(args, cli.id).not.toContain('terminal-only-model');
      if (mode) {
        const joined = args.join(' ');
        expect(joined, `${cli.id} mode`).not.toContain(mode.args.join(' '));
      }
    }
  });
});
