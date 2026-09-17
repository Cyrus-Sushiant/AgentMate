/** Posix path helpers for workspace relative paths. Kept here so core never needs node:path. */

export function toPosix(path: string): string {
  return path.replace(/\\/g, '/');
}

export function dirOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

export function baseOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function joinRel(...parts: string[]): string {
  return normalizeRel(parts.filter((part) => part !== '' && part !== '.').join('/'));
}

/** Resolves `.` and `..` segments. Returns `''` for the workspace root. */
export function normalizeRel(path: string): string {
  const out: string[] = [];
  for (const segment of toPosix(path).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

/** True when `path` is `dir` itself or somewhere below it. `''` contains everything. */
export function isWithin(path: string, dir: string): boolean {
  return dir === '' || path === dir || path.startsWith(`${dir}/`);
}

/** `path` relative to `dir`, assuming it is inside. */
export function relativeTo(path: string, dir: string): string {
  if (dir === '') return path;
  return path === dir ? '' : path.slice(dir.length + 1);
}

/**
 * Turns a path from a report (absolute, or relative to the project root) into a workspace relative
 * one. Windows drive letters and separators are compared without regard to case.
 */
export function workspaceRelative(
  reported: string,
  folderPath: string,
  projectRoot: string,
): string | null {
  let file = toPosix(reported.trim()).replace(/^file:\/\/\/?/, '');
  try {
    file = decodeURI(file);
  } catch {
    // Not URI encoded after all.
  }
  // `file:///C:/x` leaves `C:/x`, `file:///home/x` leaves `home/x`: put the slash back for POSIX.
  if (/^file:/.test(reported) && !/^[a-zA-Z]:\//.test(file)) file = `/${file}`;
  const folder = toPosix(folderPath).replace(/\/+$/, '');
  const isAbsolute = file.startsWith('/') || /^[a-zA-Z]:\//.test(file);
  if (!isAbsolute) return normalizeRel(joinRel(projectRoot, file));
  const windowsLike = /^[a-zA-Z]:\//.test(folder);
  const a = windowsLike ? file.toLowerCase() : file;
  const b = windowsLike ? folder.toLowerCase() : folder;
  if (a === b) return '';
  if (!a.startsWith(`${b}/`)) return null;
  return normalizeRel(file.slice(folder.length + 1));
}
