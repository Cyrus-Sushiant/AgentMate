import { describe, expect, it } from 'vitest';
import {
  AGENT_STATUS_TIMING,
  type AgentStatusEvent,
  type AgentStatusState,
  initialAgentStatus,
  looksLikeNeedsInput,
  mostUrgentStatus,
  reduceAgentStatus,
} from './agentStatus.js';

function run(state: AgentStatusState, events: AgentStatusEvent[]): AgentStatusState {
  return events.reduce(reduceAgentStatus, state);
}

/** Steady output from `from` to `to`, one 200-byte chunk every 200ms. */
function streamOutput(from: number, to: number): AgentStatusEvent[] {
  const events: AgentStatusEvent[] = [];
  for (let at = from; at <= to; at += 200) events.push({ type: 'output', bytes: 200, at });
  return events;
}

describe('agentStatus heuristic', () => {
  it('starts working after a sustained burst', () => {
    const state = run(initialAgentStatus(true), streamOutput(10_000, 10_400));
    expect(state.status).toBe('working');
    expect(state.workingSince).toBe(10_000);
  });

  it('ignores a single small chunk', () => {
    const state = run(initialAgentStatus(true), [{ type: 'output', bytes: 40, at: 5_000 }]);
    expect(state.status).toBe('idle');
  });

  it('ignores keystroke echo and resize repaints', () => {
    let state = initialAgentStatus(true);
    for (let at = 10_000; at < 12_000; at += 100) {
      state = run(state, [
        { type: 'input', at },
        { type: 'output', bytes: 300, at: at + 20 },
      ]);
    }
    expect(state.status).toBe('idle');
    state = run(state, [{ type: 'resize', at: 20_000 }, ...streamOutput(20_100, 20_700)]);
    expect(state.status).toBe('idle');
  });

  it('settles to done after long work and silence', () => {
    const state = run(initialAgentStatus(true), [
      ...streamOutput(10_000, 20_000),
      { type: 'tick', at: 20_000 + AGENT_STATUS_TIMING.silenceMs - 1 },
    ]);
    expect(state.status).toBe('working');
    const settled = reduceAgentStatus(state, {
      type: 'tick',
      at: 20_000 + AGENT_STATUS_TIMING.silenceMs,
    });
    expect(settled.status).toBe('done');
    expect(reduceAgentStatus(settled, { type: 'ack' }).status).toBe('idle');
  });

  it('settles to idle after short work, or for plain shells', () => {
    const short = run(initialAgentStatus(true), [
      ...streamOutput(10_000, 11_000),
      { type: 'tick', at: 16_000 },
    ]);
    expect(short.status).toBe('idle');
    const shell = run(initialAgentStatus(false), [
      ...streamOutput(10_000, 30_000),
      { type: 'tick', at: 40_000 },
    ]);
    expect(shell.status).toBe('idle');
  });
});

describe('agentStatus hooks', () => {
  it('follows prompt, needs-input and stop', () => {
    let state = run(initialAgentStatus(true), [{ type: 'hook', event: 'prompt', at: 1_000 }]);
    expect(state.status).toBe('working');
    state = reduceAgentStatus(state, { type: 'hook', event: 'needs-input', at: 2_000 });
    expect(state.status).toBe('needs-input');

    // Redraws of the question do not count as the agent carrying on.
    state = run(state, streamOutput(3_000, 4_000));
    expect(state.status).toBe('needs-input');

    // Once answered, output means it is working again.
    state = run(state, [{ type: 'input', at: 5_000 }, ...streamOutput(5_500, 6_500)]);
    expect(state.status).toBe('working');

    state = reduceAgentStatus(state, { type: 'hook', event: 'stop', at: 7_000 });
    expect(state.status).toBe('done');
  });

  it('never marks a hook-driven agent done from silence or restarts it from output', () => {
    let state = run(initialAgentStatus(true), [
      { type: 'hook', event: 'prompt', at: 1_000 },
      ...streamOutput(1_000, 20_000),
      { type: 'tick', at: 30_000 },
    ]);
    expect(state.status).toBe('idle');
    state = run(state, streamOutput(31_000, 33_000));
    expect(state.status).toBe('idle');
  });

  it('stays exited', () => {
    const state = run(initialAgentStatus(true), [
      { type: 'exit', at: 1 },
      { type: 'hook', event: 'prompt', at: 2 },
    ]);
    expect(state.status).toBe('exited');
  });

  it('ranks the most urgent status', () => {
    expect(mostUrgentStatus(['idle', 'working', 'done'])).toBe('done');
    expect(mostUrgentStatus(['done', 'needs-input'])).toBe('needs-input');
    expect(mostUrgentStatus([])).toBeNull();
  });
});

describe('agentStatus guessed needs-input', () => {
  it('flips idle or working to needs-input', () => {
    const fromIdle = reduceAgentStatus(initialAgentStatus(true), {
      type: 'guess-needs-input',
      at: 1_000,
    });
    expect(fromIdle.status).toBe('needs-input');
    expect(fromIdle.needsInputSince).toBe(1_000);
    expect(fromIdle.hookDriven).toBe(false);

    const working = run(initialAgentStatus(true), streamOutput(10_000, 10_400));
    const fromWorking = reduceAgentStatus(working, { type: 'guess-needs-input', at: 10_500 });
    expect(fromWorking.status).toBe('needs-input');
    expect(fromWorking.workingSince).toBeNull();
  });

  it('is a no-op once already needs-input, and never sets hookDriven', () => {
    const state = reduceAgentStatus(initialAgentStatus(true), {
      type: 'guess-needs-input',
      at: 1_000,
    });
    const again = reduceAgentStatus(state, { type: 'guess-needs-input', at: 2_000 });
    expect(again.needsInputSince).toBe(1_000);
    // Silence still reaches `done` afterward, since a guess never turns on hookDriven.
    const answered = run(again, [
      { type: 'input', at: 3_000 },
      ...streamOutput(3_200, 13_200),
      { type: 'tick', at: 13_200 + AGENT_STATUS_TIMING.silenceMs },
    ]);
    expect(answered.status).toBe('done');
  });

  it('defers to real hooks once a session is hook-driven', () => {
    const state = reduceAgentStatus(initialAgentStatus(true), {
      type: 'hook',
      event: 'prompt',
      at: 1_000,
    });
    const guessed = reduceAgentStatus(state, { type: 'guess-needs-input', at: 2_000 });
    expect(guessed.status).toBe('working');
  });
});

describe('looksLikeNeedsInput', () => {
  it('matches common confirmation prompts', () => {
    expect(looksLikeNeedsInput('Overwrite existing file? (y/n)')).toBe(true);
    expect(looksLikeNeedsInput('Do you want to proceed?')).toBe(true);
    expect(looksLikeNeedsInput('This tool needs your permission to continue')).toBe(true);
    expect(looksLikeNeedsInput('Waiting for your response...')).toBe(true);
  });

  it('ignores ANSI escapes and ordinary output', () => {
    expect(looksLikeNeedsInput('\x1b[32mBuild succeeded\x1b[0m')).toBe(false);
    expect(looksLikeNeedsInput('\x1b[1mDo you want to proceed?\x1b[0m')).toBe(true);
    expect(looksLikeNeedsInput('installing dependencies...')).toBe(false);
  });
});
