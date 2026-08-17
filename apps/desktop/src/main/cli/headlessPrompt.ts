import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { CLI_REGISTRY, getCliArgvFor, getCliDefinition } from '@agentmat/core';
import type { AppSettings, CliDefinition, SupportedOS } from '@agentmat/core';
import { runCli } from '../packageManagers/execUtils';
import { store } from '../store';

/** Agent CLIs answer through a model round-trip, so they need far longer than a git call. */
const HEADLESS_TIMEOUT_MS = 180000;

export interface HeadlessPromptResult {
  ok: boolean;
  text: string;
  /**
   * The CLI's progress log (stderr). OpenCode and friends print their banner and every
   * tool call there and keep stdout for the answer, so this is the only readable account
   * of a run that ends without a final message.
   */
  log?: string;
  /** Display name of the CLI that answered (or that we tried to use). */
  cliName: string | null;
  error?: string;
  /** True when cancelHeadlessPrompt() stopped this run. */
  cancelled?: boolean;
  /** True when the run was killed for exceeding its time budget. */
  timedOut?: boolean;
}

interface RunningPrompt {
  child: ChildProcess;
  cancelled: boolean;
}

/** Runs that were started with a requestId, so the renderer can stop them. */
const runningPrompts = new Map<string, RunningPrompt>();

/**
 * Ids cancelled before their process existed. Resolving which CLI to use probes each
 * candidate with `--version`, which takes seconds, long enough for the user to hit
 * cancel first, and without this the run would start anyway and answer into a UI that
 * has already moved on.
 */
const cancelledBeforeStart = new Set<string>();

/**
 * Windows spawns the CLI under cmd.exe, so killing the direct child would orphan the
 * agent itself; taskkill /T takes the whole tree down. Elsewhere the CLI is the direct
 * child and a signal is enough.
 */
function killProcessTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {
      // Best effort: the process may already have exited on its own.
    });
    return;
  }
  child.kill('SIGTERM');
}

/** Stops an in-flight headless run, or pre-empts one that hasn't spawned yet. */
export function cancelHeadlessPrompt(requestId: string): boolean {
  const entry = runningPrompts.get(requestId);
  if (entry) {
    entry.cancelled = true;
    killProcessTree(entry.child);
    return true;
  }
  cancelledBeforeStart.add(requestId);
  return true;
}

interface ExecOutcome {
  stdout: string;
  stderr: string;
  failed: boolean;
  errorMessage: string;
  /** Set when the run ended because cancelHeadlessPrompt() killed it. */
  cancelled: boolean;
  /** Set when the run ended because it outlived its time budget. */
  timedOut: boolean;
}

/**
 * execFile, but the child handle is kept so the run can be killed mid-flight, which
 * promisify() hides. Non-zero exits resolve rather than reject; the caller decides.
 * `stdinPayload` is null for CLIs that take the prompt as an argument (stdin is closed
 * immediately so a CLI that happens to check for EOF never blocks); when set, it's
 * written to the child's stdin instead of being appended to argv.
 */
function execPrompt(
  command: string,
  args: string[],
  cwd: string,
  requestId: string | undefined,
  stdinPayload: string | null,
  timeoutMs: number,
): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    const options = {
      cwd,
      // No `timeout` here on purpose: execFile's own timer signals the direct child, which
      // on Windows is cmd.exe, leaving the agent behind to keep editing files after we
      // have already reported back. The timer below takes the whole tree down instead.
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      // Cline's CLI self-updates on every invocation by spawning a detached background
      // installer; on Windows that can flash open a visible console mid-run. This is a
      // no-op env var for every other CLI we shell out to.
      env: { ...process.env, CLINE_NO_AUTO_UPDATE: '1' },
    };
    // npm-installed CLIs are .cmd shims on Windows, which Node refuses to spawn directly;
    // cmd.exe gets an argv array (not `shell: true`), so args never get re-parsed as a
    // single shell line. cmd.exe's own /c buffer still caps out at ~8191 characters
    // though, so a caller with a long prompt must send it via stdin instead of argv.
    const child =
      process.platform === 'win32'
        ? execFile('cmd.exe', ['/d', '/s', '/c', command, ...args], options, done)
        : execFile(command, args, options, done);

    if (requestId) runningPrompts.set(requestId, { child, cancelled: false });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutMs);

    if (stdinPayload !== null) child.stdin?.end(stdinPayload);
    else child.stdin?.end();

    function done(error: Error | null, stdout: string, stderr: string): void {
      clearTimeout(timer);
      // Read the cancelled flag before dropping the entry: the kill lands here as a plain
      // non-zero exit, indistinguishable from a crash without it.
      const cancelled = requestId ? (runningPrompts.get(requestId)?.cancelled ?? false) : false;
      if (requestId) runningPrompts.delete(requestId);
      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        failed: !!error,
        errorMessage: error?.message ?? '',
        cancelled,
        timedOut,
      });
    }
  });
}

function supportsHeadlessPrompt(cli: CliDefinition): boolean {
  return !!cli.promptCommand && cli.supportedOS.includes(process.platform as SupportedOS);
}

/**
 * Picks the CLI to answer a one-shot prompt, in order of preference: the project's
 * own CLI, then the app-wide default from Settings, then any registry CLI with a
 * headless mode that is on PATH. Returns null when nothing usable is installed.
 */
async function resolveHeadlessCli(
  settings: AppSettings,
  preferredCliId?: string | null,
): Promise<CliDefinition | null> {
  const candidateIds = [preferredCliId, settings.defaultCliId].filter((id): id is string => !!id);

  const tried = new Set<string>();
  for (const id of candidateIds) {
    if (tried.has(id)) continue;
    tried.add(id);
    const cli = getCliDefinition(id);
    if (cli && supportsHeadlessPrompt(cli) && (await isOnPath(cli))) return cli;
  }

  for (const cli of CLI_REGISTRY) {
    if (tried.has(cli.id) || !supportsHeadlessPrompt(cli)) continue;
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
 * repo content (a commit subject, say) can never paste an environment value (an API
 * key, for instance) into a prompt that goes off to a model.
 */
function stripEnvExpansions(prompt: string): string {
  return process.platform === 'win32' ? prompt.replace(/%([A-Za-z0-9_]+)%/g, '$1') : prompt;
}

/**
 * cmd.exe caps the /c command line it builds at 8191 characters; go over that and it
 * fails with "The command line is too long." before the CLI ever runs. A diff-heavy
 * prompt (git changes, release notes) can easily exceed that on its own, so trim it down
 * with room for the CLI's own command and args. Only cmd.exe enforces this, so other
 * platforms pass the prompt through untouched.
 */
const WINDOWS_PROMPT_BUDGET_CHARS = 5000;

function truncateForCommandLine(prompt: string, command: string, args: string[]): string {
  if (process.platform !== 'win32') return prompt;
  const overhead = command.length + args.join(' ').length + 20;
  const budget = Math.max(WINDOWS_PROMPT_BUDGET_CHARS - overhead, 500);
  if (prompt.length <= budget) return prompt;
  return `${prompt.slice(0, budget)}\n… (truncated: too long for the command line)`;
}

export interface HeadlessPromptOptions {
  /** Lets cancelHeadlessPrompt(requestId) stop this run. */
  requestId?: string;
  /** CLI the project asked for; falls back to the app default when unset or unusable. */
  preferredCliId?: string | null;
  /**
   * Adds the CLI's write flags so the agent can apply edits without a TTY to approve
   * them. Only set for prompts the user explicitly asked to run against their files.
   */
  allowWrites?: boolean;
  /**
   * Time budget for the run. Defaults to HEADLESS_TIMEOUT_MS, which suits a question the
   * CLI can answer in one round-trip; a prompt that sends the agent sweeping the repo
   * (searching for manifests, editing several of them) needs considerably more.
   */
  timeoutMs?: number;
}

/**
 * Runs `prompt` through an installed agent CLI in non-interactive mode and returns
 * its stdout. The prompt is passed as a single argv entry (never string-concatenated
 * into a shell line), so its content can't spill into the command itself.
 */
export async function runHeadlessCliPrompt(
  prompt: string,
  cwd: string,
  options: HeadlessPromptOptions = {},
): Promise<HeadlessPromptResult> {
  const cancelledResult: HeadlessPromptResult = {
    ok: false,
    text: '',
    cliName: null,
    cancelled: true,
    error: 'Request cancelled.',
  };
  if (options.requestId && cancelledBeforeStart.delete(options.requestId)) return cancelledResult;

  const settings = await store.getSettings();
  const cli = await resolveHeadlessCli(settings, options.preferredCliId);
  // Resolving the CLI can take seconds; the user may have cancelled in the meantime.
  if (options.requestId && cancelledBeforeStart.delete(options.requestId)) return cancelledResult;

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

  // Stdin bypasses cmd.exe's command line entirely, so a CLI confirmed to read the
  // prompt that way needs neither the %VAR% stripping nor the length truncation below,
  // both of which only exist because cmd.exe reparses whatever lands in argv.
  // Arg-mode CLIs need write flags before the prompt-taking flag (`-p PROMPT`), or the
  // flag would be swallowed as the prompt. Stdin-mode CLIs have no prompt in argv, and
  // some (OpenCode's `run --auto`) require write flags after the subcommand instead.
  const writeArgs = options.allowWrites ? (cli.promptWriteArgs ?? []) : [];
  // The user's own flags for this CLI (Settings / CLI Manager), e.g. "--model sonnet".
  // Stdin-mode CLIs take them last, after any subcommand, which is where a flag like
  // `--model` belongs for `opencode run` or `codex exec`. Arg-mode CLIs get them first:
  // there the prompt is the value of the last flag (`-p PROMPT`), so anything appended
  // after that flag would be read as the prompt instead.
  const userArgs = getCliArgvFor(settings.cliArgs, cli.id);
  const baseArgs =
    cli.promptInputMode === 'stdin'
      ? [...cli.promptCommand.args, ...writeArgs, ...userArgs]
      : [...userArgs, ...writeArgs, ...cli.promptCommand.args];

  const timeoutMs = options.timeoutMs ?? HEADLESS_TIMEOUT_MS;
  const outcome =
    cli.promptInputMode === 'stdin'
      ? await execPrompt(
          cli.promptCommand.command,
          baseArgs,
          cwd,
          options.requestId,
          prompt,
          timeoutMs,
        )
      : await execPrompt(
          cli.promptCommand.command,
          [
            ...baseArgs,
            truncateForCommandLine(stripEnvExpansions(prompt), cli.promptCommand.command, baseArgs),
          ],
          cwd,
          options.requestId,
          null,
          timeoutMs,
        );

  // A cancel that lost the race with completion would otherwise sit in the set forever.
  const cancelledLate = options.requestId ? cancelledBeforeStart.delete(options.requestId) : false;

  if (outcome.cancelled || cancelledLate) {
    return { ok: false, text: '', cliName: cli.name, cancelled: true, error: 'Request cancelled.' };
  }

  const text = stripAnsi(outcome.stdout).trim();
  const log = trimLog(stripAnsi(outcome.stderr).trim());
  if (text && !outcome.timedOut) return { ok: true, text, log, cliName: cli.name };

  if (outcome.timedOut) {
    return {
      ok: false,
      text,
      log,
      cliName: cli.name,
      timedOut: true,
      error: `${cli.name} was still working after ${Math.round(timeoutMs / 60000)} minutes and was stopped.`,
    };
  }

  // stderr carries the progress log as well as any real failure, so neither showing all
  // of it nor dropping it works: the whole stream reads as noise, and none of it leaves
  // the user with nothing to act on. Pull out the lines that say what went wrong.
  const detail = extractCliError(log);
  return {
    ok: false,
    text: '',
    log,
    cliName: cli.name,
    error: outcome.failed
      ? detail
        ? `${cli.name} failed: ${detail}`
        : `${cli.name} exited without answering.`
      : `${cli.name} returned an empty answer.`,
  };
}

/**
 * Matches how these CLIs announce a failure: a line that leads with an error word or a
 * failure glyph. Progress lines ("• Find all version manifests") never look like this.
 */
const CLI_ERROR_LINE = /^(?:[✗×✘]\s*)?(?:error|fatal|panic|exception|failed)\b/i;

function extractCliError(log: string): string {
  const lines = log
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => CLI_ERROR_LINE.test(line))
    // The CLI's own "Error:" label would only repeat the sentence this goes into.
    .map((line) => line.replace(/^(?:[✗×✘]\s*)?error:?\s*/i, ''))
    .filter(Boolean);
  // The last one is the failure that ended the run; earlier ones are often retried.
  return lines.slice(-2).join(' ');
}

/**
 * Progress logs include the diff of every edit, which across a large repo runs to
 * megabytes; that all has to cross IPC and land in a dialog. Keep the tail, since what
 * the run did last is what explains how it ended.
 */
const MAX_LOG_CHARS = 20000;

function trimLog(log: string): string {
  if (log.length <= MAX_LOG_CHARS) return log;
  return `… (earlier output trimmed)\n${log.slice(-MAX_LOG_CHARS)}`;
}

/** Color and cursor codes are noise once the answer is shown in a dialog. */
function stripAnsi(text: string): string {
  return text
    .replace(/\u001B\[[?]?\d*(?:;\d+)*[a-zA-Z]/g, '')
    .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, '')
    .replace(/\[(?:\d{1,3};)*\d{1,3}m/g, '')
    .replace(/\r/g, '');
}
