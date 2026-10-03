import { constants } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boostHoldMs, createPasteBoost, type ProcessPriority } from './pasteBoost';

const NORMAL = constants.priority.PRIORITY_NORMAL;
const RAISED = constants.priority.PRIORITY_ABOVE_NORMAL;
const HIGH = constants.priority.PRIORITY_HIGH;
const BELOW = constants.priority.PRIORITY_BELOW_NORMAL;

/** A process table in memory: pid to priority, where a missing pid has exited. */
function fakePriority(initial: Record<number, number>): ProcessPriority & {
  table: Map<number, number>;
  sets: [number, number][];
} {
  const table = new Map(Object.entries(initial).map(([pid, value]) => [Number(pid), value]));
  const sets: [number, number][] = [];
  const gone = (pid: number): Error =>
    Object.assign(new Error(`no such process ${pid}`), { code: 'ESRCH' });
  return {
    table,
    sets,
    get(pid) {
      const value = table.get(pid);
      if (value === undefined) throw gone(pid);
      return value;
    },
    set(pid, value) {
      if (!table.has(pid)) throw gone(pid);
      table.set(pid, value);
      sets.push([pid, value]);
    },
  };
}

/** Lets the boost's lookups resolve and apply. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('boostHoldMs', () => {
  it('scales with the paste and stays bounded', () => {
    expect(boostHoldMs(512)).toBe(11_000);
    expect(boostHoldMs(200_000)).toBe(30_000);
    expect(boostHoldMs(50_000_000)).toBe(120_000);
  });
});

describe('createPasteBoost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('raises conhost and every console client, then puts them back', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: NORMAL, 21: NORMAL });
    const boost = createPasteBoost({ priority, consoleHosts: async () => [10] });

    boost.boost('s1', async () => [20, 21], 20_000);
    await settle();

    // The stall only clears with both sides raised: conhost and the program reading from it.
    expect(priority.table.get(10)).toBe(RAISED);
    expect(priority.table.get(20)).toBe(RAISED);
    expect(priority.table.get(21)).toBe(RAISED);

    vi.advanceTimersByTime(boostHoldMs(20_000) - 1);
    expect(priority.table.get(20)).toBe(RAISED);

    vi.advanceTimersByTime(1);
    expect(priority.table.get(10)).toBe(NORMAL);
    expect(priority.table.get(20)).toBe(NORMAL);
    expect(priority.table.get(21)).toBe(NORMAL);
  });

  it('restores the priority each process had before', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: BELOW });
    const boost = createPasteBoost({ priority, consoleHosts: async () => [10] });

    boost.boost('s1', async () => [20], 1_000);
    await settle();
    expect(priority.table.get(20)).toBe(RAISED);

    vi.runAllTimers();
    expect(priority.table.get(20)).toBe(BELOW);
  });

  it('leaves a process that is already raised or higher alone', async () => {
    const priority = fakePriority({ 10: RAISED, 20: HIGH });
    const boost = createPasteBoost({ priority, consoleHosts: async () => [10] });

    boost.boost('s1', async () => [20], 1_000);
    await settle();
    vi.runAllTimers();

    expect(priority.sets).toEqual([]);
    expect(priority.table.get(10)).toBe(RAISED);
    expect(priority.table.get(20)).toBe(HIGH);
  });

  it('does not undo a priority someone else changed during the hold', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: NORMAL });
    const boost = createPasteBoost({ priority, consoleHosts: async () => [10] });

    boost.boost('s1', async () => [20], 1_000);
    await settle();
    priority.table.set(20, HIGH);
    vi.runAllTimers();

    expect(priority.table.get(20)).toBe(HIGH);
    expect(priority.table.get(10)).toBe(NORMAL);
  });

  it('a second paste extends the hold', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: NORMAL });
    const boost = createPasteBoost({ priority, consoleHosts: async () => [10] });

    boost.boost('s1', async () => [20], 1_000);
    await settle();
    vi.advanceTimersByTime(boostHoldMs(1_000) - 1_000);
    boost.boost('s1', async () => [20], 1_000);
    await settle();

    vi.advanceTimersByTime(1_000);
    expect(priority.table.get(20)).toBe(RAISED);
    vi.advanceTimersByTime(boostHoldMs(1_000));
    expect(priority.table.get(20)).toBe(NORMAL);
  });

  it('runs one lookup per session at a time, keeping the longest hold asked for', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: NORMAL });
    let release: (pids: number[]) => void = () => undefined;
    const clients = vi.fn(
      () =>
        new Promise<number[]>((resolve) => {
          release = resolve;
        }),
    );
    const boost = createPasteBoost({ priority, consoleHosts: async () => [10] });

    boost.boost('s1', clients, 1_000);
    boost.boost('s1', clients, 500_000);
    expect(clients).toHaveBeenCalledTimes(1);

    release([20]);
    await settle();
    vi.advanceTimersByTime(boostHoldMs(1_000));
    expect(priority.table.get(20)).toBe(RAISED);
    vi.advanceTimersByTime(boostHoldMs(500_000));
    expect(priority.table.get(20)).toBe(NORMAL);
  });

  it('raises the clients without waiting for a slow conhost lookup', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: NORMAL });
    let releaseHosts: (pids: number[]) => void = () => undefined;
    const boost = createPasteBoost({
      priority,
      consoleHosts: () =>
        new Promise((resolve) => {
          releaseHosts = resolve;
        }),
    });

    boost.boost('s1', async () => [20], 1_000);
    await settle();
    expect(priority.table.get(20)).toBe(RAISED);
    expect(priority.table.get(10)).toBe(NORMAL);

    releaseHosts([10]);
    await settle();
    expect(priority.table.get(10)).toBe(RAISED);
  });

  it('caches the conhost list until the consoles change', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: NORMAL });
    const consoleHosts = vi.fn(async () => [10]);
    const boost = createPasteBoost({ priority, consoleHosts });

    boost.boost('s1', async () => [20], 1_000);
    await settle();
    boost.boost('s2', async () => [20], 1_000);
    await settle();
    expect(consoleHosts).toHaveBeenCalledTimes(1);

    boost.consolesChanged();
    boost.boost('s1', async () => [20], 1_000);
    await settle();
    expect(consoleHosts).toHaveBeenCalledTimes(2);
  });

  it('looks for conhost again after a lookup that found nothing', async () => {
    const priority = fakePriority({ 10: NORMAL });
    const consoleHosts = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([10]);
    const boost = createPasteBoost({ priority, consoleHosts });

    boost.boost('s1', async () => [], 1_000);
    await settle();
    boost.boost('s1', async () => [], 1_000);
    await settle();

    expect(consoleHosts).toHaveBeenCalledTimes(2);
    expect(priority.table.get(10)).toBe(RAISED);
  });

  it('shrugs off processes that exit and lookups that fail', async () => {
    const priority = fakePriority({ 20: NORMAL });
    const boost = createPasteBoost({
      priority,
      consoleHosts: () => Promise.reject(new Error('powershell missing')),
    });

    // 30 exited between the lookup and the raise.
    boost.boost('s1', async () => [20, 30], 1_000);
    await settle();
    expect(priority.table.get(20)).toBe(RAISED);

    priority.table.delete(20);
    expect(() => vi.runAllTimers()).not.toThrow();

    boost.boost('s2', () => Promise.reject(new Error('fork failed')), 1_000);
    await settle();
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('dispose restores everything at once', async () => {
    const priority = fakePriority({ 10: NORMAL, 20: NORMAL });
    const boost = createPasteBoost({ priority, consoleHosts: async () => [10] });

    boost.boost('s1', async () => [20], 1_000);
    await settle();
    boost.dispose();

    expect(priority.table.get(10)).toBe(NORMAL);
    expect(priority.table.get(20)).toBe(NORMAL);
    expect(vi.getTimerCount()).toBe(0);
  });
});
