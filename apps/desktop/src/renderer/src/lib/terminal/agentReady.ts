/**
 * Tells when an agent CLI that a tab just started is ready to be typed into.
 *
 * There is no signal for this: a CLI does not announce that its input box is on screen. What it
 * does do is paint a screenful of its own UI, turn on bracketed paste (every agent CLI does, it
 * is how they take a pasted block as one piece), and then stop drawing while it waits. Those
 * three together are a good stand-in, and the minimum wait keeps the shell's own echo of the
 * launch command from passing for the CLI on a slow start.
 *
 * Bracketed paste is the one signal that cannot be dropped: without it every newline in a pasted
 * prompt is a submitted line, which at a shell prompt means running the prompt as commands. So a
 * CLI that never gets there times out and the prompt goes back to the caller undelivered.
 *
 * Pure and clock-free, so the caller can poll it from wherever it already tracks output.
 */

export interface AgentReadySignals {
  /** Output since the launch command was sent, in bytes. */
  bytes: number;
  /** How long ago the launch command was sent. */
  elapsedMs: number;
  /** How long the terminal has been quiet. */
  quietMs: number;
  /** The program has turned on bracketed paste, so a whole prompt can go in as one paste. */
  bracketedPaste: boolean;
}

export const AGENT_READY_TIMING = {
  /** More output than a prompt plus the echoed command, so what is on screen is the CLI's. */
  minBytes: 512,
  /** Nothing counts as ready before this, however quiet it looks. */
  minElapsedMs: 1200,
  /** Silence this long means the CLI has finished drawing and is waiting on the user. */
  quietMs: 700,
  /** A CLI that never gets there (not installed, a question at the shell) stops being waited on. */
  timeoutMs: 20_000,
} as const;

export type AgentReadyVerdict = 'wait' | 'ready' | 'timeout';

export function agentReadyVerdict(signals: AgentReadySignals): AgentReadyVerdict {
  const t = AGENT_READY_TIMING;
  if (
    signals.bracketedPaste &&
    signals.elapsedMs >= t.minElapsedMs &&
    signals.bytes >= t.minBytes &&
    signals.quietMs >= t.quietMs
  ) {
    return 'ready';
  }
  return signals.elapsedMs >= t.timeoutMs ? 'timeout' : 'wait';
}
