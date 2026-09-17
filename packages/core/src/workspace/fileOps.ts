/**
 * Path and name rules for the workspace explorer's file operations. Kept free of `node:path`
 * so the renderer and the main process agree on them, whatever the path style.
 */

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const WINDOWS_INVALID_CHARS = /[<>:"|?*\p{Cc}]/u;

function isSeparator(char: string | undefined): boolean {
  return char === '/' || char === '\\';
}

/**
 * Why a name typed into the explorer can't be used, or null when it can. A name may hold
 * `/` to create nested folders in one go (`src/utils/date.ts`), like VS Code allows, but
 * only when `allowNested` is set.
 */
export function validateEntryName(
  name: string,
  platform: string,
  options: { allowNested?: boolean } = {},
): string | null {
  if (!name.trim()) return 'A file or folder name must be provided.';
  if (name.includes('\0')) return 'The name contains a character that is not allowed.';
  const segments = name.split(/[\\/]/);
  if (segments.length > 1 && !options.allowNested) {
    return 'The name cannot contain slashes.';
  }
  if (isSeparator(name[0])) return 'The name cannot start with a slash.';
  for (const [index, segment] of segments.entries()) {
    const last = index === segments.length - 1;
    // A trailing slash (`folder/`) is harmless; an empty segment in the middle is not.
    if (!segment) {
      if (last) continue;
      return 'The name contains an empty folder name.';
    }
    if (segment === '.' || segment === '..') return `"${segment}" is not a valid name.`;
    if (segment.trim() !== segment) return 'Names cannot start or end with a space.';
    if (platform === 'win32') {
      if (WINDOWS_INVALID_CHARS.test(segment)) {
        return 'Names cannot contain any of these characters: < > : " | ? *';
      }
      if (segment.endsWith('.')) return 'Names cannot end with a period on Windows.';
      if (WINDOWS_RESERVED.test(segment)) return `"${segment}" is a reserved name on Windows.`;
    }
  }
  return null;
}

/** Splits `archive.tar.gz` style names at the last dot, leaving dotfiles (`.env`) whole. */
export function splitExtension(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * The name a pasted copy gets when `name` is taken in the target folder: `a copy.ts`,
 * then `a copy 2.ts`, and so on. `existing` is compared case-insensitively, since two
 * names differing only in case collide on Windows and macOS.
 */
export function copyName(name: string, existing: Iterable<string>, isDirectory = false): string {
  const taken = new Set(Array.from(existing, (n) => n.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const { base, ext } = isDirectory ? { base: name, ext: '' } : splitExtension(name);
  for (let n = 1; ; n += 1) {
    const candidate = `${base} copy${n === 1 ? '' : ` ${n}`}${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** True when `child` is `parent` itself or somewhere inside it. */
export function isSameOrInside(child: string, parent: string): boolean {
  const trimmed = parent.replace(/[\\/]+$/, '');
  if (child === trimmed) return true;
  return child.startsWith(trimmed) && isSeparator(child[trimmed.length]);
}

/** `path` with `from` swapped for `to`, when it is `from` or inside it. Otherwise null. */
export function remapPath(path: string, from: string, to: string): string | null {
  if (!isSameOrInside(path, from)) return null;
  const trimmed = from.replace(/[\\/]+$/, '');
  return to.replace(/[\\/]+$/, '') + path.slice(trimmed.length);
}

/** The folder holding `path`, or null for a root. */
export function parentPath(path: string): string | null {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (index <= 0) return null;
  // `C:\foo` keeps its separator so the parent is the drive root, not the bare `C:`.
  return /^[A-Za-z]:$/.test(trimmed.slice(0, index))
    ? trimmed.slice(0, index + 1)
    : trimmed.slice(0, index);
}

/** The last segment of a path. */
export function baseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return trimmed.slice(index + 1);
}

/** `path` relative to `root`, with forward slashes. Empty for the root itself. */
export function relativeTo(root: string, path: string): string | null {
  if (!isSameOrInside(path, root)) return null;
  return path
    .slice(root.replace(/[\\/]+$/, '').length)
    .replace(/^[\\/]+/, '')
    .replaceAll('\\', '/');
}

/** Drops paths that sit inside another path in the list, so a folder and its file act once. */
export function topLevelPaths(paths: readonly string[]): string[] {
  const unique = Array.from(new Set(paths));
  return unique.filter(
    (path) => !unique.some((other) => other !== path && isSameOrInside(path, other)),
  );
}

export type GitignorePattern = 'path' | 'extension';

/**
 * The .gitignore line for a repo-relative path. `path` anchors it to the repo root (with a
 * trailing slash for a folder, so a file of the same name is not caught); `extension`
 * ignores every file with the same extension anywhere. Characters git treats as glob or
 * comment syntax are escaped. Null when there is no extension to ignore.
 */
export function gitignoreLine(
  relPath: string,
  isDirectory: boolean,
  pattern: GitignorePattern = 'path',
): string | null {
  const escapeGlob = (text: string): string => text.replace(/[*?[\]\\!#]/g, (c) => `\\${c}`);
  if (pattern === 'extension') {
    const { ext } = splitExtension(baseName(relPath));
    return isDirectory || !ext ? null : `*${escapeGlob(ext)}`;
  }
  const clean = relPath.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  return `/${escapeGlob(clean)}${isDirectory ? '/' : ''}`;
}

/** `content` of a .gitignore with `line` added at the end, or null when it is already there. */
export function appendGitignore(content: string, line: string): string | null {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes(line)) return null;
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const separator = content.length === 0 || /\r?\n$/.test(content) ? '' : eol;
  return `${content}${separator}${line}${eol}`;
}
