import { randomUUID } from 'node:crypto';
import type {
  AiProvider,
  SshAgentMode,
  SshAgentPhase,
  SshAgentProgress,
} from '../../shared/apiTypes';
import { runAiPrompt } from '../ipc/ai';
import { hasSshSession, subscribeSshExit, subscribeSshOutput, writeToSshSession } from '../ipc/ssh';
import { speakOnPet } from '../notifications/petNotifier';
import { store } from '../store';

/** Refuses to loop forever if the AI never says FINISHED. */
const MAX_STEPS = 40;
const MAX_RUNTIME_MS = 30 * 60 * 1000;
/** How long a single command may run before its output is given up on. */
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
/** How much of the transcript is kept in the prompt sent to the AI each step. */
const TRANSCRIPT_TAIL_CHARS = 6000;

/**
 * Commands that look destructive enough to pause for approval even in `approve-risky` mode.
 * False negatives are fine (the user can still stop the run); a false positive just costs one
 * extra click.
 */
const RISKY_PATTERNS = [
  /\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\b/i,
  /\bmkfs(\.\w+)?\b/i,
  /\bdd\s+if=/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
  /\bdrop\s+(table|database)\b/i,
  /\b(shutdown|reboot|poweroff|halt)\b/i,
  /\bchmod\s+-R\s+777\s+\//i,
  />\s*\/dev\/(sd|nvme|hd|xvd)/i,
  /\bdocker\s+system\s+prune\b/i,
  /\biptables\s+-F\b/i,
  /\bkill\s+-9\s+1\b/i,
  /\buserdel\b/i,
  /\bcurl[^|]*\|\s*(sudo\s+)?(sh|bash)\b/i,
  /\bwget[^|]*\|\s*(sudo\s+)?(sh|bash)\b/i,
];

function isRiskyCommand(command: string): boolean {
  return RISKY_PATTERNS.some((pattern) => pattern.test(command));
}

type ParsedReply =
  | { kind: 'run'; command: string }
  | { kind: 'finished'; message: string }
  | { kind: 'needs-input'; message: string };

function parseModelReply(text: string): ParsedReply | null {
  const runMatch = text.match(/^\s*RUN:\s*(.+)$/im);
  if (runMatch) {
    const command = runMatch[1]
      .trim()
      .replace(/^`+|`+$/g, '')
      .trim();
    if (command) return { kind: 'run', command };
  }
  const finishedMatch = text.match(/^\s*FINISHED:?\s*(.*)$/im);
  if (finishedMatch) return { kind: 'finished', message: finishedMatch[1].trim() };
  const needsInputMatch = text.match(/^\s*NEEDS_INPUT:\s*(.+)$/im);
  if (needsInputMatch) return { kind: 'needs-input', message: needsInputMatch[1].trim() };
  return null;
}

function buildPrompt(run: RunState): string {
  const tail =
    run.transcript.length > TRANSCRIPT_TAIL_CHARS
      ? `…(earlier output truncated)…${run.transcript.slice(-TRANSCRIPT_TAIL_CHARS)}`
      : run.transcript || '(no commands run yet)';
  return `You are operating a real remote Linux shell over an active SSH session on behalf of a user, who is watching every command execute live in their terminal.

User's task: "${run.prompt}"

Reply with EXACTLY one of these three forms, and nothing else:
RUN: <a single shell command>
FINISHED: <one short sentence summarizing what was accomplished>
NEEDS_INPUT: <a short question for the user>

Rules:
- Exactly one command per reply. Do not chain unrelated steps with && unless they are trivially part of the same action.
- Prefer non-interactive flags (-y, --yes, --non-interactive) so a command never hangs waiting on a TTY prompt.
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
  mode: SshAgentMode;
  prompt: string;
  transcript: string;
  step: number;
  startedAt: number;
  aborted: boolean;
  controller: AbortController;
  pendingApproval: PendingApproval | null;
  pendingInputAnswer: ((answer: string) => void) | null;
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

function waitForCompletion(run: RunState, marker: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    let buffer = '';
    const doneRegex = new RegExp(`${marker}:(\\d+)`);
    let settled = false;
    const timer = setTimeout(
      () => finish({ output: buffer, exitCode: null, timedOut: true }),
      COMMAND_TIMEOUT_MS,
    );
    const unsubscribeOutput = subscribeSshOutput(run.sessionId, (data) => {
      buffer += data;
      const match = buffer.match(doneRegex);
      if (match?.index !== undefined) {
        finish({
          output: buffer.slice(0, match.index),
          exitCode: Number(match[1]),
          timedOut: false,
        });
      }
    });
    const unsubscribeExit = subscribeSshExit(run.sessionId, () =>
      finish({ output: buffer, exitCode: null, timedOut: false }),
    );

    function finish(result: CommandResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribeOutput();
      unsubscribeExit();
      resolve(result);
    }
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

async function runLoop(run: RunState): Promise<void> {
  try {
    const { provider, model } = await resolveProviderAndModel();

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
        reply = await runAiPrompt(provider, model, buildPrompt(run), [], run.controller.signal);
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
        speakOnPet(settings, 'SSH session', parsed.message || 'AI finished the SSH task.', 'pass');
        return;
      }

      if (parsed.kind === 'needs-input') {
        emit(run, 'needs-input', { message: parsed.message });
        const settings = await store.getSettings();
        speakOnPet(settings, 'SSH session', `AI needs input: ${parsed.message}`, 'warn');
        const answer = await waitForUserAnswer(run);
        if (run.aborted) return;
        run.transcript += `\n[You answered]: ${answer}\n`;
        continue;
      }

      const { command } = parsed;
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
      const marker = `__AGENTMATE_DONE_${randomUUID().replace(/-/g, '')}__`;
      const resultPromise = waitForCompletion(run, marker);
      writeToSshSession(run.sessionId, `${command}; printf '\\n${marker}:%s\\n' "$?"\n`);
      const result = await resultPromise;
      if (run.aborted) return;
      appendCompletedCommand(run, command, result);
    }
  } finally {
    cleanupRun(run);
  }
}

/** True while an AI task is actively running in this SSH session. */
export function isSshTaskRunning(sessionId: string): boolean {
  return runs.has(sessionId);
}

export function startSshTask(
  sessionId: string,
  prompt: string,
  mode: SshAgentMode,
  listener: (progress: SshAgentProgress) => void,
): void {
  if (runs.has(sessionId)) throw new Error('An AI task is already running in this session.');
  if (!hasSshSession(sessionId)) throw new Error('This SSH session is not connected.');
  if (!prompt.trim()) throw new Error('Describe what you want the AI to do first.');

  const run: RunState = {
    sessionId,
    mode,
    prompt: prompt.trim(),
    transcript: '',
    step: 0,
    startedAt: Date.now(),
    aborted: false,
    controller: new AbortController(),
    pendingApproval: null,
    pendingInputAnswer: null,
    // Replaced immediately below, once the real subscription exists.
    unsubscribeExit: () => undefined,
    listener,
  };
  run.unsubscribeExit = subscribeSshExit(sessionId, () => stopSshTask(sessionId, 'exited'));
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

export function stopSshTask(sessionId: string, reason: 'user' | 'exited' = 'user'): void {
  const run = runs.get(sessionId);
  if (!run || run.aborted) return;
  run.aborted = true;
  run.controller.abort();
  if (run.pendingApproval) {
    run.pendingApproval.resolve(false);
    run.pendingApproval = null;
  }
  if (run.pendingInputAnswer) {
    run.pendingInputAnswer('');
    run.pendingInputAnswer = null;
  }
  emit(run, 'stopped', {
    message: reason === 'exited' ? 'The SSH session ended.' : 'Stopped by user.',
  });
  cleanupRun(run);
}

/** Called from `before-quit`, alongside `killAllSshSessions`. */
export function stopAllSshTasks(): void {
  for (const sessionId of [...runs.keys()]) stopSshTask(sessionId, 'exited');
}
