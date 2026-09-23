import { quoteForShell, type ShellKind } from '../workspace/shellQuote.js';
import { type CliLaunchDefault, launchDefaultArgs } from './launchDefaults.js';
import { getCliDefinition } from './registry.js';

export interface AgentLaunchCommandInput {
  cliId: string;
  shellKind: ShellKind;
  /** The CLI's launch defaults from Settings. Unset fields add nothing. */
  launchDefaults?: CliLaunchDefault;
  /** Model and effort flags picked for this one launch, or `--resume <id>`. */
  runArgs?: readonly string[];
  /** Words that go right after the executable, like `resume <id>` for Codex. */
  leadingArgs?: readonly string[];
  /** Settings file that makes the CLI report its status through hooks. */
  hookSettingsPath?: string | null;
  /** Start bare: no launch defaults. */
  skipLaunchDefaults?: boolean;
}

/**
 * The line a terminal types to start an agent CLI: the executable, any leading words, status
 * hooks, the launch defaults, then the run arguments. A run argument replaces the launch default
 * for the same flag. Nothing is added that the user didn't set, so a CLI with no launch defaults
 * starts exactly as if typed by hand.
 *
 * The Arguments box from CLI Manager is deliberately not read here. Those flags belong to
 * background tasks only (see buildHeadlessCliArgs), so a `--model haiku` saved for commit
 * messages never changes the model of a terminal session.
 */
export function buildAgentLaunchCommand(input: AgentLaunchCommandInput): string | null {
  const cli = getCliDefinition(input.cliId);
  if (!cli) return null;
  const kind = input.shellKind;
  const run = [...(input.runArgs ?? [])];
  const defaults = input.skipLaunchDefaults
    ? []
    : launchDefaultArgs(input.cliId, input.launchDefaults, run);
  return [
    cli.executableNames[0],
    ...(input.leadingArgs ?? []).map((arg) => quoteForShell(arg, kind)),
    ...(input.hookSettingsPath ? ['--settings', quoteForShell(input.hookSettingsPath, kind)] : []),
    ...defaults.map((arg) => quoteForShell(arg, kind)),
    ...run.map((arg) => quoteForShell(arg, kind)),
  ]
    .filter(Boolean)
    .join(' ');
}
