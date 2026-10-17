import type { CommandPrerequisite } from '../shared/apiTypes';
import { resolveExecutable } from './installMethod';
import { refreshWindowsPath } from './windowsPath';

/**
 * An install command typed into a terminal fails with "npm is not recognized" when Node.js is
 * missing, which reads like the app is broken. Before typing it in, the renderer asks which
 * program the command starts with and whether this machine has it, so it can point at the
 * download page instead.
 */

const NODE: CommandPrerequisite = { name: 'Node.js', url: 'https://nodejs.org/en/download' };
const PYTHON: CommandPrerequisite = { name: 'Python', url: 'https://www.python.org/downloads/' };

const PREREQUISITES: Record<string, CommandPrerequisite> = {
  npm: NODE,
  npx: NODE,
  pipx: { name: 'pipx', url: 'https://pipx.pypa.io/stable/installation/' },
  pip: PYTHON,
  pip3: PYTHON,
  python: PYTHON,
  python3: PYTHON,
  py: PYTHON,
  brew: { name: 'Homebrew', url: 'https://brew.sh' },
  winget: {
    name: 'WinGet (App Installer)',
    url: 'https://learn.microsoft.com/windows/package-manager/winget/',
  },
  cargo: { name: 'Rust', url: 'https://rustup.rs' },
};

/**
 * Splits a shell line into its statements on `;`, `&&`, `||` and newlines, leaving separators
 * inside quotes alone. The Semgrep command on Windows sets PATH first with a quoted value full of
 * semicolons, and splitting inside it would turn the tail of that value into a "command".
 */
export function splitStatements(command: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < command.length; i++) {
    const char = command[i] as string;
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    const pair = command.slice(i, i + 2);
    if (pair === '&&' || pair === '||') {
      statements.push(current);
      current = '';
      i++;
      continue;
    }
    if (char === ';' || char === '\n' || char === '\r') {
      statements.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  statements.push(current);
  return statements.map((one) => one.trim()).filter(Boolean);
}

/** The program a statement runs, lowercased and without `.exe`/`.cmd`, skipping a leading sudo. */
export function programOf(statement: string): string {
  const words = statement.trim().split(/\s+/);
  const first = words[0] === 'sudo' ? (words[1] ?? '') : (words[0] ?? '');
  return first.toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
}

/**
 * The programs in `command` that need something installed first, in the order they run, each with
 * what to install. curl, irm and the like ship with the OS, so they never appear here.
 */
export function prerequisiteCandidates(
  command: string,
): Array<{ program: string; prerequisite: CommandPrerequisite }> {
  const seen = new Set<string>();
  const candidates: Array<{ program: string; prerequisite: CommandPrerequisite }> = [];
  for (const statement of splitStatements(command)) {
    const program = programOf(statement);
    const prerequisite = Object.hasOwn(PREREQUISITES, program) ? PREREQUISITES[program] : undefined;
    if (!prerequisite || seen.has(program)) continue;
    seen.add(program);
    candidates.push({ program, prerequisite });
  }
  return candidates;
}

/** The first thing `command` needs that this machine does not have, or null when it is all there. */
export async function checkCommandPrerequisite(
  command: string,
): Promise<CommandPrerequisite | null> {
  const candidates = prerequisiteCandidates(command);
  if (candidates.length === 0) return null;
  // Node.js installed since the app started is on the registry PATH but not on ours yet.
  await refreshWindowsPath();
  for (const { program, prerequisite } of candidates) {
    if (!(await resolveExecutable([program]))) return prerequisite;
  }
  return null;
}
