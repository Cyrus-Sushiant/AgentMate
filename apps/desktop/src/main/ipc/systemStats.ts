import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';
import type { SystemStatsSample } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';

const execFileAsync = promisify(execFile);

const PING_HOST = '1.1.1.1';

interface CpuSnapshot {
  idle: number;
  total: number;
}

function readCpuSnapshot(): CpuSnapshot {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

let lastCpuSnapshot: CpuSnapshot | null = null;

// Instantaneous CPU load isn't exposed by Node — only cumulative per-core
// tick counters — so usage is derived from the delta between consecutive
// samples (same technique top/htop use).
function sampleCpuPercent(): number {
  const snapshot = readCpuSnapshot();
  const previous = lastCpuSnapshot;
  lastCpuSnapshot = snapshot;
  if (!previous) return 0;

  const idleDelta = snapshot.idle - previous.idle;
  const totalDelta = snapshot.total - previous.total;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - idleDelta / totalDelta)));
}

function sampleMemory(): Pick<SystemStatsSample, 'memPercent' | 'memUsedBytes' | 'memTotalBytes'> {
  const memTotalBytes = os.totalmem();
  const memUsedBytes = memTotalBytes - os.freemem();
  return {
    memPercent: (memUsedBytes / memTotalBytes) * 100,
    memUsedBytes,
    memTotalBytes,
  };
}

interface NetTotals {
  rxBytes: number;
  txBytes: number;
}

// Node has no cross-platform network byte-counter API, so totals are read
// from the same OS-native sources the platform's own tools use.
async function readNetTotals(): Promise<NetTotals> {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('netstat', ['-e']);
    const match = stdout.match(/Bytes\s+(\d+)\s+(\d+)/);
    if (!match) return { rxBytes: 0, txBytes: 0 };
    return { rxBytes: Number(match[1]), txBytes: Number(match[2]) };
  }

  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('netstat', ['-ib']);
    let rxBytes = 0;
    let txBytes = 0;
    const seen = new Set<string>();
    for (const line of stdout.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 10) continue;
      const name = cols[0];
      if (name === 'lo0' || seen.has(name)) continue;
      seen.add(name);
      const ibytes = Number(cols[6]);
      const obytes = Number(cols[9]);
      if (Number.isFinite(ibytes)) rxBytes += ibytes;
      if (Number.isFinite(obytes)) txBytes += obytes;
    }
    return { rxBytes, txBytes };
  }

  const data = await readFile('/proc/net/dev', 'utf-8');
  let rxBytes = 0;
  let txBytes = 0;
  for (const line of data.split('\n').slice(2)) {
    const [ifacePart, rest] = line.split(':');
    if (!ifacePart || !rest) continue;
    if (ifacePart.trim() === 'lo') continue;
    const fields = rest.trim().split(/\s+/).map(Number);
    rxBytes += fields[0] ?? 0;
    txBytes += fields[8] ?? 0;
  }
  return { rxBytes, txBytes };
}

interface NetSnapshot extends NetTotals {
  timestamp: number;
}

let lastNetSnapshot: NetSnapshot | null = null;

async function sampleNetworkRates(): Promise<
  Pick<SystemStatsSample, 'netRxBytesPerSec' | 'netTxBytesPerSec'>
> {
  const totals = await readNetTotals();
  const timestamp = Date.now();
  const previous = lastNetSnapshot;
  lastNetSnapshot = { ...totals, timestamp };
  if (!previous) return { netRxBytesPerSec: 0, netTxBytesPerSec: 0 };

  const elapsedSec = (timestamp - previous.timestamp) / 1000;
  if (elapsedSec <= 0) return { netRxBytesPerSec: 0, netTxBytesPerSec: 0 };

  return {
    // Counters can dip on interface resets; clamp instead of showing a
    // negative rate.
    netRxBytesPerSec: Math.max(0, (totals.rxBytes - previous.rxBytes) / elapsedSec),
    netTxBytesPerSec: Math.max(0, (totals.txBytes - previous.txBytes) / elapsedSec),
  };
}

async function pingHost(host: string): Promise<Pick<SystemStatsSample, 'pingMs' | 'pingAlive'>> {
  const isWin = process.platform === 'win32';
  const args = isWin ? ['-n', '1', '-w', '1500', host] : ['-c', '1', '-W', '2', host];
  try {
    const { stdout } = await execFileAsync('ping', args, { timeout: 3000 });
    const match = isWin
      ? stdout.match(/time[=<](\d+)ms/i)
      : stdout.match(/time=([\d.]+)\s*ms/i);
    if (!match) return { pingMs: null, pingAlive: false };
    return { pingMs: Math.round(Number(match[1])), pingAlive: true };
  } catch {
    return { pingMs: null, pingAlive: false };
  }
}

export function registerSystemStatsHandlers(): void {
  ipcMain.handle(IPC.system.sample, async (): Promise<SystemStatsSample> => {
    const [net, ping] = await Promise.all([sampleNetworkRates(), pingHost(PING_HOST)]);
    return {
      timestamp: Date.now(),
      cpuPercent: sampleCpuPercent(),
      ...sampleMemory(),
      ...net,
      ...ping,
    };
  });
}
