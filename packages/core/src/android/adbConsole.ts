/**
 * `adb -s <serial> emu <command>` talks to the emulator's own console rather than to Android.
 * Every command answers with its result, if any, then a bare `OK` or a `KO: reason`, so the
 * acknowledgement has to be stripped before the answer means anything.
 */

/** The AVD an emulator serial belongs to. This is how an externally started emulator is named. */
export function parseEmuAvdName(stdout: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const name = lines.find((line) => line !== 'OK' && !line.startsWith('KO'));
  return name ?? null;
}

export function parseEmuOk(stdout: string): boolean {
  return stdout.split(/\r?\n/).some((line) => line.trim() === 'OK');
}
