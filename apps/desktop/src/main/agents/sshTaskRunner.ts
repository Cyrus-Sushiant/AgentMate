import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { runChoiceArgs, runProfileForTargetAI } from '@agentmat/core';
import type {
  AiProvider,
  SshAgentMode,
  SshAgentPhase,
  SshAgentProgress,
  StartSshAgentTaskInput,
} from '../../shared/apiTypes';
import { cancelHeadlessPrompt, runHeadlessCliPrompt } from '../cli/headlessPrompt';
import { runAiPrompt } from '../ipc/ai';
import {
  getSshSessionPassword,
  hasSshSession,
  setSshDisplayCaptured,
  subscribeSshExit,
  subscribeSshOutput,
  writeToSshDisplay,
  writeToSshSession,
} from '../ipc/ssh';
import {
  hasAttachedTerminalSession,
  setTerminalDisplayCaptured,
  subscribeTerminalExit,
  subscribeTerminalOutput,
  terminalSessionShell,
  writeToSession,
  writeToTerminalDisplay,
} from '../ipc/terminal';
import { speakOnPet } from '../notifications/petNotifier';
import { store } from '../store';
import {
  allowSudoPasswordPrompt,
  CommandDisplay,
  type DisplaySink,
  endsWithPasswordPrompt,
  isRiskyCommand,
  type MarkedCommand,
  markedCommandLine,
  PROMPT_READY,
  parseModelReply,
  type ShellFamily,
  shellFamily,
} from './shellCommand';

/** Refuses to loop forever if the AI never says FINISHED. */
const MAX_STEPS = 40;
const MAX_RUNTIME_MS = 30 * 60 * 1000;
/** How long a single command may run before its output is given up on. */
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
/** How much of the transcript is kept in the prompt sent to the AI each step. */
const TRANSCRIPT_TAIL_CHARS = 6000;

/**
 * An agent CLI would otherwise happily use its own tools, which run on the user's machine rather
 * than on the server. Every command has to go through the reply format instead.
 */
function cliPreamble(target: ShellTarget): string {
  return (
    'Do not use any tools, do not read or edit local files, and do not run anything yourself. ' +
    'Commands only run when you reply in the format below, and they run ' +
    (target.kind === 'ssh'
      ? 'on the remote server, not on this machine.\n\n'
      : "in the user's terminal tab, where they can watch them.\n\n")
  );
}

/** The terminal a run drives: an SSH channel, or a shell running on this machine. */
interface ShellTarget extends DisplaySink {
  kind: 'ssh' | 'local';
  /** How the prompt describes the shell to the AI. */
  description: string;
  /** Short label for pet notifications. */
  label: string;
  isConnected: () => boolean;
  write: (data: string) => void;
  subscribeOutput: (listener: (data: string) => void) => () => void;
  subscribeExit: (listener: () => void) => () => void;
  /** The saved login password for a sudo prompt. Always null for a local shell. */
  getPassword: () => Promise<string | null>;
  /** The line to type for a command, wrapped so the shell reports when it starts and ends. */
  commandLine: (command: string, id: string) => MarkedCommand;
  /**
   * A local shell announces every fresh prompt (see ptyHost/shellIntegration.ts), which ends a
   * command whose line never printed the marker, e.g. one the shell refused to parse.
   */
  detectsPrompt: boolean;
}

const SHELL_LABELS: Record<ShellFamily, string> = {
  posix: 'POSIX',
  fish: 'fish',
  powershell: 'PowerShell',
  cmd: 'Windows Command Prompt (cmd.exe)',
};

function platformLabel(): string {
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  return 'Linux';
}

function sshTarget(sessionId: string): ShellTarget {
  return {
    kind: 'ssh',
    description: 'a real remote Linux shell over an active SSH session',
    label: 'SSH session',
    isConnected: () => hasSshSession(sessionId),
    write: (data) => writeToSshSession(sessionId, data),
    subscribeOutput: (listener) => subscribeSshOutput(sessionId, listener),
    subscribeExit: (listener) => subscribeSshExit(sessionId, listener),
    getPassword: () => getSshSessionPassword(sessionId),
    commandLine: (command, id) => markedCommandLine('posix', command, id, '\n', true),
    captureDisplay: (captured) => setSshDisplayCaptured(sessionId, captured),
    display: (data) => writeToSshDisplay(sessionId, data),
    detectsPrompt: false,
  };
}

function localTarget(sessionId: string): ShellTarget {
  const shell = terminalSessionShell(sessionId);
  const family = shellFamily(shell);
  const shellName = family === 'posix' ? shell : SHELL_LABELS[family];
  return {
    kind: 'local',
    description:
      `a real ${shellName} shell running on the user's own ${platformLabel()} computer, in one ` +
      `of their terminal tabs. Every command must be valid ${shellName} syntax`,
    label: 'Terminal',
    isConnected: () => hasAttachedTerminalSession(sessionId),
    write: (data) => writeToSession(sessionId, data),
    subscribeOutput: (listener) => subscribeTerminalOutput(sessionId, listener),
    subscribeExit: (listener) => subscribeTerminalExit(sessionId, listener),
    getPassword: async () => null,
    // ConPTY repaints the screen itself and can pass an escape sequence through ahead of the
    // text printed around it, so on Windows the markers stay plain text.
    commandLine: (command, id) =>
      markedCommandLine(family, command, id, '\r', process.platform !== 'win32'),
    captureDisplay: (captured) => setTerminalDisplayCaptured(sessionId, captured),
    display: (data) => writeToTerminalDisplay(sessionId, data),
    detectsPrompt: true,
  };
}

function buildPrompt(run: RunState): string {
  const tail =
    run.transcript.length > TRANSCRIPT_TAIL_CHARS
      ? `…(earlier output truncated)…${run.transcript.slice(-TRANSCRIPT_TAIL_CHARS)}`
      : run.transcript || '(no commands run yet)';
  return `${run.cliId ? cliPreamble(run.target) : ''}You are operating ${run.target.description}, on behalf of a user who is watching every command execute live in their terminal.

User's task: "${run.prompt}"

Reply with EXACTLY one of these three forms, and nothing else:
RUN: <a single shell command>
FINISHED: <one short sentence summarizing what was accomplished>
NEEDS_INPUT: <a short question for the user>

Rules:
- Exactly one command per reply. Do not chain unrelated steps with && unless they are trivially part of the same action.
- Prefer flags that skip confirmations (-y, --yes) so a command never hangs waiting on a TTY prompt.
- When a command needs root, use plain sudo. Never pass sudo -n or -S, and never use NEEDS_INPUT to ask for a password: when sudo prompts for one, AgentMate answers it for the user.
- Let commands print their normal progress. Do not silence them with -qq or > /dev/null, since the user is watching the output.
- Do not repeat a command that already ran successfully in the transcript below.
- If the transcript shows the task is already done, reply FINISHED.

Transcript so far (most recent last):
${tail}`;
}

interface PendingApproval {
  command: string;
  resolve: (approved: boolean) => void;
}

interface RunState {
  sessionId: string;
  target: ShellTarget;
  mode: SshAgentMode;
  /** Agent CLI deciding each step, or null for the AI provider from Settings. */
  cliId: string | null;
  /** Model and effort flags for that CLI. */
  runArgs: string[];
  /** Set while a CLI is working out the next step, so Stop can kill it. */
  cliRequestId: string | null;
  prompt: string;
  transcript: string;
  step: number;
  startedAt: number;
  aborted: boolean;
  controller: AbortController;
  pendingApproval: PendingApproval | null;
  pendingInputAnswer: ((answer: string) => void) | null;
  /** Resolves with true when the user lets AgentMate type the saved password into a prompt. */
  pendingPassword: ((approved: boolean) => void) | null;
  unsubscribeExit: () => void;
  listener: (progress: SshAgentProgress) => void;
}

const runs = new Map<string, RunState>();

function emit(run: RunState, phase: SshAgentPhase, extra: Partial<SshAgentProgress> = {}): void {
  run.listener({ sessionId: run.sessionId, phase, step: run.step, ...extra });
}

async function resolveProviderAndModel(): Promise<{ provider: AiProvider; model: string }> {
  const settings = await store.getSettings();
  const provider = settings.promptBuilderProvider;
  const model =
    provider === 'openai'
      ? settings.openaiModel
      : provider === 'gemini'
        ? settings.geminiModel
        : settings.ollamaModel;
  return { provider, model };
}

function waitForApproval(run: RunState, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    run.pendingApproval = { command, resolve };
  });
}

/**
 * Asks the user before typing the saved login password into a prompt the running command opened.
 * Declining (or having no saved password) leaves the prompt for them to answer in the terminal.
 */
async function handlePasswordPrompt(run: RunState, command: string): Promise<void> {
  const { target } = run;
  const password = await target.getPassword();
  if (run.aborted) return;
  const asker = target.kind === 'ssh' ? 'The server' : 'The command';
  // Listening starts before the bar appears, so an answer can never arrive with nobody waiting.
  const answer = new Promise<boolean>((resolve) => {
    run.pendingPassword = resolve;
  });
  emit(run, 'needs-password', {
    command,
    hasSavedPassword: password !== null,
    message: password
      ? `${asker} is asking for a password. Enter the saved one for you?`
      : target.kind === 'ssh'
        ? 'The server is asking for a password, and none is saved for it. Type it in the terminal.'
        : 'The command is asking for a password. Type it in the terminal.',
  });
  const settings = await store.getSettings();
  speakOnPet(settings, target.label, `${asker} is asking for a password.`, 'warn');
  const approved = await answer;
  if (run.aborted) return;
  if (approved && password !== null) target.write(`${password}\n`);
  emit(run, 'running', { command });
}

function settlePendingPassword(run: RunState): void {
  if (!run.pendingPassword) return;
  const resolve = run.pendingPassword;
  run.pendingPassword = null;
  resolve(false);
}

function waitForUserAnswer(run: RunState): Promise<string> {
  return new Promise((resolve) => {
    run.pendingInputAnswer = resolve;
  });
}

interface CommandResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
}

/** Types `command` into the shell and resolves once it ends. */
function runCommand(run: RunState, command: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const id = randomUUID().replace(/-/g, '');
    const marked = run.target.commandLine(command, id);
    const { start } = marked;
    const display = start
      ? new CommandDisplay(run.target, command, { ...marked, start }, id)
      : null;
    let buffer = '';
    let settled = false;
    /** Output before this index has already been checked for a password prompt. */
    let promptScanFrom = 0;
    let askingForPassword = false;
    let timer = startTimer();
    const unsubscribeOutput = run.target.subscribeOutput((data) => {
      buffer += data;
      display?.push(data);
      const match = buffer.match(marked.done);
      if (match?.index !== undefined) {
        // The AI gets the output alone, without the shell's echo of the typed line.
        const startAt = start ? buffer.indexOf(start) : -1;
        finish({
          output: buffer.slice(startAt < 0 ? 0 : startAt + (start?.length ?? 0), match.index),
          exitCode: Number(match[1]),
          timedOut: false,
        });
        return;
      }
      // Back at a prompt without the marker: the shell never ran the rest of the line.
      if (run.target.detectsPrompt && PROMPT_READY.test(buffer)) {
        finish({ output: buffer.replace(PROMPT_READY, ''), exitCode: null, timedOut: false });
        return;
      }
      if (askingForPassword || !endsWithPasswordPrompt(buffer.slice(promptScanFrom))) return;
      askingForPassword = true;
      promptScanFrom = buffer.length;
      // Waiting on the user isn't the command hanging, so the timeout starts over afterwards.
      clearTimeout(timer);
      void handlePasswordPrompt(run, command).finally(() => {
        askingForPassword = false;
        promptScanFrom = buffer.length;
        if (!settled) timer = startTimer();
      });
    });

    function startTimer(): ReturnType<typeof setTimeout> {
      return setTimeout(
        () => finish({ output: buffer, exitCode: null, timedOut: true }),
        COMMAND_TIMEOUT_MS,
      );
    }
    const unsubscribeExit = run.target.subscribeExit(() =>
      finish({ output: buffer, exitCode: null, timedOut: false }),
    );

    function finish(result: CommandResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribeOutput();
      unsubscribeExit();
      display?.release();
      // The user may have typed the password in the terminal instead of answering the bar.
      settlePendingPassword(run);
      resolve(result);
    }

    run.target.write(marked.line);
  });
}

function appendCompletedCommand(run: RunState, command: string, result: CommandResult): void {
  const output = result.timedOut
    ? `${result.output}\n[No output captured within the timeout; the command may still be running]`
    : result.output;
  const exitNote = result.exitCode !== null ? ` [exit code ${result.exitCode}]` : '';
  run.transcript += `\n$ ${command}${exitNote}\n${output}\n`;
}

function cleanupRun(run: RunState): void {
  run.unsubscribeExit();
  runs.delete(run.sessionId);
}

/** A CLI starts fresh each step and reads the whole prompt, so it gets longer than an API call. */
const CLI_STEP_TIMEOUT_MS = 5 * 60 * 1000;

/** Asks the CLI the run was started with for its next step. */
async function askCli(run: RunState): Promise<string> {
  const requestId = `ssh-agent:${run.sessionId}:${run.step}`;
  run.cliRequestId = requestId;
  try {
    // The temp dir, not a project folder: the CLI only needs the prompt, and one started inside
    // a repo tends to go reading files first.
    const result = await runHeadlessCliPrompt(buildPrompt(run), tmpdir(), {
      requestId,
      preferredCliId: run.cliId,
      strictCli: true,
      runArgs: run.runArgs,
      timeoutMs: CLI_STEP_TIMEOUT_MS,
    });
    if (!result.ok) throw new Error(result.error || `${result.cliName ?? 'The CLI'} failed.`);
    return result.text;
  } finally {
    run.cliRequestId = null;
  }
}

async function runLoop(run: RunState): Promise<void> {
  try {
    const api = run.cliId ? null : await resolveProviderAndModel();

    while (!run.aborted) {
      if (run.step >= MAX_STEPS) {
        emit(run, 'error', { message: `Stopped after ${MAX_STEPS} steps without finishing.` });
        return;
      }
      if (Date.now() - run.startedAt > MAX_RUNTIME_MS) {
        emit(run, 'error', { message: 'Stopped: this task ran for too long.' });
        return;
      }

      run.step += 1;
      emit(run, 'thinking');

      let reply: string;
      try {
        reply = api
          ? await runAiPrompt(api.provider, api.model, buildPrompt(run), [], run.controller.signal)
          : await askCli(run);
      } catch (error) {
        if (run.aborted) return;
        emit(run, 'error', { message: (error as Error).message });
        return;
      }
      if (run.aborted) return;

      const parsed = parseModelReply(reply);
      if (!parsed) {
        emit(run, 'error', {
          message: 'The AI reply did not follow the expected format, stopping.',
        });
        return;
      }

      if (parsed.kind === 'finished') {
        emit(run, 'finished', { message: parsed.message || 'Task complete.' });
        const settings = await store.getSettings();
        speakOnPet(settings, run.target.label, parsed.message || 'AI finished the task.', 'pass');
        return;
      }

      if (parsed.kind === 'needs-input') {
        emit(run, 'needs-input', { message: parsed.message });
        const settings = await store.getSettings();
        speakOnPet(settings, run.target.label, `AI needs input: ${parsed.message}`, 'warn');
        const answer = await waitForUserAnswer(run);
        if (run.aborted) return;
        run.transcript += `\n[You answered]: ${answer}\n`;
        continue;
      }

      const command = allowSudoPasswordPrompt(parsed.command);
      const risky = isRiskyCommand(command);
      const shouldPause = run.mode === 'approve-all' || (run.mode === 'approve-risky' && risky);

      if (shouldPause) {
        emit(run, 'proposed', {
          command,
          message: risky ? 'This command looks destructive.' : undefined,
        });
        const approved = await waitForApproval(run, command);
        if (run.aborted) return;
        if (!approved) {
          run.transcript += `\n$ ${command}\n[skipped by user, not run]\n`;
          continue;
        }
      }

      emit(run, 'running', { command });
      const result = await runCommand(run, command);
      if (run.aborted) return;
      appendCompletedCommand(run, command, result);
    }
  } finally {
    cleanupRun(run);
  }
}

/** True while an AI task is actively running in this terminal session. */
export function isSshTaskRunning(sessionId: string): boolean {
  return runs.has(sessionId);
}

/** Model and effort flags for a CLI run, or none when the CLI should use its own defaults. */
function cliRunArgs(input: StartSshAgentTaskInput): string[] {
  if (!input.cliId || !input.modelId) return [];
  const profile = runProfileForTargetAI(input.cliId);
  const model = profile.models.find((m) => m.id === input.modelId);
  return model ? runChoiceArgs(profile, { model, effort: input.effort ?? undefined }) : [];
}

export function startSshTask(
  input: StartSshAgentTaskInput,
  listener: (progress: SshAgentProgress) => void,
): void {
  const { sessionId, prompt, mode } = input;
  if (runs.has(sessionId)) throw new Error('An AI task is already running in this session.');
  const target = input.target === 'local' ? localTarget(sessionId) : sshTarget(sessionId);
  if (!target.isConnected()) {
    throw new Error(
      target.kind === 'ssh'
        ? 'This SSH session is not connected.'
        : 'This terminal is not running anymore.',
    );
  }
  if (!prompt.trim()) throw new Error('Describe what you want the AI to do first.');

  const run: RunState = {
    sessionId,
    target,
    mode,
    cliId: input.cliId ?? null,
    runArgs: cliRunArgs(input),
    cliRequestId: null,
    prompt: prompt.trim(),
    transcript: '',
    step: 0,
    startedAt: Date.now(),
    aborted: false,
    controller: new AbortController(),
    pendingApproval: null,
    pendingInputAnswer: null,
    pendingPassword: null,
    // Replaced immediately below, once the real subscription exists.
    unsubscribeExit: () => undefined,
    listener,
  };
  run.unsubscribeExit = target.subscribeExit(() => stopSshTask(sessionId, 'exited'));
  runs.set(sessionId, run);
  void runLoop(run);
}

export function approveSshTaskCommand(sessionId: string): void {
  const run = runs.get(sessionId);
  if (!run?.pendingApproval) return;
  const { resolve } = run.pendingApproval;
  run.pendingApproval = null;
  resolve(true);
}

export function skipSshTaskCommand(sessionId: string): void {
  const run = runs.get(sessionId);
  if (!run?.pendingApproval) return;
  const { resolve } = run.pendingApproval;
  run.pendingApproval = null;
  resolve(false);
}

export function answerSshTaskInput(sessionId: string, answer: string): void {
  const run = runs.get(sessionId);
  if (!run?.pendingInputAnswer) return;
  const resolve = run.pendingInputAnswer;
  run.pendingInputAnswer = null;
  resolve(answer);
}

/** `approved` types the saved password into the prompt; false leaves it for the user to type. */
export function answerSshTaskPassword(sessionId: string, approved: boolean): void {
  const run = runs.get(sessionId);
  if (!run?.pendingPassword) return;
  const resolve = run.pendingPassword;
  run.pendingPassword = null;
  resolve(approved);
}

export function stopSshTask(sessionId: string, reason: 'user' | 'exited' = 'user'): void {
  const run = runs.get(sessionId);
  if (!run || run.aborted) return;
  run.aborted = true;
  run.controller.abort();
  if (run.cliRequestId) cancelHeadlessPrompt(run.cliRequestId);
  settlePendingPassword(run);
  if (run.pendingApproval) {
    run.pendingApproval.resolve(false);
    run.pendingApproval = null;
  }
  if (run.pendingInputAnswer) {
    run.pendingInputAnswer('');
    run.pendingInputAnswer = null;
  }
  emit(run, 'stopped', {
    message:
      reason === 'user'
        ? 'Stopped by user.'
        : run.target.kind === 'ssh'
          ? 'The SSH session ended.'
          : 'The terminal closed.',
  });
  cleanupRun(run);
}

/** Called from `before-quit`, alongside `killAllSshSessions`. */
export function stopAllSshTasks(): void {
  for (const sessionId of [...runs.keys()]) stopSshTask(sessionId, 'exited');
}
