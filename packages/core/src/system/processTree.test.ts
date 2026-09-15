import { describe, expect, it } from 'vitest';
import {
  descendantPids,
  type ProcessRow,
  type ProcessSample,
  parseProcStat,
  summarizeProcessTrees,
} from './processTree.js';

function row(pid: number, ppid: number, cpuTimeSec = 0, memBytes = 0, startedAt?: number) {
  return { pid, ppid, name: `p${pid}`, cpuTimeSec, memBytes, startedAt } satisfies ProcessRow;
}

describe('descendantPids', () => {
  it('walks nested children', () => {
    const rows = [row(1, 0), row(10, 1), row(11, 10), row(12, 10), row(20, 2)];
    expect(descendantPids(1, rows)).toEqual([1, 10, 11, 12]);
  });

  it('returns nothing for a missing root', () => {
    expect(descendantPids(99, [row(1, 0)])).toEqual([]);
  });

  it('survives parent cycles', () => {
    const rows = [row(1, 3), row(2, 1), row(3, 2)];
    expect(descendantPids(1, rows).sort()).toEqual([1, 2, 3]);
  });

  it('skips orphans older than a process that reused their parent pid', () => {
    const rows = [row(1, 0, 0, 0, 500), row(2, 1, 0, 0, 100), row(3, 1, 0, 0, 900)];
    expect(descendantPids(1, rows)).toEqual([1, 3]);
  });
});

describe('summarizeProcessTrees', () => {
  const previous: ProcessSample = {
    at: 0,
    processes: [row(1, 0, 10, 100), row(10, 1, 20, 1000)],
  };
  const current: ProcessSample = {
    at: 2000,
    processes: [row(1, 0, 10.5, 100), row(10, 1, 22, 1000), row(11, 10, 1, 50)],
  };

  it('sums CPU from the time delta and memory across the tree', () => {
    const usage = summarizeProcessTrees([1], current, previous, { cpuCount: 2 }).get(1);
    // Root: 0.5s over 2s on 2 cores = 12.5%. Child: 2s over 2s on 2 cores = 50%. New child: 0.
    expect(usage?.cpuPercent).toBeCloseTo(62.5);
    expect(usage?.memBytes).toBe(1150);
    expect(usage?.processCount).toBe(3);
    expect(usage?.processes[0]?.pid).toBe(10);
  });

  it('reports zero CPU without a previous sample', () => {
    const usage = summarizeProcessTrees([1], current, null, { cpuCount: 2 }).get(1);
    expect(usage?.cpuPercent).toBe(0);
    expect(usage?.memBytes).toBe(1150);
  });

  it('passes rates through when the platform reports them', () => {
    const rates: ProcessSample = { at: 0, processes: [row(1, 0, 3, 10), row(2, 1, 4, 10)] };
    const usage = summarizeProcessTrees([1], rates, null, { cpuCount: 8, cpuIsRate: true }).get(1);
    expect(usage?.cpuPercent).toBe(7);
  });

  it('marks roots that are gone', () => {
    const usage = summarizeProcessTrees([42], current, previous, { cpuCount: 1 }).get(42);
    expect(usage).toMatchObject({ found: false, cpuPercent: 0, memBytes: 0, processCount: 0 });
  });

  it('caps the process list but not the totals', () => {
    const usage = summarizeProcessTrees([1], current, previous, {
      cpuCount: 2,
      maxProcesses: 1,
    }).get(1);
    expect(usage?.processes).toHaveLength(1);
    expect(usage?.processCount).toBe(3);
  });
});

describe('parseProcStat', () => {
  it('reads pid, ppid, cpu time, start time and rss', () => {
    const raw =
      '1234 (node (worker) x) S 1200 1234 1234 0 -1 4194304 100 0 0 0 250 50 0 0 20 0 11 0 777 1000000 2048 18446744073709551615';
    expect(parseProcStat(raw)).toEqual({
      pid: 1234,
      ppid: 1200,
      name: 'node (worker) x',
      cpuTimeSec: 3,
      memBytes: 2048 * 4096,
      startedAt: 777,
    });
  });

  it('rejects malformed lines', () => {
    expect(parseProcStat('garbage')).toBeNull();
  });
});
