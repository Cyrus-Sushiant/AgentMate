import { realpath } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';

function isWithin(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

/**
 * `candidatePath` with every symlink and junction along it followed. A path that
 * does not exist yet (a file about to be written) resolves its nearest existing
 * ancestor instead and re-appends the missing segments, so a write can't be
 * smuggled through a linked parent directory either.
 */
async function realPathOfNearestExisting(candidatePath: string): Promise<string> {
  let current = resolve(candidatePath);
  const missing: string[] = [];
  for (;;) {
    try {
      const real = await realpath(current);
      return missing.length > 0 ? resolve(real, ...missing.reverse()) : real;
    } catch {
      const parent = dirname(current);
      // Hit the drive/filesystem root without finding anything that exists.
      if (parent === current) return resolve(candidatePath);
      missing.push(basename(current));
      current = parent;
    }
  }
}

/**
 * Resolves `candidatePath` and throws unless it is equal to, or nested inside,
 * one of `allowedRoots`. Used on every IPC handler that accepts a filesystem
 * path from the renderer, to prevent path traversal outside project/app-data dirs.
 *
 * Containment is checked on the real paths, not the textual ones: a symlink or
 * Windows junction inside a project folder (a cloned repo can easily carry one)
 * looks perfectly contained to `resolve` while pointing anywhere on disk.
 */
export async function assertPathWithinRoots(
  candidatePath: string,
  allowedRoots: string[],
): Promise<string> {
  const resolved = resolve(candidatePath);
  const [realCandidate, realRoots] = await Promise.all([
    realPathOfNearestExisting(resolved),
    Promise.all(allowedRoots.map((root) => realPathOfNearestExisting(root))),
  ]);

  if (!realRoots.some((root) => isWithin(realCandidate, root))) {
    throw new Error(`Path "${candidatePath}" is outside of the allowed directories.`);
  }

  return resolved;
}
