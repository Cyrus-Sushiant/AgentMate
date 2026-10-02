import type { RdpInputOp } from '@shared/apiTypes';
import { describe, expect, it, vi } from 'vitest';
import { Backend, FakeSession } from '../../../../test/renderer/mocks/ironRdp';
import { applyInputOps } from './agentInput';

const backend = Backend as never;

function events(session: FakeSession): unknown[][] {
  return session.transactions.map((tx) => tx.events);
}

describe('applyInputOps', () => {
  it('turns each op into the matching device event, in one transaction', async () => {
    const session = new FakeSession();
    const ops: RdpInputOp[] = [
      { kind: 'move', x: 10, y: 20 },
      { kind: 'button', button: 0, down: true },
      { kind: 'button', button: 0, down: false },
      { kind: 'button', button: 2, down: true },
      { kind: 'key', scancode: 0xe05b, down: true },
      { kind: 'key', scancode: 0xe05b, down: false },
      { kind: 'unicode', char: 'é', down: true },
      { kind: 'unicode', char: 'é', down: false },
      { kind: 'wheel', vertical: true, amount: -3, unit: 1 },
    ];
    await applyInputOps(session as never, backend, ops, vi.fn());

    expect(events(session)).toEqual([
      [
        { type: 'mouseMove', x: 10, y: 20 },
        { type: 'mouseButtonPressed', button: 0 },
        { type: 'mouseButtonReleased', button: 0 },
        { type: 'mouseButtonPressed', button: 2 },
        { type: 'keyPressed', scancode: 0xe05b },
        { type: 'keyReleased', scancode: 0xe05b },
        { type: 'unicodePressed', char: 'é' },
        { type: 'unicodeReleased', char: 'é' },
        { type: 'wheelRotations', vertical: true, amount: -3, unit: 1 },
      ],
    ]);
    expect(session.releasedAll).toBe(0);
  });

  it('starts a new transaction after each pause, and waits in between', async () => {
    const session = new FakeSession();
    const order: string[] = [];
    const sleep = vi.fn(async (ms: number) => {
      order.push(`sleep ${ms} after ${session.transactions.length}`);
    });
    await applyInputOps(
      session as never,
      backend,
      [
        { kind: 'button', button: 0, down: true },
        { kind: 'button', button: 0, down: false },
        { kind: 'pause', ms: 60 },
        { kind: 'button', button: 0, down: true },
        { kind: 'pause', ms: 10 },
        { kind: 'pause', ms: 5 },
        { kind: 'button', button: 0, down: false },
      ],
      sleep,
    );

    expect(events(session)).toEqual([
      [
        { type: 'mouseButtonPressed', button: 0 },
        { type: 'mouseButtonReleased', button: 0 },
      ],
      [{ type: 'mouseButtonPressed', button: 0 }],
      [{ type: 'mouseButtonReleased', button: 0 }],
    ]);
    // Each pause runs after what came before it was sent, and empty stretches send nothing.
    expect(order).toEqual(['sleep 60 after 1', 'sleep 10 after 2', 'sleep 5 after 2']);
  });

  it('sends what came before a releaseAll, then releases everything', async () => {
    const session = new FakeSession();
    await applyInputOps(
      session as never,
      backend,
      [{ kind: 'key', scancode: 0x1d, down: true }, { kind: 'releaseAll' }],
      vi.fn(),
    );
    expect(events(session)).toEqual([[{ type: 'keyPressed', scancode: 0x1d }]]);
    expect(session.releasedAll).toBe(1);
  });

  it('sends nothing for an empty list', async () => {
    const session = new FakeSession();
    await applyInputOps(session as never, backend, [], vi.fn());
    expect(session.transactions).toEqual([]);
  });

  it('releases every held key and button when the session throws, then rethrows', async () => {
    const session = new FakeSession();
    session.applyInputs = () => {
      throw new Error('session closed');
    };
    await expect(
      applyInputOps(
        session as never,
        backend,
        [{ kind: 'key', scancode: 0x2a, down: true }],
        vi.fn(),
      ),
    ).rejects.toThrow('session closed');
    expect(session.releasedAll).toBe(1);
  });

  it('keeps the original error when releasing fails too', async () => {
    const session = new FakeSession();
    session.applyInputs = () => {
      throw new Error('first');
    };
    session.releaseAllInputs = () => {
      throw new Error('second');
    };
    await expect(
      applyInputOps(session as never, backend, [{ kind: 'move', x: 1, y: 1 }], vi.fn()),
    ).rejects.toThrow('first');
  });

  it('waits for real when no sleep is given', async () => {
    vi.useFakeTimers();
    try {
      const session = new FakeSession();
      const done = vi.fn();
      const running = applyInputOps(session as never, backend, [
        { kind: 'pause', ms: 100 },
        { kind: 'move', x: 1, y: 2 },
      ]).then(done);
      await vi.advanceTimersByTimeAsync(99);
      expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await running;
      expect(events(session)).toEqual([[{ type: 'mouseMove', x: 1, y: 2 }]]);
    } finally {
      vi.useRealTimers();
    }
  });
});
