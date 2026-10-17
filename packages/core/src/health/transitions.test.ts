import { describe, expect, it } from 'vitest';
import { INITIAL_HEALTH_TRACK, isHealthProblem, nextHealthTrack } from './transitions.js';
import type { HealthProbeState } from './types.js';

function run(states: HealthProbeState[], confirm = 2) {
  let track = INITIAL_HEALTH_TRACK;
  const events: string[] = [];
  for (const state of states) {
    const step = nextHealthTrack(track, state, confirm);
    track = step.track;
    if (step.opened) events.push('opened');
    if (step.resolved) events.push('resolved');
  }
  return { track, events };
}

describe('isHealthProblem', () => {
  it('counts the states that mean the target is down', () => {
    expect(isHealthProblem('fail')).toBe(true);
    expect(isHealthProblem('unreachable')).toBe(true);
    expect(isHealthProblem('unauthorized')).toBe(true);
    expect(isHealthProblem('invalid')).toBe(true);
    expect(isHealthProblem('warn')).toBe(false);
    expect(isHealthProblem('pass')).toBe(false);
  });
});

describe('nextHealthTrack', () => {
  it('confirms a first good sample at once and opens nothing', () => {
    const { track, events } = run(['pass']);
    expect(track.confirmed).toBe('ok');
    expect(track.pending).toBe(false);
    expect(events).toEqual([]);
  });

  it('opens an incident only after the problem repeats', () => {
    const once = run(['pass', 'fail']);
    expect(once.events).toEqual([]);
    expect(once.track.pending).toBe(true);

    const twice = run(['pass', 'fail', 'unreachable']);
    expect(twice.events).toEqual(['opened']);
    expect(twice.track.confirmed).toBe('problem');
    expect(twice.track.pending).toBe(false);
  });

  it('ignores a single blip', () => {
    expect(run(['pass', 'fail', 'pass', 'fail', 'pass']).events).toEqual([]);
  });

  it('resolves after the target recovers for the same number of samples', () => {
    expect(run(['pass', 'fail', 'fail', 'pass']).events).toEqual(['opened']);
    expect(run(['pass', 'fail', 'fail', 'pass', 'warn']).events).toEqual(['opened', 'resolved']);
  });

  it('needs confirmation for a problem on the very first samples too', () => {
    expect(run(['fail']).events).toEqual([]);
    expect(run(['fail', 'fail']).events).toEqual(['opened']);
  });

  it('opens at once when confirmation is set to one sample', () => {
    expect(run(['pass', 'fail'], 1).events).toEqual(['opened']);
  });

  it('does not open twice while it stays down', () => {
    expect(run(['fail', 'fail', 'fail', 'fail']).events).toEqual(['opened']);
  });
});
