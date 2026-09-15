/** One process in an OS snapshot, as the desktop app reads it on each platform. */
export interface ProcessRow {
  pid: number;
  ppid: number;
  name: string;
  /**
   * Total CPU time used so far, in seconds. On macOS `ps` only reports a rate, so there it
   * holds the current share of all cores (0-100) instead; see `cpuIsRate`.
   */
  cpuTimeSec: number;
  memBytes: number;
  /**
   * When the process started, in any unit that only has to compare within one platform. It
   * tells a real child apart from a process that took over a dead parent's reused pid.
   */
  startedAt?: number;
}

export interface ProcessSample {
  /** Milliseconds since the epoch. */
  at: number;
  processes: ProcessRow[];
}

export interface ProcessTreeProcess {
  pid: number;
  name: string;
  cpuPercent: number;
  memBytes: number;
}

export interface ProcessTreeUsage {
  rootPid: number;
  /** False when the root process was not in the snapshot (it ended). */
  found: boolean;
  /** Share of all cores, 0-100. */
  cpuPercent: number;
  memBytes: number;
  processCount: number;
  /** The busiest processes in the tree, root included, highest CPU first. */
  processes: ProcessTreeProcess[];
}

export interface SummarizeOptions {
  cpuCount: number;
  /** Set when `cpuTimeSec` already holds a percentage (macOS). */
  cpuIsRate?: boolean;
  /** How many processes each tree lists. The totals still count all of them. */
  maxProcesses?: number;
}

/** The pid itself and every process below it, parents before children. */
export function descendantPids(rootPid: number, rows: ProcessRow[]): number[] {
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const children = new Map<number, ProcessRow[]>();
  for (const row of rows) {
    if (row.pid === row.ppid) continue;
    const list = children.get(row.ppid);
    if (list) list.push(row);
    else children.set(row.ppid, [row]);
  }
  const root = byPid.get(rootPid);
  if (!root) return [];
  const seen = new Set<number>([rootPid]);
  const order: number[] = [rootPid];
  const queue: ProcessRow[] = [root];
  while (queue.length > 0) {
    const parent = queue.shift() as ProcessRow;
    for (const child of children.get(parent.pid) ?? []) {
      if (seen.has(child.pid)) continue;
      // A process whose parent exited keeps pointing at the old pid. If a newer process
      // reused that pid, the orphan is older than its "parent" and does not belong to it.
      if (
        parent.startedAt !== undefined &&
        child.startedAt !== undefined &&
        child.startedAt < parent.startedAt
      ) {
        continue;
      }
      seen.add(child.pid);
      order.push(child.pid);
      queue.push(child);
    }
  }
  return order;
}

function samePid(a: ProcessRow, b: ProcessRow | undefined): b is ProcessRow {
  if (!b) return false;
  return a.startedAt === undefined || b.startedAt === undefined || a.startedAt === b.startedAt;
}

/**
 * CPU and memory for each root pid's whole process tree. CPU comes from the change in CPU
 * time since `previous`; without one, every CPU figure is 0 (memory is still exact).
 */
export function summarizeProcessTrees(
  rootPids: number[],
  current: ProcessSample,
  previous: ProcessSample | null,
  options: SummarizeOptions,
): Map<number, ProcessTreeUsage> {
  const cpuCount = Math.max(1, options.cpuCount);
  const maxProcesses = options.maxProcesses ?? 20;
  const byPid = new Map(current.processes.map((row) => [row.pid, row]));
  const prevByPid = new Map((previous?.processes ?? []).map((row) => [row.pid, row]));
  const elapsedSec = previous ? (current.at - previous.at) / 1000 : 0;

  const cpuPercentOf = (row: ProcessRow): number => {
    if (options.cpuIsRate) return Math.max(0, row.cpuTimeSec);
    if (elapsedSec <= 0) return 0;
    const prev = prevByPid.get(row.pid);
    if (!samePid(row, prev)) return 0;
    const delta = row.cpuTimeSec - prev.cpuTimeSec;
    if (!(delta > 0)) return 0;
    return Math.min(100, (delta / elapsedSec / cpuCount) * 100);
  };

  const result = new Map<number, ProcessTreeUsage>();
  for (const rootPid of rootPids) {
    const pids = descendantPids(rootPid, current.processes);
    const processes: ProcessTreeProcess[] = [];
    let cpuPercent = 0;
    let memBytes = 0;
    for (const pid of pids) {
      const row = byPid.get(pid);
      if (!row) continue;
      const cpu = cpuPercentOf(row);
      const mem = Math.max(0, row.memBytes);
      cpuPercent += cpu;
      memBytes += mem;
      processes.push({ pid, name: row.name, cpuPercent: cpu, memBytes: mem });
    }
    processes.sort((a, b) => b.cpuPercent - a.cpuPercent || b.memBytes - a.memBytes);
    result.set(rootPid, {
      rootPid,
      found: pids.length > 0,
      cpuPercent: Math.min(100, cpuPercent),
      memBytes,
      processCount: processes.length,
      processes: processes.slice(0, maxProcesses),
    });
  }
  return result;
}

/**
 * Reads one Linux `/proc/<pid>/stat` line. The name sits in parentheses and can itself hold
 * spaces or parentheses, so fields are counted from the last `)`.
 */
export function parseProcStat(
  raw: string,
  clockTicksPerSec = 100,
  pageSizeBytes = 4096,
): ProcessRow | null {
  const open = raw.indexOf('(');
  const close = raw.lastIndexOf(')');
  if (open < 0 || close < open) return null;
  const pid = Number(raw.slice(0, open).trim());
  // Fields after the name start at field 3 (state), so field N is rest[N - 3].
  const rest = raw
    .slice(close + 2)
    .trim()
    .split(/\s+/);
  const ppid = Number(rest[1]);
  const utime = Number(rest[11]);
  const stime = Number(rest[12]);
  const startTicks = Number(rest[19]);
  const rssPages = Number(rest[21]);
  if (!Number.isFinite(pid) || !Number.isFinite(ppid)) return null;
  if (!Number.isFinite(utime) || !Number.isFinite(stime)) return null;
  return {
    pid,
    ppid,
    name: raw.slice(open + 1, close),
    cpuTimeSec: (utime + stime) / clockTicksPerSec,
    memBytes: Number.isFinite(rssPages) ? rssPages * pageSizeBytes : 0,
    startedAt: Number.isFinite(startTicks) ? startTicks : undefined,
  };
}
