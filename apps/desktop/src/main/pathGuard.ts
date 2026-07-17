import { resolve, sep } from 'node:path';

/**
 * Resolves `candidatePath` and throws unless it is equal to, or nested inside,
 * one of `allowedRoots`. Used on every IPC handler that accepts a filesystem
 * path from the renderer, to prevent path traversal outside project/app-data dirs.
 */
export function assertPathWithinRoots(candidatePath: string, allowedRoots: string[]): string {
  const resolved = resolve(candidatePath);
  const isAllowed = allowedRoots.some((root) => {
    const resolvedRoot = resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + sep);
  });

  if (!isAllowed) {
    throw new Error(`Path "${candidatePath}" is outside of the allowed directories.`);
  }

  return resolved;
}
