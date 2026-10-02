import type { RdpInputOp } from '@shared/apiTypes';

/**
 * The parts of the engine's session and backend that sending input needs. The real
 * `RdpSession` and `RdpBackend` from ./ironRdp fit these, and tests can pass small fakes.
 */
export interface InputSession {
  applyInputs(transaction: unknown): void;
  releaseAllInputs(): void;
}

export interface InputBackend {
  InputTransaction: new () => { addEvent(event: unknown): void };
  DeviceEvent: {
    mouseMove(x: number, y: number): unknown;
    mouseButtonPressed(button: number): unknown;
    mouseButtonReleased(button: number): unknown;
    keyPressed(scancode: number): unknown;
    keyReleased(scancode: number): unknown;
    unicodePressed(char: string): unknown;
    unicodeReleased(char: string): unknown;
    wheelRotations(vertical: boolean, amount: number, unit: number): unknown;
  };
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type DeviceOp = Exclude<RdpInputOp, { kind: 'pause' } | { kind: 'releaseAll' }>;

function deviceEvent(backend: InputBackend, op: DeviceOp): unknown {
  const events = backend.DeviceEvent;
  switch (op.kind) {
    case 'move':
      return events.mouseMove(op.x, op.y);
    case 'button':
      return op.down ? events.mouseButtonPressed(op.button) : events.mouseButtonReleased(op.button);
    case 'key':
      return op.down ? events.keyPressed(op.scancode) : events.keyReleased(op.scancode);
    case 'unicode':
      return op.down ? events.unicodePressed(op.char) : events.unicodeReleased(op.char);
    case 'wheel':
      return events.wheelRotations(op.vertical, op.amount, op.unit);
  }
}

/**
 * Plays input from the AI task on the remote desktop. Ops between two pauses go out as one
 * transaction, so a click lands as a unit, and a pause really waits before the next stretch.
 * If anything fails partway, every held key and button is let go before the error is passed on,
 * so the remote side isn't left with Ctrl or the mouse button stuck down.
 */
export async function applyInputOps(
  session: InputSession,
  backend: InputBackend,
  ops: RdpInputOp[],
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<void> {
  let pending: DeviceOp[] = [];
  const flush = (): void => {
    if (pending.length === 0) return;
    const transaction = new backend.InputTransaction();
    for (const op of pending) transaction.addEvent(deviceEvent(backend, op));
    pending = [];
    session.applyInputs(transaction);
  };

  try {
    for (const op of ops) {
      if (op.kind === 'pause') {
        flush();
        await sleep(op.ms);
      } else if (op.kind === 'releaseAll') {
        flush();
        session.releaseAllInputs();
      } else {
        pending.push(op);
      }
    }
    flush();
  } catch (error) {
    try {
      session.releaseAllInputs();
    } catch {
      // The session is likely gone already; the first error says why.
    }
    throw error;
  }
}
