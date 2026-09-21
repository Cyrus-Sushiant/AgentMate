/**
 * How an SDK tool is actually started.
 *
 * adb and the emulator are real executables, so they go straight to `execFile` with an absolute
 * path and an argv array: no shell, and therefore no quoting to get wrong for an SDK under
 * "C:\Program Files" or a device serial the user typed.
 *
 * avdmanager and sdkmanager are the exception. They ship as `.bat` on Windows, and since the Node
 * 20 security fix `execFile` refuses to spawn a `.bat` or `.cmd` at all, so those have to go
 * through cmd.exe with a command line built and quoted here.
 *
 * This lives on its own so the SDK probe in sdk.ts and the runners in exec.ts cannot drift: a
 * tool spawned one way in one file and the other way in the other is exactly the bug that made
 * this module necessary.
 */

/** Node will not spawn one of these without a shell, whatever is in it. */
export function isBatchFile(binary: string): boolean {
  return /\.(bat|cmd)$/i.test(binary);
}

/**
 * Quotes one argument for a cmd.exe command line. An argument containing a double quote is
 * refused rather than half-escaped, because nothing we pass these tools legitimately has one.
 */
function quoteForCmd(value: string): string {
  if (value.includes('"')) throw new Error('A quote in an Android tool argument is not allowed.');
  return `"${value}"`;
}

export interface ToolSpawn {
  file: string;
  argv: string[];
  /** cmd.exe gets the whole line pre-quoted, so Node must not re-quote it. */
  verbatim: boolean;
}

export function toolSpawn(binary: string, args: string[]): ToolSpawn {
  if (process.platform !== 'win32' || !isBatchFile(binary)) {
    return { file: binary, argv: args, verbatim: false };
  }
  const line = [binary, ...args].map(quoteForCmd).join(' ');
  // The outer quotes are cmd's own convention for "the rest is the command line".
  return {
    file: process.env.ComSpec ?? 'cmd.exe',
    argv: ['/d', '/s', '/c', `"${line}"`],
    verbatim: true,
  };
}
