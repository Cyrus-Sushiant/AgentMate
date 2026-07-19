import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';
import type { DiskUsage, GpuUsage, PingResult, SystemStatsSample } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { store } from '../store';

const execFileAsync = promisify(execFile);

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

interface DiskIoSnapshot {
  readBytes: number;
  writeBytes: number;
  timestamp: number;
}

let lastDiskIoSnapshots = new Map<string, DiskIoSnapshot>();

// Enumerates every physical disk's live read/write throughput (not capacity)
// so the dashboard can chart I/O activity for all of them at once.
async function sampleDisks(): Promise<DiskUsage[]> {
  try {
    if (process.platform === 'win32') {
      // PhysicalDisk (not LogicalDisk) — a single physical disk can host
      // several drive letters, and I/O activity happens on the physical
      // spindle/SSD, not the logical volume. This WMI class already reports
      // a rolling per-second rate, no manual delta needed.
      const { stdout } = await execFileAsync('powershell', [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Select-Object Name,DiskReadBytesPersec,DiskWriteBytesPersec | ConvertTo-Json',
      ]);
      const parsed = JSON.parse(stdout) as
        | { Name: string; DiskReadBytesPersec: number | null; DiskWriteBytesPersec: number | null }
        | { Name: string; DiskReadBytesPersec: number | null; DiskWriteBytesPersec: number | null }[];
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows
        // "_Total" is the aggregate row across all disks — each disk is already listed on its own.
        .filter((r) => r.Name !== '_Total')
        .map((r) => {
          // Instance names look like "0 C:" or "1 D: E:" — index followed by
          // the drive letter(s) that live on that physical disk.
          const index = r.Name.match(/^\d+/)?.[0];
          return {
            id: r.Name,
            label: index ? `Disk ${index}` : r.Name,
            readBytesPerSec: r.DiskReadBytesPersec ?? 0,
            writeBytesPerSec: r.DiskWriteBytesPersec ?? 0,
          };
        });
    }

    if (process.platform === 'linux') {
      const data = await readFile('/proc/diskstats', 'utf-8');
      const timestamp = Date.now();
      const previous = lastDiskIoSnapshots;
      const next = new Map<string, DiskIoSnapshot>();
      const results: DiskUsage[] = [];
      for (const line of data.split('\n')) {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 14) continue;
        const name = cols[2];
        // Whole disks only (sda, nvme0n1, vda…) — skips partitions, loop and ram devices.
        if (!/^(sd[a-z]+|nvme\d+n\d+|vd[a-z]+|xvd[a-z]+|hd[a-z]+)$/.test(name)) continue;
        const readBytes = Number(cols[5]) * 512;
        const writeBytes = Number(cols[9]) * 512;
        next.set(name, { readBytes, writeBytes, timestamp });
        const prev = previous.get(name);
        if (!prev) continue;
        const elapsedSec = (timestamp - prev.timestamp) / 1000;
        if (elapsedSec <= 0) continue;
        results.push({
          id: name,
          label: name,
          readBytesPerSec: Math.max(0, (readBytes - prev.readBytes) / elapsedSec),
          writeBytesPerSec: Math.max(0, (writeBytes - prev.writeBytes) / elapsedSec),
        });
      }
      lastDiskIoSnapshots = next;
      return results;
    }

    if (process.platform === 'darwin') {
      // `-w 1` waits 1s between the two samples so the second one reflects a
      // real interval; macOS iostat only reports combined throughput per
      // disk, not a read/write split.
      const { stdout } = await execFileAsync('iostat', ['-d', '-c', '2', '-w', '1']);
      const lines = stdout.trim().split('\n');
      if (lines.length < 4) return [];
      const diskNames = lines[0].trim().split(/\s+/);
      const lastRow = (lines.at(-1) ?? '').trim().split(/\s+/).map(Number);
      const results: DiskUsage[] = [];
      diskNames.forEach((name, i) => {
        const mbPerSec = lastRow[i * 3 + 2];
        if (!Number.isFinite(mbPerSec)) return;
        results.push({
          id: name,
          label: name,
          readBytesPerSec: mbPerSec * 1024 * 1024,
          writeBytesPerSec: 0,
        });
      });
      return results;
    }

    return [];
  } catch {
    return [];
  }
}

async function sampleNvidiaGpus(): Promise<GpuUsage[]> {
  try {
    // NVIDIA is the only vendor that exposes live utilization through a
    // standard CLI; other vendors are covered separately (Windows only)
    // by sampleOtherGpu below.
    const { stdout } = await execFileAsync('nvidia-smi', [
      '--query-gpu=index,name,utilization.gpu,memory.used,memory.total',
      '--format=csv,noheader,nounits',
    ]);
    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [index, name, util, memUsed, memTotal] = line.split(',').map((v) => v.trim());
        return {
          id: `nvidia-${index}`,
          label: name,
          percent: Number(util),
          memUsedBytes: Number(memUsed) * 1024 * 1024,
          memTotalBytes: Number(memTotal) * 1024 * 1024,
        };
      })
      .filter((g) => Number.isFinite(g.percent));
  } catch {
    return [];
  }
}

// Best-effort coverage for the non-NVIDIA GPU (typically a laptop's
// integrated Intel/AMD chip) using Windows' GPU performance counters.
// Windows has no safe/simple way to attribute a specific "GPU Engine"
// counter instance to a specific physical adapter (that requires DXGI's
// IDXGIAdapter::GetDesc via native COM interop), so this reports the
// busiest engine across the whole system as this GPU's usage. It's
// usually accurate, but can occasionally reflect the NVIDIA GPU's load
// instead when that GPU is the one actually busy (e.g. during gaming).
const OTHER_GPU_SCRIPT = `
$others = Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterCompatibility -notmatch 'NVIDIA' -and $_.Name -notmatch 'NVIDIA' }
if (-not $others) { Write-Output '[]'; exit }
$engine = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue
$busiest = 0
if ($engine) {
  $groups = $engine | Group-Object { $_.Name -replace '^pid_\\d+_', '' }
  foreach ($g in $groups) {
    $sum = ($g.Group | Measure-Object -Property UtilizationPercentage -Sum).Sum
    if ($sum -gt $busiest) { $busiest = $sum }
  }
}
$mem = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory -ErrorAction SilentlyContinue
$memUsed = 0
if ($mem) { $memUsed = ($mem | Measure-Object -Property SharedUsage -Maximum).Maximum }
$c = $others | Select-Object -First 1
[PSCustomObject]@{ name = $c.Name; ram = [int64]$c.AdapterRAM; percent = [math]::Round($busiest, 1); memUsed = [int64]$memUsed } | ConvertTo-Json -Compress
`;

async function sampleOtherGpu(): Promise<GpuUsage[]> {
  if (process.platform !== 'win32') return [];
  try {
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', OTHER_GPU_SCRIPT]);
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === '[]') return [];
    const parsed = JSON.parse(trimmed) as { name: string; ram: number; percent: number; memUsed: number };
    return [
      {
        id: 'other-gpu',
        label: parsed.name,
        percent: Math.max(0, Math.min(100, parsed.percent)),
        memUsedBytes: parsed.memUsed,
        memTotalBytes: parsed.ram > 0 ? parsed.ram : parsed.memUsed,
      },
    ];
  } catch {
    return [];
  }
}

async function sampleGpus(): Promise<GpuUsage[]> {
  const [nvidia, other] = await Promise.all([sampleNvidiaGpus(), sampleOtherGpu()]);
  return [...nvidia, ...other];
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

async function pingHost(host: string): Promise<PingResult> {
  const isWin = process.platform === 'win32';
  const args = isWin ? ['-n', '1', '-w', '1500', host] : ['-c', '1', '-W', '2', host];
  try {
    const { stdout } = await execFileAsync('ping', args, { timeout: 3000 });
    const match = isWin
      ? stdout.match(/time[=<](\d+)ms/i)
      : stdout.match(/time=([\d.]+)\s*ms/i);
    if (!match) return { host, latencyMs: null, alive: false };
    return { host, latencyMs: Math.round(Number(match[1])), alive: true };
  } catch {
    return { host, latencyMs: null, alive: false };
  }
}

export function registerSystemStatsHandlers(): void {
  ipcMain.handle(IPC.system.sample, async (): Promise<SystemStatsSample> => {
    const settings = await store.getSettings();
    // Older settings.json files predate this field.
    const hosts = (settings.pingTargets ?? []).map((h) => h.trim()).filter(Boolean);

    const [net, pings, disks, gpus] = await Promise.all([
      sampleNetworkRates(),
      Promise.all(hosts.map((host) => pingHost(host))),
      sampleDisks(),
      sampleGpus(),
    ]);
    return {
      timestamp: Date.now(),
      cpuPercent: sampleCpuPercent(),
      ...sampleMemory(),
      disks,
      gpus,
      ...net,
      pings,
    };
  });
}
