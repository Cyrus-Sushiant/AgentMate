import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingRequests } from './pendingRequests';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createPendingRequests', () => {
  it('resolves with the value a settle carries', async () => {
    const pending = createPendingRequests();
    let sentId = '';
    const result = pending.request<number>(
      'session-1',
      (id) => {
        sentId = id;
      },
      1000,
    );
    expect(pending.settle(sentId, { ok: true, value: 42 })).toBe(true);
    await expect(result).resolves.toBe(42);
  });

  it('rejects with the error a failed settle carries', async () => {
    const pending = createPendingRequests();
    let sentId = '';
    const result = pending.request(
      'session-1',
      (id) => {
        sentId = id;
      },
      1000,
    );
    pending.settle(sentId, { ok: false, error: 'not connected' });
    await expect(result).rejects.toThrow('not connected');
  });

  it('rejects once the timeout passes without an answer', async () => {
    const pending = createPendingRequests();
    const result = pending.request('session-1', () => undefined, 1000);
    const caught = result.catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(999);
    expect(pending.size()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(((await caught) as Error).message).toMatch(/did not answer/);
    expect(pending.size()).toBe(0);
  });

  it('ignores a settle that arrives after the timeout', async () => {
    const pending = createPendingRequests();
    let sentId = '';
    const result = pending
      .request(
        'session-1',
        (id) => {
          sentId = id;
        },
        100,
      )
      .catch(() => undefined);
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(pending.settle(sentId, { ok: true, value: 1 })).toBe(false);
  });

  it('returns false for an id it never issued', () => {
    const pending = createPendingRequests();
    expect(pending.settle('nope', { ok: true, value: 1 })).toBe(false);
  });

  it('rejectAll only rejects the requests for that key', async () => {
    const pending = createPendingRequests();
    const ids: string[] = [];
    const first = pending.request('session-1', (id) => ids.push(id), 1000);
    const second = pending.request('session-2', (id) => ids.push(id), 1000);
    const firstCaught = first.catch((error: Error) => error);

    pending.rejectAll('session-1', 'The window closed.');
    expect(((await firstCaught) as Error).message).toBe('The window closed.');

    expect(pending.settle(ids[1] ?? '', { ok: true, value: 'still here' })).toBe(true);
    await expect(second).resolves.toBe('still here');
  });

  it('gives every request its own id', () => {
    const pending = createPendingRequests();
    const ids = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      void pending.request('session-1', (id) => ids.add(id), 1000).catch(() => undefined);
    }
    expect(ids.size).toBe(20);
    pending.rejectAll('session-1', 'done');
  });

  it('knows which key a pending request belongs to', () => {
    const pending = createPendingRequests();
    let sentId = '';
    void pending
      .request(
        'session-7',
        (id) => {
          sentId = id;
        },
        1000,
      )
      .catch(() => undefined);
    expect(pending.keyOf(sentId)).toBe('session-7');
    expect(pending.keyOf('other')).toBeNull();
    pending.rejectAll('session-7', 'done');
  });

  it('rejects at once when sending throws', async () => {
    const pending = createPendingRequests();
    const result = pending.request(
      'session-1',
      () => {
        throw new Error('The Remote Desktop window is closed.');
      },
      1000,
    );
    await expect(result).rejects.toThrow('The Remote Desktop window is closed.');
    expect(pending.size()).toBe(0);
  });
});
