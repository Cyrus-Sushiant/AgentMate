import { dirOf, joinRel, relativeTo } from '../paths.js';
import type { TestProject, TestRef } from '../types.js';
import type { RunContext } from './types.js';

export const isWindows = (ctx: RunContext): boolean => ctx.platform === 'win32';

/** An absolute path inside the run's report folder. */
export function reportPath(ctx: RunContext, name: string): string {
  return `${ctx.reportDir}${isWindows(ctx) ? '\\' : '/'}${name}`;
}

/** A workspace relative file as the runner sees it from the project folder. */
export function fromProject(project: TestProject, file: string): string {
  return relativeTo(file, project.root);
}

export function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** Every folder from the project root up to the workspace root, deepest first. */
function foldersUp(project: TestProject): string[] {
  const folders: string[] = [];
  let dir = project.root;
  for (;;) {
    folders.push(dir);
    if (dir === '') break;
    dir = dirOf(dir);
  }
  return folders;
}

/**
 * A path to run from the project folder: `..\..\node_modules\.bin\x.cmd` on Windows,
 * `./node_modules/.bin/x` on POSIX so the shell does not look it up on PATH.
 */
function commandFromProject(project: TestProject, target: string, ctx: RunContext): string {
  const from = project.root === '' ? [] : project.root.split('/');
  const to = target.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common += 1;
  const parts = [...Array<string>(from.length - common).fill('..'), ...to.slice(common)];
  if (isWindows(ctx)) return parts.join('\\');
  const joined = parts.join('/');
  return joined.startsWith('..') ? joined : `./${joined}`;
}

/** The closest workspace relative file named `rel` in the project folder or any folder above. */
export function findUp(project: TestProject, rel: string, ctx: RunContext): string | null {
  for (const dir of foldersUp(project)) {
    const candidate = joinRel(dir, rel);
    if (ctx.exists(candidate)) return candidate;
  }
  return null;
}

export function localCommand(project: TestProject, rel: string, ctx: RunContext): string | null {
  const found = findUp(project, rel, ctx);
  return found ? commandFromProject(project, found, ctx) : null;
}

/** A file in the project folder itself, as a command. */
export function projectCommand(project: TestProject, name: string, ctx: RunContext): string | null {
  const path = joinRel(project.root, name);
  return ctx.exists(path) ? commandFromProject(project, path, ctx) : null;
}

/**
 * How to start a Node test runner: the package's own bin when installed, otherwise the package
 * manager the lockfile points at, and `npx --no-install` so nothing gets downloaded by surprise.
 */
export function nodeRunner(
  project: TestProject,
  bin: string,
  ctx: RunContext,
): { command: string; prefix: string[] } {
  const local = localCommand(
    project,
    `node_modules/.bin/${bin}${isWindows(ctx) ? '.cmd' : ''}`,
    ctx,
  );
  if (local) return { command: local, prefix: [] };
  if (findUp(project, 'pnpm-lock.yaml', ctx)) return { command: 'pnpm', prefix: ['exec', bin] };
  if (findUp(project, 'yarn.lock', ctx)) return { command: 'yarn', prefix: [bin] };
  if (findUp(project, 'bun.lock', ctx) || findUp(project, 'bun.lockb', ctx)) {
    return { command: 'bunx', prefix: [bin] };
  }
  return { command: 'npx', prefix: ['--no-install', bin] };
}

export function pythonCommand(project: TestProject, ctx: RunContext): string {
  const inside = isWindows(ctx) ? 'Scripts/python.exe' : 'bin/python';
  for (const venv of ['.venv', 'venv']) {
    const found = localCommand(project, `${venv}/${inside}`, ctx);
    if (found) return found;
  }
  return isWindows(ctx) ? 'python' : 'python3';
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** A regex matching exactly one of these names. */
export function exactNames(names: readonly string[]): string {
  return `^(?:${unique(names).map(escapeRegex).join('|')})$`;
}

export function filesOf(project: TestProject, refs: readonly TestRef[]): string[] {
  return unique(refs.map((ref) => fromProject(project, ref.file)));
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ESC starts every ANSI sequence
const ANSI = /\u001B\[[0-9;?]*[A-Za-z]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

export function cleanText(text: string | undefined | null): string | undefined {
  if (text === undefined || text === null) return undefined;
  const cleaned = stripAnsi(text).replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  return cleaned.replace(/^\n+/, '') || undefined;
}

/** Splits `Error: message\n    at frame` style text into the message and the stack below it. */
export function splitStack(text: string | undefined): { message?: string; stack?: string } {
  const cleaned = cleanText(text);
  if (!cleaned) return {};
  const lines = cleaned.split('\n');
  const index = lines.findIndex((line) => /^\s+at\s/.test(line));
  if (index <= 0) return { message: cleaned };
  return {
    message: cleanText(lines.slice(0, index).join('\n')),
    stack: lines.slice(index).join('\n'),
  };
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Drops keys whose value is undefined so results compare cleanly. */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
