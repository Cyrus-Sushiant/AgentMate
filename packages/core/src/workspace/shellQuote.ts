/**
 * Quoting for text typed into an interactive shell: a dropped file path, or an argument in a
 * launch command. Each shell family has its own rules, and getting them wrong either breaks
 * paths with spaces or, worse, runs part of a file name as a command.
 */

export type ShellKind = 'powershell' | 'cmd' | 'posix' | 'fish';

export function shellKindFor(shell: string | undefined, platform: string): ShellKind {
  const name = (shell ?? '').toLowerCase().replace(/\\/g, '/').split('/').pop() ?? '';
  if (
    name === 'powershell.exe' ||
    name === 'pwsh.exe' ||
    name === 'pwsh' ||
    name === 'powershell'
  ) {
    return 'powershell';
  }
  if (name === 'cmd.exe' || name === 'cmd') return 'cmd';
  if (name === 'fish') return 'fish';
  if (name === 'bash' || name === 'zsh' || name === 'sh') return 'posix';
  return platform === 'win32' ? 'powershell' : 'posix';
}

/** Characters every shell here treats literally, so such a word needs no quotes at all. */
const SAFE_WORD = /^[A-Za-z0-9_@%+=:,./\\-]+$/;

export function quoteForShell(value: string, kind: ShellKind): string {
  // A backslash is an escape character in POSIX shells and fish, but literal on Windows.
  const backslashIsSpecial = kind === 'posix' || kind === 'fish';
  if (value.length > 0 && SAFE_WORD.test(value) && !(backslashIsSpecial && value.includes('\\'))) {
    return value;
  }
  switch (kind) {
    case 'powershell':
      // Single quotes are literal in PowerShell; a quote inside is written twice.
      return `'${value.replace(/'/g, "''")}'`;
    case 'cmd':
      return `"${value.replace(/"/g, '""')}"`;
    case 'fish':
      return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    case 'posix':
      return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}

/** Joins several values as separate words, e.g. multiple dropped files. */
export function quoteAllForShell(values: string[], kind: ShellKind): string {
  return values.map((value) => quoteForShell(value, kind)).join(' ');
}
