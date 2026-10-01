import { describe, expect, it, vi } from 'vitest';
import { ownedSubscription } from './subscription';

interface Event {
  subscriptionId: string;
  n: number;
}

function harness(start: () => Promise<string>) {
  let emit: (event: Event) => void = () => undefined;
  const off = vi.fn();
  const stop = vi.fn(async () => true);
  const onEvent = vi.fn();
  const onError = vi.fn();
  const onStarted = vi.fn();
  const dispose = ownedSubscription<Event>({
    listen: (callback) => {
      emit = callback;
      return off;
    },
    start,
    stop,
    onEvent,
    onError,
    onStarted,
  });
  return { emit: (event: Event) => emit(event), off, stop, onEvent, onError, onStarted, dispose };
}

describe('ownedSubscription', () => {
  it('holds events that beat the id, then passes on only its own', async () => {
    let answer: (id: string) => void = () => undefined;
    const h = harness(() => new Promise((resolve) => (answer = resolve)));
    h.emit({ subscriptionId: 'mine', n: 1 });
    h.emit({ subscriptionId: 'other', n: 2 });
    expect(h.onEvent).not.toHaveBeenCalled();
    answer('mine');
    await Promise.resolve();
    await Promise.resolve();
    expect(h.onStarted).toHaveBeenCalled();
    h.emit({ subscriptionId: 'mine', n: 3 });
    h.emit({ subscriptionId: 'other', n: 4 });
    expect(h.onEvent.mock.calls.map(([event]) => event.n)).toEqual([1, 3]);

    h.dispose();
    h.emit({ subscriptionId: 'mine', n: 5 });
    expect(h.off).toHaveBeenCalled();
    expect(h.stop).toHaveBeenCalledWith('mine');
    expect(h.onEvent).toHaveBeenCalledTimes(2);
  });

  it('stops a subscription whose id came back after the component left', async () => {
    let answer: (id: string) => void = () => undefined;
    const h = harness(() => new Promise((resolve) => (answer = resolve)));
    h.dispose();
    answer('late');
    await Promise.resolve();
    await Promise.resolve();
    expect(h.stop).toHaveBeenCalledWith('late');
    expect(h.onStarted).not.toHaveBeenCalled();
  });

  it('reports a failed start, unless nobody is listening any more', async () => {
    const h = harness(() => Promise.reject(new Error('down')));
    await vi.waitFor(() => expect(h.onError).toHaveBeenCalled());

    let fail: (error: Error) => void = () => undefined;
    const late = harness(() => new Promise((_, reject) => (fail = reject)));
    late.dispose();
    fail(new Error('down'));
    await Promise.resolve();
    expect(late.onError).not.toHaveBeenCalled();
    expect(late.stop).not.toHaveBeenCalled();
  });
});
