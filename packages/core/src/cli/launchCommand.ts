import {
  configuredArgsWithout,
  withoutConfiguredRunArgs,
} from '../promptBuilder/runRecommendation.js';
import { quoteForShell, type ShellKind } from '../workspace/shellQuote.js';
import { parseCliArgs } from './args.js';
import { type CliLaunchDefault, launchDefaultArgs } from './launchDefaults.js';
import { getCliDefinition } from './registry.js';

export interface AgentLaunchCommandInput {
  cliId: string;
  shellKind: ShellKind;
  /** The CLI's Arguments box as saved, e.g. "--verbose". */
  savedArgs?: string;
  /** The CLI's launch defaults from Settings. Unset fields add nothing. */
  launchDefaults?: CliLaunchDefault;
  /** Model and effort flags picked for this one launch, or `--resume <id>`. */
  runArgs?: readonly string[];
  /** Words that go right after the executable, like `resume <id>` for Codex. */
  leadingArgs?: readonly string[];
  /** Settings file that makes the CLI report its status through hooks. */
  hookSettingsPath?: string | null;
  /**
   * Normally the saved arguments win a clash with the run arguments. With this the run
   * arguments do, since they were picked on purpose for this launch.
   */
  runArgsWin?: boolean;
  /** Start bare: no saved arguments and no launch defaults. */
  skipSavedArgs?: boolean;
}

/**
 * The line a terminal types to start an agent CLI: the executable, any leading words, status
 * hooks, the launch defaults, the saved arguments, then the run arguments. Nothing is added that
 * the user didn't set somewhere, so a CLI with nothing saved starts exactly as if typed by hand.
 */
export function buildAgentLaunchCommand(input: AgentLaunchCommandInput): string | null {
  const cli = getCliDefinition(input.cliId);
  if (!cli) return null;
  const kind = input.shellKind;
  const runArgs = [...(input.runArgs ?? [])];
  const saved = input.skipSavedArgs ? '' : (input.savedArgs ?? '').trim();
  const configured = input.runArgsWin ? configuredArgsWithout(saved, runArgs) : saved;
  const run = input.runArgsWin ? runArgs : withoutConfiguredRunArgs(configured, runArgs);
  const defaults = input.skipSavedArgs
    ? []
    : launchDefaultArgs(input.cliId, input.launchDefaults, [...parseCliArgs(configured), ...run]);
  return [
    cli.executableNames[0],
    ...(input.leadingArgs ?? []).map((arg) => quoteForShell(arg, kind)),
    ...(input.hookSettingsPath ? ['--settings', quoteForShell(input.hookSettingsPath, kind)] : []),
    ...defaults.map((arg) => quoteForShell(arg, kind)),
    configured,
    ...run.map((arg) => quoteForShell(arg, kind)),
  ]
    .filter(Boolean)
    .join(' ');
}
