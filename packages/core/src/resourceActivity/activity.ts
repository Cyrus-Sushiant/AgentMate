import type {
  ActivityRecord,
  ActivityResource,
  ActivityState,
  DockerObservation,
  EmulatorObservation,
  ResourceKind,
  ResourceUsagePoint,
} from './types.js';

/**
 * What counts as "being used". Kept in one object so the numbers are easy to find and a test can
 * pin them. The emulator figure is the least certain: an idle Android emulator with the screen
 * on is not at 0% CPU, so it sits well above a container's.
 */
export const ACTIVITY_THRESHOLDS = {
  /** Docker's own scale, where 100 is one full core. */
  dockerCpuPercent: 2,
  /** Network traffic above keepalive noise, summed over both directions. */
  dockerNetBytesPerSec: 64,
  dockerBlockBytesPerSec: 1024,
  /** One core scale, averaged over the whole interval between two samples. */
  emulatorCpuPercent: 25,
  /** A source left unread for longer than this many ticks (sleep, outage) is a gap. */
  maxGapTicks: 3,
  /** Two hours of chart at one point every 30 seconds. */
  historyPoints: 240,
} as const;

export function createActivityState(): ActivityState {
  return { records: {}, lastSampleAt: {} };
}

export function resourceKey(kind: ResourceKind, id: string): string {
  return `${kind}:${id}`;
}

interface Entry {
  id: string;
  name: string;
  detail: string | null;
  cpuPercent: number | null;
  memBytes: number | null;
  netBytes: number | null;
  blockBytes: number | null;
  measurable: boolean;
  /** Whether it was busy since `prev`. Only asked about a resource seen on an earlier tick. */
  isActive: (prev: ActivityRecord, elapsedSec: number) => boolean;
}

/**
 * Folds one reading of a source into the state. A null `entries` means the source could not be
 * read at all, which forgets everything of that kind rather than guessing.
 */
function advance(
  state: ActivityState,
  kind: ResourceKind,
  entries: Entry[] | null,
  now: number,
  tickMs: number,
): ActivityState {
  const records: Record<string, ActivityRecord> = {};
  for (const [key, record] of Object.entries(state.records)) {
    if (record.kind !== kind) records[key] = record;
  }
  const lastSampleAt = { ...state.lastSampleAt };
  if (entries === null) {
    delete lastSampleAt[kind];
    return { records, lastSampleAt };
  }

  const last = state.lastSampleAt[kind];
  // Time nobody was watching is not idle time, so after a gap everything starts a fresh clock.
  const gap = last !== undefined && now - last > ACTIVITY_THRESHOLDS.maxGapTicks * tickMs;

  for (const entry of entries) {
    const key = resourceKey(kind, entry.id);
    const prev = state.records[key];
    const base = {
      key,
      kind,
      id: entry.id,
      name: entry.name,
      detail: entry.detail,
      cpuPercent: entry.cpuPercent,
      memBytes: entry.memBytes,
      netBytes: entry.netBytes,
      blockBytes: entry.blockBytes,
      measurable: entry.measurable,
      seenAt: now,
    };
    if (!prev) {
      records[key] = { ...base, firstSeenAt: now, lastActiveAt: now, notified: false };
      continue;
    }
    const active =
      gap || !entry.measurable || entry.isActive(prev, Math.max(0, (now - prev.seenAt) / 1000));
    records[key] = {
      ...base,
      firstSeenAt: prev.firstSeenAt,
      lastActiveAt: active ? now : prev.lastActiveAt,
      // Active again re-arms the alert for the next time it goes quiet.
      notified: active ? false : prev.notified,
    };
  }
  lastSampleAt[kind] = now;
  return { records, lastSampleAt };
}

/** True when a cumulative counter moved enough, or went backwards (a restart is activity). */
function counterBusy(
  before: number | null,
  after: number | null,
  elapsedSec: number,
  minPerSec: number,
): boolean {
  if (before === null || after === null) return false;
  const delta = after - before;
  if (delta < 0) return true;
  return elapsedSec > 0 && delta / elapsedSec >= minPerSec;
}

export function advanceDocker(
  state: ActivityState,
  observations: DockerObservation[] | null,
  now: number,
  tickMs: number,
): ActivityState {
  const entries =
    observations?.map(
      (obs): Entry => ({
        id: obs.id,
        name: obs.name,
        detail: obs.image || null,
        cpuPercent: obs.cpuPercent,
        memBytes: obs.memBytes,
        netBytes: obs.netBytes,
        blockBytes: obs.blockBytes,
        measurable: true,
        isActive: (prev, elapsedSec) => {
          // Unknown must never read as idle, or a stats hiccup would flag a busy container.
          if (obs.cpuPercent === null && obs.netBytes === null && obs.blockBytes === null) {
            return true;
          }
          if (obs.cpuPercent !== null && obs.cpuPercent >= ACTIVITY_THRESHOLDS.dockerCpuPercent) {
            return true;
          }
          return (
            counterBusy(
              prev.netBytes,
              obs.netBytes,
              elapsedSec,
              ACTIVITY_THRESHOLDS.dockerNetBytesPerSec,
            ) ||
            counterBusy(
              prev.blockBytes,
              obs.blockBytes,
              elapsedSec,
              ACTIVITY_THRESHOLDS.dockerBlockBytesPerSec,
            )
          );
        },
      }),
    ) ?? null;
  return advance(state, 'docker', entries, now, tickMs);
}

export function advanceEmulators(
  state: ActivityState,
  observations: EmulatorObservation[] | null,
  now: number,
  tickMs: number,
): ActivityState {
  const entries =
    observations?.map(
      (obs): Entry => ({
        id: obs.serial,
        name: obs.avdName,
        detail: obs.serial,
        cpuPercent: obs.cpuPercent,
        memBytes: obs.memBytes,
        netBytes: null,
        blockBytes: null,
        measurable: obs.measurable,
        isActive: () =>
          obs.cpuPercent === null || obs.cpuPercent >= ACTIVITY_THRESHOLDS.emulatorCpuPercent,
      }),
    ) ?? null;
  return advance(state, 'emulator', entries, now, tickMs);
}

/** Every tracked resource with its idle time, idle ones first and the longest quiet first. */
export function describeResources(
  state: ActivityState,
  now: number,
  idleMinutes: number,
): ActivityResource[] {
  const limitMs = idleMinutes * 60_000;
  const list = Object.values(state.records).map((record): ActivityResource => {
    // Something that cannot be measured is never called idle, because it might be busy.
    const idleForMs = record.measurable ? Math.max(0, now - record.lastActiveAt) : 0;
    return {
      key: record.key,
      kind: record.kind,
      id: record.id,
      name: record.name,
      detail: record.detail,
      cpuPercent: record.cpuPercent,
      memBytes: record.memBytes,
      measurable: record.measurable,
      firstSeenAt: record.firstSeenAt,
      lastActiveAt: record.lastActiveAt,
      idleForMs,
      idle: record.measurable && idleForMs >= limitMs,
    };
  });
  list.sort(
    (a, b) =>
      Number(b.idle) - Number(a.idle) ||
      b.idleForMs - a.idleForMs ||
      a.name.localeCompare(b.name) ||
      a.key.localeCompare(b.key),
  );
  return list;
}

/**
 * The resources that went idle since the last call, marked as announced so each idle stretch is
 * reported once. Records are marked even when alerts are off, so turning them on later does not
 * announce things that have been quiet for hours.
 */
export function takeNewlyIdle(
  state: ActivityState,
  now: number,
  idleMinutes: number,
): { state: ActivityState; newlyIdle: ActivityResource[] } {
  const newlyIdle = describeResources(state, now, idleMinutes).filter(
    (resource) => resource.idle && !state.records[resource.key]?.notified,
  );
  if (newlyIdle.length === 0) return { state, newlyIdle };
  const records = { ...state.records };
  for (const resource of newlyIdle) {
    const record = records[resource.key];
    if (record) records[resource.key] = { ...record, notified: true };
  }
  return { state: { ...state, records }, newlyIdle };
}

export function forgetResources(state: ActivityState, keys: string[]): ActivityState {
  if (keys.length === 0) return state;
  const drop = new Set(keys);
  const records: Record<string, ActivityRecord> = {};
  for (const [key, record] of Object.entries(state.records)) {
    if (!drop.has(key)) records[key] = record;
  }
  return { ...state, records };
}

/** Totals across everything tracked, for one point of the usage chart. */
export function usagePoint(state: ActivityState, at: number): ResourceUsagePoint {
  const point: ResourceUsagePoint = {
    at,
    dockerCpu: 0,
    dockerMem: 0,
    dockerCount: 0,
    emulatorCpu: 0,
    emulatorMem: 0,
    emulatorCount: 0,
  };
  for (const record of Object.values(state.records)) {
    const cpu = record.cpuPercent ?? 0;
    const mem = record.memBytes ?? 0;
    if (record.kind === 'docker') {
      point.dockerCpu += cpu;
      point.dockerMem += mem;
      point.dockerCount += 1;
    } else {
      point.emulatorCpu += cpu;
      point.emulatorMem += mem;
      point.emulatorCount += 1;
    }
  }
  return point;
}

/** Appends and drops the oldest entries beyond `max`. Returns a new array. */
export function appendBounded<T>(
  points: readonly T[],
  point: T,
  max: number = ACTIVITY_THRESHOLDS.historyPoints,
): T[] {
  const next = [...points, point];
  return next.length > max ? next.slice(next.length - max) : next;
}
