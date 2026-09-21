/**
 * Building the `emulator` command line. Kept pure and separate from the spawning so the flag set
 * is unit-tested rather than discovered by watching an emulator fail to start.
 */

export type GpuMode = 'auto' | 'host' | 'swiftshader_indirect' | 'off';

export interface EmulatorLaunchOptions {
  avdName: string;
  /** The console port, which fixes the serial at `emulator-<port>`. */
  port: number;
  /** Ignore the saved snapshot. Note this still saves one on exit. */
  coldBoot?: boolean;
  /** Reset the data partition before booting. The emulator must not already be running. */
  wipeData?: boolean;
  gpu?: GpuMode;
  /** Whatever the user put in the launch-flags setting, already split into argv. */
  extraArgs?: string[];
}

/** The emulator only listens on even ports in this range, one AVD each. */
const FIRST_CONSOLE_PORT = 5554;
const LAST_CONSOLE_PORT = 5584;

export function emulatorLaunchArgs(options: EmulatorLaunchOptions): string[] {
  const args = ['-avd', options.avdName, '-port', String(options.port)];
  if (options.coldBoot) args.push('-no-snapshot-load');
  if (options.wipeData) args.push('-wipe-data');
  if (options.gpu) args.push('-gpu', options.gpu);
  // Last, so a user flag wins over the default we chose above.
  for (const extra of options.extraArgs ?? []) {
    const trimmed = extra.trim();
    if (trimmed) args.push(trimmed);
  }
  return args;
}

/**
 * The lowest console port nothing is using. Taking the port up front is what removes the race
 * between starting an emulator and finding out which serial it took.
 */
export function nextFreeConsolePort(taken: readonly number[]): number | null {
  const used = new Set(taken);
  for (let port = FIRST_CONSOLE_PORT; port <= LAST_CONSOLE_PORT; port += 2) {
    if (!used.has(port)) return port;
  }
  return null;
}
