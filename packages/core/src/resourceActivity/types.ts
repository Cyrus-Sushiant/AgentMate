/**
 * Shapes for the Dashboard's Docker and emulator usage chart and its idle list. The desktop app's
 * tracker feeds observations into the pure reducers in `activity.ts`; the renderer only ever sees
 * the snapshot.
 *
 * CPU is on one scale everywhere: 100 means one full core, so a busy multi-threaded process can
 * go past 100.
 */

export type ResourceKind = 'docker' | 'emulator';

/** Names one running thing. `id` is the full container id or the adb serial. */
export interface ResourceRef {
  kind: ResourceKind;
  id: string;
}

/** One running container as read from `docker stats`. */
export interface DockerObservation {
  id: string;
  name: string;
  image: string;
  cpuPercent: number | null;
  memBytes: number | null;
  /** Bytes received plus sent since the container started. Only ever grows. */
  netBytes: number | null;
  /** Bytes read plus written to block devices since the container started. */
  blockBytes: number | null;
}

/** One running emulator. */
export interface EmulatorObservation {
  serial: string;
  avdName: string;
  /** Null while CPU has nothing to compare against (the first sample). */
  cpuPercent: number | null;
  memBytes: number | null;
  /** False when no process could be found for it, so its activity cannot be judged. */
  measurable: boolean;
}

/** What the tracker remembers about one resource between ticks. */
export interface ActivityRecord {
  key: string;
  kind: ResourceKind;
  id: string;
  name: string;
  /** The image for a container, the AVD name for an emulator. */
  detail: string | null;
  cpuPercent: number | null;
  memBytes: number | null;
  netBytes: number | null;
  blockBytes: number | null;
  measurable: boolean;
  firstSeenAt: number;
  lastActiveAt: number;
  /** When this record was last updated, which is the baseline for the next rate. */
  seenAt: number;
  /** True once an idle alert went out, so one idle stretch alerts once. */
  notified: boolean;
}

export interface ActivityState {
  records: Record<string, ActivityRecord>;
  /** When each source was last read successfully. */
  lastSampleAt: Partial<Record<ResourceKind, number>>;
}

/** A tracked resource as the UI shows it. */
export interface ActivityResource {
  key: string;
  kind: ResourceKind;
  id: string;
  name: string;
  detail: string | null;
  cpuPercent: number | null;
  memBytes: number | null;
  measurable: boolean;
  firstSeenAt: number;
  lastActiveAt: number;
  /** How long it has been quiet. Always 0 for something that cannot be measured. */
  idleForMs: number;
  idle: boolean;
}

/** One point of the usage chart: totals across every tracked resource of each kind. */
export interface ResourceUsagePoint {
  at: number;
  dockerCpu: number;
  dockerMem: number;
  dockerCount: number;
  emulatorCpu: number;
  emulatorMem: number;
  emulatorCount: number;
}

/** `pending` until the first reading lands, so the UI shows a loading state, not an empty one. */
export type ResourceSourceStatus = 'pending' | 'ready' | 'unavailable';

export interface ResourceActivitySnapshot {
  generatedAt: number;
  /** When the tracker started, so the UI can say the idle clocks are still young. */
  watchingSince: number;
  idleMinutes: number;
  docker: ResourceSourceStatus;
  emulators: ResourceSourceStatus;
  /** Every tracked resource, idle ones flagged and listed first. */
  resources: ActivityResource[];
  history: ResourceUsagePoint[];
}

export interface ResourceStopResult {
  ref: ResourceRef;
  name: string;
  ok: boolean;
  /** `active` when "stop only if idle" found it busy again, `gone` when it was no longer tracked. */
  skipped?: 'active' | 'gone';
  message?: string;
}

export interface ResourceStopOutcome {
  results: ResourceStopResult[];
  snapshot: ResourceActivitySnapshot;
}
