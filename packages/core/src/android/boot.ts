/**
 * An emulator can take two minutes to come up, so the card shows named stages rather than a
 * spinner. The stages come from what is actually observable: the child process starting, the
 * serial appearing in `adb devices`, the device leaving `offline`, `sys.boot_completed` flipping
 * to 1, and finally the boot animation stopping.
 */

export type EmulatorState =
  | 'stopped'
  | 'launching'
  | 'connecting'
  | 'booting'
  | 'finishing'
  | 'running'
  | 'stopping'
  | 'failed';

/** The states an emulator passes through on the way up, in order. */
export const BOOT_STAGES = [
  'launching',
  'connecting',
  'booting',
  'finishing',
  'running',
] as const satisfies readonly EmulatorState[];

const PROGRESS: Partial<Record<EmulatorState, number>> = {
  launching: 10,
  connecting: 30,
  booting: 55,
  finishing: 85,
  running: 100,
};

const LABELS: Record<EmulatorState, string> = {
  stopped: 'Stopped',
  launching: 'Launching emulator',
  connecting: 'Waiting for device',
  booting: 'Booting Android',
  finishing: 'Finishing up',
  running: 'Ready',
  stopping: 'Stopping',
  failed: 'Failed to start',
};

export function bootProgressFor(state: EmulatorState): number {
  return PROGRESS[state] ?? 0;
}

export function bootStageLabel(state: EmulatorState): string {
  return LABELS[state];
}

/** `getprop sys.boot_completed`. Anything but a literal 1 means it is not up yet. */
export function parseBootCompleted(stdout: string): boolean {
  return stdout.trim() === '1';
}

/** `getprop init.svc.bootanim`. The animation stopping is the last thing that happens. */
export function parseBootAnim(stdout: string): boolean {
  return stdout.trim() === 'stopped';
}
