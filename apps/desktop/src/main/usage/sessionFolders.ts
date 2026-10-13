// Which folder a session ran in, read off its transcript. Pure, so the scan worker can use it too.
//
// Claude Code names each project directory after the folder it was launched in, with every
// character that is not a letter or a digit turned into a dash. A session that cds into a subfolder
// keeps writing that subfolder as its `cwd`, so the launch folder is recovered by encoding a few
// cwds and matching them against the directory name. Codex records the folder once, on the first
// line of each rollout.

const CWD_PATTERN = /"cwd":"((?:[^"\\]|\\.)*)"/;

/** Claude Code's directory name for a folder. Length-preserving, one dash per UTF-16 unit. */
export function encodeClaudeDir(folder: string): string {
  return folder.replace(/[^a-zA-Z0-9]/g, '-');
}

/** The `cwd` written on one JSONL line, or null when the line has none. */
export function cwdFromLine(line: string): string | null {
  if (!line.includes('"cwd":"')) return null;
  const match = CWD_PATTERN.exec(line);
  if (!match) return null;
  try {
    const cwd = JSON.parse(`"${match[1]}"`) as unknown;
    return typeof cwd === 'string' && cwd !== '' ? cwd : null;
  } catch {
    return null;
  }
}

/** The distinct cwds among `lines`, in order, up to `limit`. */
export function cwdsIn(lines: readonly string[], limit = 50): string[] {
  const found: string[] = [];
  for (const line of lines) {
    const cwd = cwdFromLine(line);
    if (cwd && !found.includes(cwd)) {
      found.push(cwd);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/**
 * The launch folder behind a Claude Code project directory, given cwds seen in it. Encoding keeps
 * each character's position, so a cwd that starts with the folder is the folder's own name for the
 * first `dirName.length` characters, provided the next character is a separator or the end.
 */
export function launchFolder(dirName: string, cwds: readonly string[]): string | null {
  for (const cwd of cwds) {
    if (cwd.length < dirName.length) continue;
    const candidate = cwd.slice(0, dirName.length);
    const next = cwd.charAt(dirName.length);
    // A drive root such as `E:\` already ends in a separator, so it has no separator after it.
    const atBoundary = next === '' || next === '/' || next === '\\' || /[\\/]$/.test(candidate);
    if (!atBoundary) continue;
    if (encodeClaudeDir(candidate).toLowerCase() === dirName.toLowerCase()) return candidate;
  }
  return null;
}

/** The project directory (the first folder under `root`) that holds `file`, or null for a file in `root` itself. */
export function topLevelDir(root: string, file: string): string | null {
  const base = root.replace(/[\\/]+$/, '');
  if (!file.startsWith(base)) return null;
  const rest = file.slice(base.length).replace(/^[\\/]+/, '');
  const parts = rest.split(/[\\/]/);
  return parts.length > 1 && parts[0] !== '' ? parts[0] : null;
}

/** The folder a Codex rollout records on its `session_meta` line, or on a `turn_context` line. */
export function codexCwdFromHead(lines: readonly string[]): string | null {
  for (const line of lines) {
    if (!line.includes('"session_meta"') && !line.includes('"turn_context"')) continue;
    const cwd = cwdFromLine(line);
    if (cwd) return cwd;
  }
  return null;
}
