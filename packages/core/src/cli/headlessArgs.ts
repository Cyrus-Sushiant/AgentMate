import { configuredArgsWithout } from '../promptBuilder/runRecommendation.js';
import { parseCliArgs } from './args.js';
import { type CliLaunchDefault, launchDefaultArgs } from './launchDefaults.js';
import type { CliDefinition } from './registry.js';

export interface HeadlessCliArgsInput {
  cli: CliDefinition;
  /** The CLI's Arguments box as saved (Settings / AI CLI Manager), e.g. "--model sonnet". */
  savedArgs?: string;
  /** The CLI's launch defaults. Only the model and effort apply to a background run. */
  launchDefaults?: CliLaunchDefault;
  /**
   * Model and effort flags picked for this one run, e.g. `['--model', 'opus']`. They replace the
   * same flags in the saved arguments and launch defaults rather than sitting next to them.
   */
  runArgs?: readonly string[];
  /** Adds the CLI's write flags, for runs the user asked to change files. */
  allowWrites?: boolean;
}

/**
 * The arguments a background AI task (commit message, tag suggestion, version bump, run sizing,
 * skill review, SSH task) starts a CLI with, everything but the prompt text itself.
 *
 * The user's CLI settings always go in: the saved Arguments box, then the model and effort from
 * Launch defaults for whatever those arguments don't already set. The launch mode does not. It
 * describes how an interactive session asks for approval, and a background run has nobody to ask;
 * whether it may write is decided per task through `allowWrites`. Taking the mode as well would let
 * "Plan" stop a version bump from editing, or "Bypass permissions" let a commit message run
 * commands.
 *
 * Stdin-mode CLIs take the user's flags last, after any subcommand (`codex exec --model x`).
 * Arg-mode CLIs take them first, since the prompt is the value of the final flag (`-p PROMPT`)
 * and anything after that flag would be read as the prompt.
 */
export function buildHeadlessCliArgs(input: HeadlessCliArgsInput): string[] {
  const { cli } = input;
  if (!cli.promptCommand) return [];
  const runArgs = [...(input.runArgs ?? [])];
  const writeArgs = input.allowWrites ? (cli.promptWriteArgs ?? []) : [];
  const configured = parseCliArgs(configuredArgsWithout((input.savedArgs ?? '').trim(), runArgs));
  const model = input.launchDefaults?.model;
  const effort = input.launchDefaults?.effort;
  const defaults = launchDefaultArgs(cli.id, { model, effort }, [...configured, ...runArgs]);
  const userArgs = [...defaults, ...configured, ...runArgs];
  return cli.promptInputMode === 'stdin'
    ? [...cli.promptCommand.args, ...writeArgs, ...userArgs]
    : [...userArgs, ...writeArgs, ...cli.promptCommand.args];
}
