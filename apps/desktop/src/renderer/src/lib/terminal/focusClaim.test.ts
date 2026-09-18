import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimTerminalFocus, releaseTerminalFocus } from './focusClaim';

/**
 * The claim runs on animation frames, so the fake timers drive both the frames and the clock it
 * measures its window with.
 */
const FRAME_MS = 16;
const CLAIM_MS = 2000;
const OPEN_WAIT_MS = 10_000;

function frames(count: number): void {
  vi.advanceTimersByTime(FRAME_MS * count);
}

/** Moves focus onto something outside the terminal, the way a closing menu does. */
function steal(): void {
  const other = document.createElement('button');
  document.body.appendChild(other);
  other.focus();
}

function makeTarget(canFocus = true) {
  const element = document.createElement('div');
  element.tabIndex = -1;
  document.body.appendChild(element);
  const focus = vi.fn(() => element.focus());
  return { element, canFocus: vi.fn(() => canFocus), focus };
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.replaceChildren();
});

afterEach(() => {
  // Leaving a claim running would keep its window listeners for the next test.
  vi.useRealTimers();
});

describe('claimTerminalFocus', () => {
  it('takes focus straight away when it is somewhere else', () => {
    const target = makeTarget();
    claimTerminalFocus(target);
    expect(target.focus).toHaveBeenCalledTimes(1);
    releaseTerminalFocus(target.element);
  });

  it('takes focus back when something else steals it', () => {
    // The menu or dialog that launched the terminal hands focus back to its trigger as it closes.
    const target = makeTarget();
    claimTerminalFocus(target);
    steal();
    frames(2);
    expect(target.focus.mock.calls.length).toBeGreaterThan(1);
    releaseTerminalFocus(target.element);
  });

  it('leaves focus alone once it is inside the terminal', () => {
    const target = makeTarget();
    const inner = document.createElement('input');
    target.element.appendChild(inner);
    inner.focus();
    claimTerminalFocus(target);
    frames(5);
    expect(target.focus).not.toHaveBeenCalled();
    releaseTerminalFocus(target.element);
  });

  it('gives up the moment the user clicks somewhere', () => {
    const target = makeTarget();
    claimTerminalFocus(target);
    target.focus.mockClear();
    window.dispatchEvent(new Event('pointerdown'));
    steal();
    frames(5);
    expect(target.focus).not.toHaveBeenCalled();
  });

  it('gives up when the user tabs away, but not on any other key', () => {
    const target = makeTarget();
    claimTerminalFocus(target);
    target.focus.mockClear();
    steal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    frames(2);
    expect(target.focus).toHaveBeenCalled();

    target.focus.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    steal();
    frames(5);
    expect(target.focus).not.toHaveBeenCalled();
  });

  it('stops reclaiming once its couple of seconds are up', () => {
    const target = makeTarget();
    claimTerminalFocus(target);
    vi.advanceTimersByTime(CLAIM_MS + FRAME_MS * 2);
    target.focus.mockClear();
    steal();
    frames(5);
    expect(target.focus).not.toHaveBeenCalled();
  });

  it('waits for a terminal that cannot take focus yet, and starts its window then', () => {
    // A drawer still opening, or a terminal still waiting on its font, should not burn the window.
    let ready = false;
    const element = document.createElement('div');
    element.tabIndex = -1;
    document.body.appendChild(element);
    const target = { element, canFocus: () => ready, focus: vi.fn() };
    claimTerminalFocus(target);
    vi.advanceTimersByTime(3000);
    expect(target.focus).not.toHaveBeenCalled();

    ready = true;
    frames(2);
    expect(target.focus).toHaveBeenCalled();
    // The two second window only starts here, so it still has time after the long wait.
    target.focus.mockClear();
    vi.advanceTimersByTime(1000);
    expect(target.focus).toHaveBeenCalled();
    releaseTerminalFocus(element);
  });

  it('gives up on a terminal that never opens', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const target = { element, canFocus: () => false, focus: vi.fn() };
    claimTerminalFocus(target);
    vi.advanceTimersByTime(OPEN_WAIT_MS + FRAME_MS * 2);
    // Nothing is left running: opening a terminal later must not inherit this claim.
    expect(target.focus).not.toHaveBeenCalled();
  });

  it('hands the claim over when another terminal asks for focus', () => {
    const first = makeTarget();
    const second = makeTarget();
    claimTerminalFocus(first);
    claimTerminalFocus(second);
    first.focus.mockClear();
    second.focus.mockClear();
    steal();
    frames(3);
    expect(first.focus).not.toHaveBeenCalled();
    expect(second.focus).toHaveBeenCalled();
    releaseTerminalFocus(second.element);
  });
});

describe('releaseTerminalFocus', () => {
  it('drops the claim of the terminal that was disposed', () => {
    const target = makeTarget();
    claimTerminalFocus(target);
    releaseTerminalFocus(target.element);
    target.focus.mockClear();
    steal();
    frames(5);
    expect(target.focus).not.toHaveBeenCalled();
  });

  it('leaves another terminal is claim running', () => {
    const target = makeTarget();
    claimTerminalFocus(target);
    releaseTerminalFocus(document.createElement('div'));
    target.focus.mockClear();
    steal();
    frames(3);
    expect(target.focus).toHaveBeenCalled();
    releaseTerminalFocus(target.element);
  });
});
