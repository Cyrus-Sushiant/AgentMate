import os from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withPlatform } from '../../test/main/fixtures';

/**
 * The RAM chart read ~100% all the time on a 16 GB Mac mini M4, because used memory was
 * total - os.freemem() and macOS keeps "Pages free" near zero on purpose (spare RAM holds file
 * cache). These tests pin down the Activity Monitor style reading from `vm_stat`.
 */

type Answer = { stdout: string } | { error: Error };

const answers = vi.hoisted(() => ({ vmStat: null as Answer | null }));

vi.mock('node:child_process', () => ({
  execFile: (_command: string, _args: string[], ...rest: unknown[]) => {
    const callback = rest.at(-1) as (
      error: Error | null,
      result?: { stdout: string; stderr: string },
    ) => void;
    const answer = answers.vmStat;
    if (!answer) callback(Object.assign(new Error('spawn vm_stat ENOENT'), { code: 'ENOENT' }));
    else if ('error' in answer) callback(answer.error);
    else callback(null, { stdout: answer.stdout, stderr: '' });
  },
}));

const { macUsedBytesFromVmStat, parseVmStat, sampleMemory } = await import('./memoryStats');

const GIB = 1024 ** 3;
const PAGE = 16384;

// `vm_stat` on a 16 GB Apple Silicon Mac with a busy file cache: only ~54 MB is "free".
const M4_VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                3452.
Pages active:                            420000.
Pages inactive:                          410000.
Pages speculative:                         2943.
Pages throttled:                              0.
Pages wired down:                         120000.
Pages purgeable:                           5000.
"Translation faults":                 1126370549.
Pages copy-on-write:                   36389183.
Pages zero filled:                    491934584.
Pages reactivated:                      8227958.
Pages purged:                           2003399.
File-backed pages:                       432943.
Anonymous pages:                         400000.
Pages stored in compressor:              300000.
Pages occupied by compressor:            100000.
Decompressions:                         9372466.
Compressions:                          14857394.
Pageins:                               48394651.
Pageouts:                                 72811.
Swapins:                                      0.
Swapouts:                                     0.
`;

describe('parseVmStat', () => {
  it('reads the page size and every counter, quoted names included', () => {
    const { pageSize, pages } = parseVmStat(M4_VM_STAT);
    expect(pageSize).toBe(PAGE);
    expect(pages['Pages free']).toBe(3452);
    expect(pages['Anonymous pages']).toBe(400000);
    expect(pages['Translation faults']).toBe(1126370549);
  });
});

describe('macUsedBytesFromVmStat', () => {
  it('counts app memory, wired and compressed, not file cache', () => {
    // (400000 anonymous - 5000 purgeable) + 120000 wired + 100000 compressed
    expect(macUsedBytesFromVmStat(M4_VM_STAT)).toBe(615000 * PAGE);
  });

  it('gives up when a counter it needs is missing', () => {
    expect(macUsedBytesFromVmStat('Pages free: 10.\n')).toBeNull();
  });
});

describe('sampleMemory', () => {
  beforeEach(() => {
    answers.vmStat = null;
    vi.restoreAllMocks();
  });

  it('reports a Mac with a full file cache as about 59% used, not 100%', async () => {
    vi.spyOn(os, 'totalmem').mockReturnValue(16 * GIB);
    vi.spyOn(os, 'freemem').mockReturnValue(3452 * PAGE);
    answers.vmStat = { stdout: M4_VM_STAT };
    const sample = await withPlatform('darwin', () => sampleMemory());
    expect(sample.memUsedBytes).toBe(615000 * PAGE);
    expect(sample.memTotalBytes).toBe(16 * GIB);
    expect(sample.memPercent).toBeCloseTo(58.65, 1);
  });

  it('falls back to os.freemem() when vm_stat fails', async () => {
    vi.spyOn(os, 'totalmem').mockReturnValue(16 * GIB);
    vi.spyOn(os, 'freemem').mockReturnValue(4 * GIB);
    answers.vmStat = { error: new Error('boom') };
    const sample = await withPlatform('darwin', () => sampleMemory());
    expect(sample.memUsedBytes).toBe(12 * GIB);
    expect(sample.memPercent).toBe(75);
  });

  it('keeps using os.freemem() off macOS', async () => {
    vi.spyOn(os, 'totalmem').mockReturnValue(32 * GIB);
    vi.spyOn(os, 'freemem').mockReturnValue(24 * GIB);
    answers.vmStat = { stdout: M4_VM_STAT };
    const sample = await withPlatform('win32', () => sampleMemory());
    expect(sample.memUsedBytes).toBe(8 * GIB);
    expect(sample.memPercent).toBe(25);
  });
});
