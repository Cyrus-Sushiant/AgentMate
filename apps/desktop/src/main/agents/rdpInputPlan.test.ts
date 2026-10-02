import { describe, expect, it } from 'vitest';
import type { RdpInputOp } from '../../shared/apiTypes';
import type { FrameMapping } from './rdpCoords';
import { actionToInputOps } from './rdpInputPlan';

/** A 960x540 screenshot of a 1920x1080 desktop, so every point doubles. */
const half: FrameMapping = {
  frameWidth: 960,
  frameHeight: 540,
  desktopWidth: 1920,
  desktopHeight: 1080,
};

function plan(...args: Parameters<typeof actionToInputOps>) {
  const result = actionToInputOps(...args);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('actionToInputOps', () => {
  it('clicks by moving there and pressing the left button', () => {
    const { ops, note } = plan({ kind: 'click', x: 512, y: 300 }, half);
    expect(ops).toEqual([
      { kind: 'move', x: 1024, y: 600 },
      { kind: 'button', button: 0, down: true },
      { kind: 'button', button: 0, down: false },
    ]);
    expect(note).toBe('clicked at (1024, 600)');
  });

  it('double-clicks with a short pause between the clicks', () => {
    const { ops, note } = plan({ kind: 'double-click', x: 10, y: 20 }, half);
    expect(ops).toEqual([
      { kind: 'move', x: 20, y: 40 },
      { kind: 'button', button: 0, down: true },
      { kind: 'button', button: 0, down: false },
      { kind: 'pause', ms: 60 },
      { kind: 'button', button: 0, down: true },
      { kind: 'button', button: 0, down: false },
    ]);
    expect(note).toBe('double-clicked at (20, 40)');
  });

  it('right-clicks with button 2', () => {
    const { ops, note } = plan({ kind: 'right-click', x: 10, y: 20 }, half);
    expect(ops).toEqual([
      { kind: 'move', x: 20, y: 40 },
      { kind: 'button', button: 2, down: true },
      { kind: 'button', button: 2, down: false },
    ]);
    expect(note).toBe('right-clicked at (20, 40)');
  });

  it('only moves for MOVE', () => {
    expect(plan({ kind: 'move', x: 10, y: 20 }, half)).toEqual({
      ops: [{ kind: 'move', x: 20, y: 40 }],
      note: 'moved the pointer to (20, 40)',
    });
  });

  it('drags through intermediate points with the button held', () => {
    const { ops, note } = plan({ kind: 'drag', x1: 0, y1: 0, x2: 100, y2: 50 }, half);
    expect(ops[0]).toEqual({ kind: 'move', x: 0, y: 0 });
    expect(ops[1]).toEqual({ kind: 'button', button: 0, down: true });
    const moves = ops.filter((op) => op.kind === 'move').slice(1);
    expect(moves).toHaveLength(10);
    expect(moves[4]).toEqual({ kind: 'move', x: 100, y: 50 });
    expect(moves.at(-1)).toEqual({ kind: 'move', x: 200, y: 100 });
    expect(ops.at(-1)).toEqual({ kind: 'button', button: 0, down: false });
    expect(note).toBe('dragged from (0, 0) to (200, 100)');
  });

  it('spreads a drag over time, since window managers ignore a jump made all at once', () => {
    const { ops } = plan({ kind: 'drag', x1: 0, y1: 0, x2: 100, y2: 50 }, half);
    // Held a moment before moving, a pause after every step, and held again before letting go.
    expect(ops[2]).toEqual({ kind: 'pause', ms: 100 });
    const afterMoves = ops.slice(3, -2);
    for (let i = 0; i < afterMoves.length; i += 2) {
      expect(afterMoves[i]?.kind).toBe('move');
      expect(afterMoves[i + 1]).toEqual({ kind: 'pause', ms: 20 });
    }
    expect(ops.at(-2)).toEqual({ kind: 'pause', ms: 100 });
  });

  it('scrolls down with a negative line amount, after moving there', () => {
    const { ops, note } = plan(
      { kind: 'scroll', x: 10, y: 20, direction: 'down', amount: 3 },
      half,
    );
    expect(ops).toEqual([
      { kind: 'move', x: 20, y: 40 },
      { kind: 'wheel', vertical: true, amount: -3, unit: 1 },
    ]);
    expect(note).toBe('scrolled down 3 at (20, 40)');
  });

  it('scrolls up with a positive amount', () => {
    const { ops } = plan({ kind: 'scroll', x: 10, y: 20, direction: 'up', amount: 5 }, half);
    expect(ops[1]).toEqual({ kind: 'wheel', vertical: true, amount: 5, unit: 1 });
  });

  it('types each character as unicode, with Enter and Tab as keys', () => {
    const { ops, note } = plan({ kind: 'type', text: 'a\tb\n' }, half);
    expect(ops).toEqual([
      { kind: 'unicode', char: 'a', down: true },
      { kind: 'unicode', char: 'a', down: false },
      { kind: 'key', scancode: 0x0f, down: true },
      { kind: 'key', scancode: 0x0f, down: false },
      { kind: 'unicode', char: 'b', down: true },
      { kind: 'unicode', char: 'b', down: false },
      { kind: 'key', scancode: 0x1c, down: true },
      { kind: 'key', scancode: 0x1c, down: false },
    ]);
    expect(note).toBe('typed "a\\tb\\n"');
  });

  it('keeps a character outside the basic plane whole', () => {
    const { ops } = plan({ kind: 'type', text: '😀' }, half);
    expect(ops).toEqual([
      { kind: 'unicode', char: '😀', down: true },
      { kind: 'unicode', char: '😀', down: false },
    ]);
  });

  it('pauses briefly every 50 characters of a long text', () => {
    const { ops, note } = plan({ kind: 'type', text: 'x'.repeat(120) }, half);
    const pauses = ops.map((op, index) => ({ op, index })).filter(({ op }) => op.kind === 'pause');
    expect(pauses.map(({ op }) => op)).toEqual([
      { kind: 'pause', ms: 20 },
      { kind: 'pause', ms: 20 },
    ]);
    // After the 50th and the 100th character, each of which is a down and an up.
    expect(pauses.map(({ index }) => index)).toEqual([100, 201]);
    expect(ops.filter((op) => op.kind === 'unicode')).toHaveLength(240);
    expect(note.length).toBeLessThan(80);
  });

  it('does not end a text of exactly 50 characters on a pause', () => {
    const { ops } = plan({ kind: 'type', text: 'y'.repeat(50) }, half);
    expect(ops.at(-1)?.kind).toBe('unicode');
  });

  it('presses a key combo', () => {
    const { ops, note } = plan({ kind: 'key', combo: 'ctrl+s' }, half);
    expect(ops).toEqual([
      { kind: 'key', scancode: 0x1d, down: true },
      { kind: 'key', scancode: 0x1f, down: true },
      { kind: 'key', scancode: 0x1f, down: false },
      { kind: 'key', scancode: 0x1d, down: false },
    ] satisfies RdpInputOp[]);
    expect(note).toBe('pressed ctrl+s');
  });

  it('reports an unknown key instead of guessing', () => {
    expect(actionToInputOps({ kind: 'key', combo: 'ctrl+hyper' }, half)).toEqual({
      error: 'Unknown key in "ctrl+hyper"',
    });
  });

  it('waits with a pause', () => {
    expect(plan({ kind: 'wait', ms: 500 }, half)).toEqual({
      ops: [{ kind: 'pause', ms: 500 }],
      note: 'waited 500 ms',
    });
  });

  it('says when a point was outside the screenshot', () => {
    const { ops, note } = plan({ kind: 'click', x: 5000, y: 20 }, half);
    expect(ops[0]).toEqual({ kind: 'move', x: 1919, y: 40 });
    expect(note).toMatch(/^clicked at \(1919, 40\)/);
    expect(note).toMatch(/outside the screenshot/);
  });

  it('says when a drag end was outside the screenshot', () => {
    const { note } = plan({ kind: 'drag', x1: 0, y1: 0, x2: 2000, y2: 50 }, half);
    expect(note).toMatch(/outside the screenshot/);
  });
});
