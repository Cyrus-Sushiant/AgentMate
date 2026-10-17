/**
 * Reading and comparing the version strings developer tools print. Every tool words it
 * differently (`git version 2.55.0.windows.5`, `v22.12.0`, `Docker version 28.4.0, build abc`), so
 * parsing is deliberately lenient and comparison is strictly numeric.
 */

export interface ParseVersionOptions {
  /**
   * Also accept a lone number such as `javac 21`. A JDK general-availability build prints only its
   * major version, so without this a perfectly good Java would read as "version unknown".
   */
  majorOnly?: boolean;
}

/** Two or three dotted numbers that do not sit inside a longer run of digits or dots. */
const DOTTED = /(?<![\d.])v?(\d+\.\d+(?:\.\d+)?)/;
const MAJOR = /(?<![\d.])(\d+)(?![\d.])/;

/**
 * The first version in `text`, cut to at most three parts so `2.55.0.windows.5` and `2.5.9.0`
 * become `2.55.0` and `2.5.9`. Returns null when nothing in it looks like a version.
 */
export function parseVersion(text: string, options: ParseVersionOptions = {}): string | null {
  const dotted = DOTTED.exec(text);
  if (dotted) return dotted[1] ?? null;
  if (!options.majorOnly) return null;
  return MAJOR.exec(text)?.[1] ?? null;
}

/** `1.2.3-rc.1` and `v1.2.3` both reduce to their numeric parts. */
function numericParts(version: string): number[] {
  const match = /^\s*v?(\d+(?:\.\d+)*)/.exec(version);
  if (!match?.[1]) return [];
  return match[1].split('.').map((part) => Number.parseInt(part, 10));
}

/** Negative when `a` is older than `b`, zero when equal, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const left = numericParts(a);
  const right = numericParts(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Whether a detected version is good enough. A tool whose version could not be read fails a
 * minimum (we cannot vouch for it) but passes when no minimum is set.
 */
export function meetsMinimum(version: string | null, minimum: string | undefined): boolean {
  if (!minimum) return true;
  if (!version) return false;
  return compareVersions(version, minimum) >= 0;
}
