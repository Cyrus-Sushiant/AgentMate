/**
 * Works out what an agent in a terminal is doing. Most CLIs give no signal at all, so the
 * base is a heuristic on the output stream: a sustained burst means it is working, a long
 * enough silence means it stopped. CLIs that report through hooks (Claude Code) override
 * that with exact events. CLIs with no hooks but a recognizable prompt on screen (a
 * `(y/n)`-style confirmation, a permission request) get a best-effort `guess-needs-input`
 * nudge instead - see `looksLikeNeedsInput`.
 *
 * Pure and clock-free: every event carries its own timestamp, which keeps it testable and
 * lets the main process drive it from a single ticker.
 */

export type AgentStatus = 'idle' | 'working' | 'needs-input' | 'done' | 'exited';

export type AgentHookEvent = 'prompt' | 'needs-input' | 'stop' | 'session-end';

export type AgentStatusEvent =
  | { type: 'output'; bytes: number; at: number }
  | { type: 'input'; at: number }
  | { type: 'resize'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'hook'; event: AgentHookEvent; at: number }
  | { type: 'guess-needs-input'; at: number }
  | { type: 'ack' }
  | { type: 'exit'; at: number };

export interface AgentStatusState {
  status: AgentStatus;
  /** The session was launched as an agent CLI, not a plain shell. Only agents get `done`. */
  isAgent: boolean;
  /** At least one hook event arrived, so hooks decide when the agent is done. */
  hookDriven: boolean;
  workingSince: number | null;
  needsInputSince: number | null;
  lastOutputAt: number;
  lastInputAt: number;
  lastResizeAt: number;
  burstStart: number;
  burstChunks: number;
  burstBytes: number;
}

/** Tunables, exported so tests and per-CLI tuning read the same numbers. */
export const AGENT_STATUS_TIMING = {
  /** Output this soon after a keystroke is the shell echoing it back. */
  inputEchoMs: 250,
  /** TUIs repaint the whole screen after a resize; that is not work either. */
  resizeRepaintMs: 800,
  burstWindowMs: 1500,
  burstMinChunks: 3,
  burstMinBytes: 256,
  /** Silence that ends a working stretch. */
  silenceMs: 4000,
  /** A stretch shorter than this settles to idle instead of done, so a quick `ls` never notifies. */
  minWorkForDoneMs: 8000,
} as const;

export function initialAgentStatus(isAgent: boolean): AgentStatusState {
  return {
    status: 'idle',
    isAgent,
    hookDriven: false,
    workingSince: null,
    needsInputSince: null,
    lastOutputAt: 0,
    lastInputAt: Number.NEGATIVE_INFINITY,
    lastResizeAt: Number.NEGATIVE_INFINITY,
    burstStart: 0,
    burstChunks: 0,
    burstBytes: 0,
  };
}

function startWorking(state: AgentStatusState, since: number, at: number): AgentStatusState {
  return {
    ...state,
    status: 'working',
    workingSince: since,
    needsInputSince: null,
    lastOutputAt: at,
  };
}

function onOutput(state: AgentStatusState, bytes: number, at: number): AgentStatusState {
  const t = AGENT_STATUS_TIMING;
  if (at - state.lastInputAt < t.inputEchoMs || at - state.lastResizeAt < t.resizeRepaintMs) {
    // Keep a running stretch alive, but never let an echo or a repaint start one.
    return state.status === 'working' ? { ...state, lastOutputAt: at } : state;
  }
  if (state.status === 'working') return { ...state, lastOutputAt: at };
  // Hooks say exactly when work starts. Guessing from output as well would flip a finished
  // agent back to working every time its prompt box redraws. The exception is an answered
  // question: no hook fires when the agent carries on, so output is the only signal.
  if (state.hookDriven && state.status !== 'needs-input') return state;

  // A question on screen stays a question until the user has answered it.
  if (
    state.status === 'needs-input' &&
    state.needsInputSince !== null &&
    state.lastInputAt <= state.needsInputSince
  ) {
    return state;
  }

  const fresh = at - state.burstStart > t.burstWindowMs;
  const next: AgentStatusState = {
    ...state,
    burstStart: fresh ? at : state.burstStart,
    burstChunks: (fresh ? 0 : state.burstChunks) + 1,
    burstBytes: (fresh ? 0 : state.burstBytes) + bytes,
  };
  if (next.burstChunks >= t.burstMinChunks && next.burstBytes >= t.burstMinBytes) {
    return startWorking(next, next.burstStart, at);
  }
  return next;
}

function onTick(state: AgentStatusState, at: number): AgentStatusState {
  if (state.status !== 'working') return state;
  if (at - state.lastOutputAt < AGENT_STATUS_TIMING.silenceMs) return state;
  const workedFor = state.lastOutputAt - (state.workingSince ?? state.lastOutputAt);
  // A hook-driven agent is only done when its Stop hook says so. Silence alone means it
  // went quiet, which also happens right before the hook lands.
  const done =
    !state.hookDriven && state.isAgent && workedFor >= AGENT_STATUS_TIMING.minWorkForDoneMs;
  return { ...state, status: done ? 'done' : 'idle', workingSince: null };
}

/**
 * A CLI with no hooks printed something that reads like a question ("(y/n)", a permission
 * request). Unlike `onHook`, this never sets `hookDriven` - it is a one-off nudge, not a
 * promise that every future state change will arrive as an explicit event, so the output
 * heuristic (including silence-based `done`) keeps running afterward.
 */
function onGuessNeedsInput(state: AgentStatusState, at: number): AgentStatusState {
  if (state.hookDriven || state.status === 'needs-input') return state;
  return { ...state, status: 'needs-input', needsInputSince: at, workingSince: null };
}

/** Common shapes of "waiting on you" prompts, for CLIs with no hook integration. */
const NEEDS_INPUT_PATTERNS = [
  /permission|approv/i,
  /needs your/i,
  /waiting for (your|user) (input|response|approval)/i,
  /\(y\/n\)/i,
  /\[y\/n\]/i,
  /do you want to (proceed|continue|allow)/i,
  /overwrite\?/i,
];

/**
 * Best-effort: strips ANSI CSI sequences, then checks the text against a short list of
 * common confirmation-prompt shapes. False negatives are fine (the burst/silence heuristic
 * still reaches `done` on its own); a false positive just makes the pet speak once for a
 * line that happens to mention "permission".
 */
export function looksLikeNeedsInput(text: string): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping the ANSI escape itself
  const plain = text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');
  return NEEDS_INPUT_PATTERNS.some((pattern) => pattern.test(plain));
}

function onHook(state: AgentStatusState, event: AgentHookEvent, at: number): AgentStatusState {
  const hooked = { ...state, hookDriven: true };
  switch (event) {
    case 'prompt':
      return startWorking(hooked, at, at);
    case 'needs-input':
      return { ...hooked, status: 'needs-input', needsInputSince: at, workingSince: null };
    case 'stop':
      return { ...hooked, status: 'done', workingSince: null, needsInputSince: null };
    case 'session-end':
      return { ...hooked, status: 'idle', workingSince: null, needsInputSince: null };
  }
}

export function reduceAgentStatus(
  state: AgentStatusState,
  event: AgentStatusEvent,
): AgentStatusState {
  if (state.status === 'exited') return state;
  switch (event.type) {
    case 'output':
      return onOutput(state, event.bytes, event.at);
    case 'input':
      return { ...state, lastInputAt: event.at };
    case 'resize':
      return { ...state, lastResizeAt: event.at };
    case 'tick':
      return onTick(state, event.at);
    case 'hook':
      return onHook(state, event.event, event.at);
    case 'guess-needs-input':
      return onGuessNeedsInput(state, event.at);
    case 'ack':
      return state.status === 'done' ? { ...state, status: 'idle' } : state;
    case 'exit':
      return { ...state, status: 'exited', workingSince: null, needsInputSince: null };
  }
}

/** Which state wins when several sessions share one badge (a project in the rail). */
export const AGENT_STATUS_PRIORITY: Record<AgentStatus, number> = {
  'needs-input': 4,
  done: 3,
  working: 2,
  idle: 1,
  exited: 0,
};

export function mostUrgentStatus(statuses: Iterable<AgentStatus>): AgentStatus | null {
  let best: AgentStatus | null = null;
  for (const status of statuses) {
    if (best === null || AGENT_STATUS_PRIORITY[status] > AGENT_STATUS_PRIORITY[best]) {
      best = status;
    }
  }
  return best;
}
