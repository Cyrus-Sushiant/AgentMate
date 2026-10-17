import { DEV_ITEMS } from './catalog.js';
import type { DevArch, DevItemId, DevOs } from './types.js';

/**
 * Setting up the Android SDK without Android Studio starts with the command-line tools, which are
 * a plain zip Google lists in its repository file. This reads that file for the right download
 * and says which SDK packages to ask for after that.
 *
 * The file is XML, but the part needed is a handful of fixed elements, so it is read with
 * patterns rather than a parser (the project takes no new dependencies for this). The result is a
 * file that gets downloaded and unpacked, so an entry that looks off is "no archive".
 */

export const ANDROID_REPOSITORY_BASE_URL = 'https://dl.google.com/android/repository/';
export const ANDROID_REPOSITORY_MANIFEST_URL = `${ANDROID_REPOSITORY_BASE_URL}repository2-3.xml`;

export interface CmdlineToolsArchive {
  /** The tools' own version, such as "23.0". */
  revision: string;
  url: string;
  /** Lowercase hex. Google publishes SHA-1 for these. */
  sha1: string;
  size: number;
}

const HOST_OS: Record<DevOs, string> = { win32: 'windows', darwin: 'macosx', linux: 'linux' };
const SHA1 = /^[0-9a-f]{40}$/i;
const ARCHIVE_NAME = /^[A-Za-z0-9._-]+\.zip$/;

function tag(block: string, name: string): string | null {
  return new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(block)?.[1] ?? null;
}

function revisionOf(block: string): string | null {
  const revision = /<revision>([\s\S]*?)<\/revision>/.exec(block)?.[1];
  if (!revision) return null;
  const parts = ['major', 'minor', 'micro'].map((name) => tag(revision, name));
  if (parts[0] === null || !/^\d+$/.test(parts[0])) return null;
  return parts.filter((part): part is string => part !== null && /^\d+$/.test(part)).join('.');
}

/**
 * The download for the "latest" command-line tools on this OS and CPU. Windows and Linux have one
 * archive for every CPU, because the tools are Java; a Mac has one for Intel and one for Apple
 * silicon.
 */
export function parseCmdlineToolsArchive(
  xml: string,
  os: DevOs,
  arch: DevArch,
): CmdlineToolsArchive | null {
  const block = /<remotePackage path="cmdline-tools;latest">([\s\S]*?)<\/remotePackage>/.exec(
    xml,
  )?.[1];
  if (!block) return null;
  const revision = revisionOf(block);
  if (!revision) return null;

  const wantArch = arch === 'arm64' ? 'aarch64' : 'x64';
  for (const match of block.matchAll(/<archive>([\s\S]*?)<\/archive>/g)) {
    const archive = match[1] ?? '';
    if (tag(archive, 'host-os') !== HOST_OS[os]) continue;
    if (os === 'darwin' && tag(archive, 'host-arch') !== wantArch) continue;

    const sha1 = /<checksum type="sha1">\s*([^<]*?)\s*<\/checksum>/.exec(archive)?.[1];
    const name = tag(archive, 'url');
    const size = tag(archive, 'size');
    if (!sha1 || !SHA1.test(sha1)) return null;
    if (!name || !ARCHIVE_NAME.test(name) || name.startsWith('.')) return null;
    if (!size || !/^\d+$/.test(size) || Number(size) <= 0) return null;

    return {
      revision,
      url: `${ANDROID_REPOSITORY_BASE_URL}${name}`,
      sha1: sha1.toLowerCase(),
      size: Number(size),
    };
  }
  return null;
}

/** Android's emulator images match the CPU: Intel images on x64, ARM images on ARM. */
export function systemImageAbi(arch: DevArch): 'x86_64' | 'arm64-v8a' {
  return arch === 'arm64' ? 'arm64-v8a' : 'x86_64';
}

/**
 * The sdkmanager package for each Android item that is installed that way, with the system image
 * filled in for this CPU. Read from the catalog so the package ids are only written down once.
 */
export function androidPackagesFor(arch: DevArch): Record<DevItemId, string> {
  const packages: Record<DevItemId, string> = {};
  for (const item of DEV_ITEMS) {
    for (const recipes of Object.values(item.recipes)) {
      for (const recipe of recipes ?? []) {
        if (
          recipe.kind === 'managed' &&
          recipe.installer === 'android-package' &&
          recipe.sdkPackage
        ) {
          packages[item.id] = recipe.sdkPackage.replace('{abi}', systemImageAbi(arch));
        }
      }
    }
  }
  return packages;
}
