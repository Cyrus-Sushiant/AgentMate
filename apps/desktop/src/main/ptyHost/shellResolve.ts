/**
 * Finding a shell to spawn and a folder to start it in, without ever throwing the generic
 * failure the terminal pane reports as "Could not start this terminal."
 *
 * macOS GUI launches are the reason this exists: an app started from the Finder inherits a
 * minimal environment (a bare PATH, sometimes no SHELL at all), and a user can also point SHELL
 * at something they later uninstalled or pass a project folder that has since been deleted.
 * Every lookup below degrades to the next candidate instead of failing, and says what it tried
 * so a bug report has something to go on. Pure and free of node-pty, so it is unit-testable.
 */

import { statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

export const ALLOWED_SHELLS = [
  'powershell.exe',
  'pwsh.exe',
  'cmd.exe',
  'bash',
  'zsh',
  'fish',
] as const;
export type AllowedShell = (typeof ALLOWED_SHELLS)[number];

/** The fallback shells per platform, most familiar first. The requested shell leads the chain. */
function platformFallbacks(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') return ['powershell.exe', 'pwsh.exe', 'cmd.exe'];
  if (platform === 'darwin') return ['zsh', 'bash', 'sh'];
  return ['bash', 'sh'];
}

/**
 * The shell a new terminal runs when the renderer did not name a usable one. The SHELL variable
 * is only trusted when it names a shell the app knows how to start; anything else (an exotic
 * shell, an empty string from a stripped GUI environment) falls back to the platform default
 * rather than being handed to the pty, which would fail to start it.
 */
export function defaultShellName(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env,
): AllowedShell {
  if (platform === 'win32') return 'powershell.exe';
  const base = env.SHELL?.split('/').pop()?.trim();
  if (base && (ALLOWED_SHELLS as readonly string[]).includes(base)) {
    return base as AllowedShell;
  }
  return platform === 'darwin' ? 'zsh' : 'bash';
}

/** The shells to try in order: what was asked for, then the platform fallbacks behind it. */
export function shellFallbackChain(shell: string, platform: NodeJS.Platform): string[] {
  const chain = [shell.trim()].filter((name) => name.length > 0);
  for (const fallback of platformFallbacks(platform)) {
    if (!chain.includes(fallback)) chain.push(fallback);
  }
  return chain;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Absolute paths on Windows may use either separator; node-pty needs no normalization. */
function isExplicitPath(shell: string): boolean {
  return isAbsolute(shell) || shell.includes('/') || shell.includes('\\');
}

/** Well-known folders a shell lives in even when a GUI launch left PATH bare. */
function wellKnownDirs(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    return [
      join(systemRoot, 'System32'),
      join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0'),
      'C:\\Program Files\\PowerShell\\7',
    ];
  }
  const dirs = ['/bin', '/usr/bin', '/usr/local/bin'];
  if (platform === 'darwin') dirs.push('/opt/homebrew/bin', '/opt/local/bin');
  return dirs;
}

function pathDirs(env: NodeJS.ProcessEnv): string[] {
  const path = env.PATH ?? env.Path ?? '';
  return path.split(delimiter).filter((dir) => dir.length > 0);
}

/**
 * Where this shell would be spawned from: itself when it is an existing absolute path, the
 * first PATH or well-known hit for a bare name, or null when it is not installed. A bare name
 * with no hit is still returned as-is on Windows, where CreateProcess resolves more than PATH
 * (App Paths, the current directory); everywhere else null means "try the next candidate".
 */
export function resolveShellFile(
  shell: string,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const name = shell.trim();
  if (!name) return null;
  if (isExplicitPath(name)) return isFile(name) ? name : null;
  const candidates = platform === 'win32' && !name.includes('.') ? [name, `${name}.exe`] : [name];
  const dirs = [...pathDirs(env), ...wellKnownDirs(platform)];
  for (const dir of dirs) {
    for (const candidate of candidates) {
      const full = join(dir, candidate);
      if (isFile(full)) return full;
    }
  }
  return platform === 'win32' ? name : null;
}

export interface SpawnTarget {
  /** The shell to actually spawn, after fallbacks. */
  shell: string;
  /** The file to hand to the pty (an absolute path when one was found, else the bare name). */
  file: string;
  /** The folder to start it in, guaranteed to exist. */
  cwd: string;
  /** Human-readable notes for the host log, e.g. what was fallen back from. */
  notes: string[];
}

/**
 * Picks a working (shell, folder) pair for a spawn. Never throws: when nothing resolves it
 * returns the best effort with notes explaining why, and the spawn's own try/catch turns a
 * remaining failure into a descriptive error instead of a blank pane.
 */
export function resolveSpawnTarget(options: {
  shell: string;
  cwd?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
}): SpawnTarget {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const notes: string[] = [];

  let shell = options.shell.trim() || defaultShellName(platform, env);
  let file = resolveShellFile(shell, platform, env);
  if (!file) {
    notes.push(`shell "${shell}" was not found, trying the platform fallbacks`);
    for (const candidate of shellFallbackChain(shell, platform).slice(1)) {
      const hit = resolveShellFile(candidate, platform, env);
      if (hit) {
        shell = candidate;
        file = hit;
        notes.push(`falling back to ${candidate}`);
        break;
      }
    }
  }
  if (!file) {
    // Last resort: hand the requested name to the OS and let its own error say why it failed.
    notes.push(`no fallback shell was found, spawning "${shell}" anyway for its error`);
    file = shell;
  }

  const cwd = resolveSpawnCwd(options.cwd, env, notes);
  return { shell, file, cwd, notes };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The folder a shell starts in. A project folder deleted or moved since the tab was created
 * must not cost the user their terminal: HOME (then the temp folder) takes over, and the
 * fallback is noted for the log.
 */
export function resolveSpawnCwd(
  cwd: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  notes: string[] = [],
): string {
  const home = env.HOME ?? env.USERPROFILE ?? homedir();
  if (cwd && cwd.trim().length > 0) {
    if (isDirectory(cwd)) return cwd;
    notes.push(`folder "${cwd}" is gone, starting in the home folder instead`);
  }
  if (home && isDirectory(home)) return home;
  const temp = tmpdir();
  if (temp !== home) notes.push(`home folder "${home}" is unusable, starting in "${temp}" instead`);
  return temp;
}
