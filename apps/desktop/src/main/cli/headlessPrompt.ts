import { CLI_REGISTRY, getCliDefinition } from '@agentmat/core';
import type { CliDefinition, SupportedOS } from '@agentmat/core';
import { CliNotFoundError, runCli } from '../packageManagers/execUtils';
import { store } from '../store';

/** Agent CLIs answer through a model round-trip, so they need far longer than a git call. */
const HEADLESS_TIMEOUT_MS = 180000;

export interface HeadlessPromptResult {
  ok: boolean;
  text: string;
  /** Display name of the CLI that answered (or that we tried to use). */
  cliName: string | null;
  error?: string;
}

function supportsHeadlessPrompt(cli: CliDefinition): boolean {
  return !!cli.promptCommand && cli.supportedOS.includes(process.platform as SupportedOS);
}

/**
 * Picks the CLI to answer a one-shot prompt: the user's default CLI when it has
 * a headless mode, otherwise the first registry CLI that has one and is on PATH.
 * Returns null when nothing usable is installed.
 */
async function resolveHeadlessCli(): Promise<CliDefinition | null> {
  const settings = await store.getSettings();
  const preferred = settings.defaultCliId ? getCliDefinition(settings.defaultCliId) : undefined;
  if (preferred && supportsHeadlessPrompt(preferred) && (await isOnPath(preferred))) {
    return preferred;
  }

  for (const cli of CLI_REGISTRY) {
    if (cli.id === preferred?.id || !supportsHeadlessPrompt(cli)) continue;
    if (await isOnPath(cli)) return cli;
  }
  return null;
}

async function isOnPath(cli: CliDefinition): Promise<boolean> {
  try {
    await runCli(cli.versionCommand.command, cli.versionCommand.args, process.cwd(), 8000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Windows routes the prompt through `cmd.exe /c`, which expands `%VAR%` even inside
 * a quoted argument. Dropping the delimiters keeps the text readable while making sure
 * repo content (a commit subject, say) can never paste an environment value — an API
 * key, for instance — into a prompt that goes off to a model.
 */
function stripEnvExpansions(prompt: string): string {
  return process.platform === 'win32' ? prompt.replace(/%([A-Za-z0-9_]+)%/g, '$1') : prompt;
}

/**
 * Runs `prompt` through an installed agent CLI in non-interactive mode and returns
 * its stdout. The prompt is passed as a single argv entry (never string-concatenated
 * into a shell line), so its content can't spill into the command itself.
 */
export async function runHeadlessCliPrompt(
  prompt: string,
  cwd: string,
): Promise<HeadlessPromptResult> {
  const cli = await resolveHeadlessCli();
  if (!cli?.promptCommand) {
    return {
      ok: false,
      text: '',
      cliName: null,
      error:
        'No installed CLI supports non-interactive prompts. Install one (Claude Code, Codex, Gemini, …) ' +
        'from CLI Manager and pick it as your default CLI in Settings.',
    };
  }

  try {
    const result = await runCli(
      cli.promptCommand.command,
      [...cli.promptCommand.args, stripEnvExpansions(prompt)],
      cwd,
      HEADLESS_TIMEOUT_MS,
    );
    const text = result.stdout.trim();
    if (result.code !== 0 && !text) {
      return {
        ok: false,
        text: '',
        cliName: cli.name,
        error: result.stderr.trim() || `${cli.name} exited with code ${result.code}.`,
      };
    }
    if (!text) {
      return { ok: false, text: '', cliName: cli.name, error: `${cli.name} returned an empty answer.` };
    }
    return { ok: true, text, cliName: cli.name };
  } catch (error) {
    const message =
      error instanceof CliNotFoundError
        ? `${cli.name} is no longer on PATH.`
        : (error as Error).message || `${cli.name} failed to run.`;
    return { ok: false, text: '', cliName: cli.name, error: message };
  }
}
