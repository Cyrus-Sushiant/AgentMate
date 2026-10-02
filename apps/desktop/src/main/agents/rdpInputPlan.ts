import type { RdpInputOp } from '../../shared/apiTypes';
import type { RdpAction } from './rdpAction';
import { type FrameMapping, toDesktop } from './rdpCoords';
import { comboToOps, scancodeFor } from './rdpKeys';

/** Long enough for Windows to see two clicks, well inside its double-click time. */
const DOUBLE_CLICK_GAP_MS = 60;
/** Moves between the ends of a drag, so apps that track the pointer see it travel. */
const DRAG_STEPS = 10;
/**
 * A window manager only starts moving a window once the button has been held a moment, and drops
 * motion that arrives all at once, so a drag is spread out like a hand would do it.
 */
const DRAG_HOLD_MS = 100;
const DRAG_STEP_PAUSE_MS = 20;
/** A long TYPE goes in chunks with a breather, so a slow remote app doesn't drop keys. */
const TYPE_CHUNK_CHARS = 50;
const TYPE_CHUNK_PAUSE_MS = 20;
/** How much of typed text the outcome note repeats. */
const NOTE_TEXT_CHARS = 40;

const ENTER = scancodeFor('enter') ?? 0x1c;
const TAB = scancodeFor('tab') ?? 0x0f;

type Point = { x: number; y: number };

function at(point: Point): string {
  return `(${point.x}, ${point.y})`;
}

function clampNote(clamped: boolean): string {
  return clamped ? ', moved onto the screen because the point was outside the screenshot' : '';
}

function click(button: 0 | 2): RdpInputOp[] {
  return [
    { kind: 'button', button, down: true },
    { kind: 'button', button, down: false },
  ];
}

function press(scancode: number): RdpInputOp[] {
  return [
    { kind: 'key', scancode, down: true },
    { kind: 'key', scancode, down: false },
  ];
}

function typeOps(text: string): RdpInputOp[] {
  const ops: RdpInputOp[] = [];
  // Array.from splits by code point, so an emoji goes as one character, not two halves.
  const chars = Array.from(text.replace(/\r\n?/g, '\n'));
  chars.forEach((char, index) => {
    if (index > 0 && index % TYPE_CHUNK_CHARS === 0) {
      ops.push({ kind: 'pause', ms: TYPE_CHUNK_PAUSE_MS });
    }
    if (char === '\n') ops.push(...press(ENTER));
    else if (char === '\t') ops.push(...press(TAB));
    else {
      ops.push({ kind: 'unicode', char, down: true }, { kind: 'unicode', char, down: false });
    }
  });
  return ops;
}

function typedNote(text: string): string {
  const shown = text.length > NOTE_TEXT_CHARS ? `${text.slice(0, NOTE_TEXT_CHARS)}…` : text;
  return `typed "${shown.replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
}

/**
 * The low-level input for one AI action, in desktop pixels, plus a short note on what happened for
 * the transcript and history. An error means nothing should be sent at all.
 */
export function actionToInputOps(
  action: RdpAction,
  mapping: FrameMapping,
): { ops: RdpInputOp[]; note: string } | { error: string } {
  switch (action.kind) {
    case 'click':
    case 'double-click':
    case 'right-click':
    case 'move': {
      const { clamped, ...point } = toDesktop(mapping, action.x, action.y);
      const move: RdpInputOp = { kind: 'move', ...point };
      const where = `${at(point)}${clampNote(clamped)}`;
      if (action.kind === 'move') return { ops: [move], note: `moved the pointer to ${where}` };
      if (action.kind === 'right-click') {
        return { ops: [move, ...click(2)], note: `right-clicked at ${where}` };
      }
      if (action.kind === 'double-click') {
        return {
          ops: [move, ...click(0), { kind: 'pause', ms: DOUBLE_CLICK_GAP_MS }, ...click(0)],
          note: `double-clicked at ${where}`,
        };
      }
      return { ops: [move, ...click(0)], note: `clicked at ${where}` };
    }
    case 'drag': {
      const start = toDesktop(mapping, action.x1, action.y1);
      const end = toDesktop(mapping, action.x2, action.y2);
      const moves: RdpInputOp[] = [];
      for (let step = 1; step <= DRAG_STEPS; step++) {
        const t = step / DRAG_STEPS;
        moves.push(
          {
            kind: 'move',
            x: Math.round(start.x + (end.x - start.x) * t),
            y: Math.round(start.y + (end.y - start.y) * t),
          },
          { kind: 'pause', ms: DRAG_STEP_PAUSE_MS },
        );
      }
      return {
        ops: [
          { kind: 'move', x: start.x, y: start.y },
          { kind: 'button', button: 0, down: true },
          { kind: 'pause', ms: DRAG_HOLD_MS },
          ...moves,
          { kind: 'pause', ms: DRAG_HOLD_MS },
          { kind: 'button', button: 0, down: false },
        ],
        note: `dragged from ${at(start)} to ${at(end)}${clampNote(start.clamped || end.clamped)}`,
      };
    }
    case 'scroll': {
      const { clamped, ...point } = toDesktop(mapping, action.x, action.y);
      return {
        ops: [
          { kind: 'move', ...point },
          {
            kind: 'wheel',
            vertical: true,
            amount: action.direction === 'down' ? -action.amount : action.amount,
            unit: 1,
          },
        ],
        note: `scrolled ${action.direction} ${action.amount} at ${at(point)}${clampNote(clamped)}`,
      };
    }
    case 'type':
      return { ops: typeOps(action.text), note: typedNote(action.text) };
    case 'key': {
      const ops = comboToOps(action.combo);
      if (!ops) return { error: `Unknown key in "${action.combo}"` };
      return { ops, note: `pressed ${action.combo}` };
    }
    case 'wait':
      return { ops: [{ kind: 'pause', ms: action.ms }], note: `waited ${action.ms} ms` };
  }
}
