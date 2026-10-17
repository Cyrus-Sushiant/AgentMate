import type { DevOs } from './types.js';

/**
 * The small, pure parts of setting up the Android SDK without Android Studio: telling whether the
 * licenses have been accepted, reading a package's revision, and choosing where a fresh SDK goes.
 */

/** A license file is a list of accepted-license hashes, one 40 character hex string per line. */
const ACCEPTED_HASH = /^[0-9a-f]{40}$/;

/** Whether `licenses/android-sdk-license` holds at least one accepted license. */
export function licensesAccepted(fileText: string | null): boolean {
  if (!fileText) return false;
  return fileText.split(/\r?\n/).some((line) => ACCEPTED_HASH.test(line.trim()));
}

/** The `Pkg.Revision` of an installed SDK package, from the `source.properties` beside it. */
export function parsePackageRevision(fileText: string | null): string | null {
  if (!fileText) return null;
  const match = /^\s*Pkg\.Revision\s*=\s*(\S+)\s*$/m.exec(fileText);
  return match?.[1] ?? null;
}

/**
 * Where a new SDK is put when none exists: the same folder Android Studio would choose, so Studio
 * (or Flutter) opened later finds it without being told.
 */
export function defaultSdkInstallRoot(
  os: DevOs,
  env: Readonly<Record<string, string | undefined>>,
  home: string,
): string {
  if (os === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim() || `${home}\\AppData\\Local`;
    return `${localAppData}\\Android\\Sdk`;
  }
  if (os === 'darwin') return `${home}/Library/Android/sdk`;
  return `${home}/Android/Sdk`;
}
