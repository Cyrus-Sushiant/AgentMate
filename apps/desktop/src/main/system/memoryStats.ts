import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import type { SystemStatsSample } from '../../shared/apiTypes';

const execFileAsync = promisify(execFile);

type MemorySample = Pick<SystemStatsSample, 'memPercent' | 'memUsedBytes' | 'memTotalBytes'>;

function toSample(memUsedBytes: number, memTotalBytes: number): MemorySample {
  const used = Math.max(0, Math.min(memTotalBytes, memUsedBytes));
  return {
    memPercent: memTotalBytes > 0 ? (used / memTotalBytes) * 100 : 0,
    memUsedBytes: used,
    memTotalBytes,
  };
}

// `vm_stat` prints page counters plus the page size in its header:
//
//   Mach Virtual Memory Statistics: (page size of 16384 bytes)
//   Pages free:                                3452.
//   Pages wired down:                         78012.
//   Anonymous pages:                         236935.
//   Pages occupied by compressor:            152139.
export function parseVmStat(stdout: string): { pageSize: number; pages: Record<string, number> } {
  const pageSize = Number(stdout.match(/page size of (\d+) bytes/)?.[1] ?? 4096);
  const pages: Record<string, number> = {};
  for (const [, key, value] of stdout.matchAll(/^"?([^":\n]+)"?:\s+(\d+)\.?\s*$/gm)) {
    pages[key.trim()] = Number(value);
  }
  return { pageSize, pages };
}

/**
 * "Memory Used" the way Activity Monitor counts it: App Memory (anonymous pages minus purgeable
 * ones) + Wired + Compressed. File cache is left out because macOS hands it back on demand. Returns
 * null when a counter is missing, so the caller can fall back.
 */
export function macUsedBytesFromVmStat(stdout: string): number | null {
  const { pageSize, pages } = parseVmStat(stdout);
  const anonymous = pages['Anonymous pages'];
  const wired = pages['Pages wired down'];
  const compressed = pages['Pages occupied by compressor'];
  if (![anonymous, wired, compressed].every(Number.isFinite)) return null;
  const appPages = Math.max(0, anonymous - (pages['Pages purgeable'] ?? 0));
  return (appPages + wired + compressed) * pageSize;
}

// os.freemem() on macOS is only the kernel's "Pages free", which the OS keeps close to zero by
// filling spare RAM with file cache. total - freemem() therefore sat at ~100% on every Mac, even
// with plenty of memory to spare. Windows and Linux report available memory there, so it is fine.
export async function sampleMemory(): Promise<MemorySample> {
  const memTotalBytes = os.totalmem();
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync('/usr/bin/vm_stat', [], { timeout: 2000 });
      const used = macUsedBytesFromVmStat(stdout);
      if (used != null) return toSample(used, memTotalBytes);
    } catch {
      // Fall through to the generic reading below.
    }
  }
  return toSample(memTotalBytes - os.freemem(), memTotalBytes);
}
