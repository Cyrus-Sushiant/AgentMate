import type { ProjectWordPressItemKind } from '../../types/index.js';
import { type DockerignoreMatcher, parseDockerignore } from '../dockerignore.js';
import {
  WP_MAX_PATH_BYTES,
  WP_MAX_SEGMENT_BYTES,
  type WpItemRef,
  type WpPathRejectReason,
} from './protocol.js';

/**
 * Which paths inside a theme, plugin or mu-plugin may travel between this computer and a site
 * (E19), the same on both sides: the desktop never sends or writes anything this refuses, and the
 * plugin refuses it again on its own. The order of the checks in validateWpItemPath is part of the
 * contract, since the shared vectors pin the reason for every case.
 *
 * Three layers keep agent and AgentMate files on this computer:
 * 1. Only the folders of linked items are walked, so anything at the project root (`.claude/`,
 *    `AGENTS.md`, `.agentmate/`) is never even looked at.
 * 2. The hard deny list below, matched against every path segment, without exceptions.
 * 3. Ignore rules (see createWpIgnoreRules): a default list for files that never belong on a site
 *    unless the site already has them, plus the user's own `.distignore` and `.agentmateignore`.
 */

/** Folders that hold agent settings, skills, AgentMate's own files, or version control. */
export const WP_HARD_DENY_DIRS: readonly string[] = [
  '.agentmate',
  // KNOWN_AGENT_DIRS in skills/installPaths.ts, and a few more assistants' folders.
  '.claude',
  '.agents',
  '.codex',
  '.cursor',
  '.windsurf',
  '.continue',
  '.factory',
  '.gemini',
  '.opencode',
  '.roo',
  '.kiro',
  '.amazonq',
  '.junie',
  '.clinerules',
  '.github',
  '.git',
  '.svn',
  '.hg',
  '.worktrees',
];

/** Files by exact name: agent instructions, MCP config, secrets, PHP config, OS clutter. */
export const WP_HARD_DENY_FILES: readonly string[] = [
  'agents.md',
  'claude.md',
  'claude.local.md',
  'gemini.md',
  '.mcp.json',
  'opencode.json',
  '.cursorrules',
  '.windsurfrules',
  '.roomodes',
  '.agentmateignore',
  '.env',
  '.envrc',
  // Package manager and network credentials.
  '.npmrc',
  'auth.json',
  '.netrc',
  '.git-credentials',
  '.user.ini',
  'php.ini',
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
];

/** Name prefixes: Aider's files, `.env.local` and friends, SSH private keys. */
export const WP_HARD_DENY_PREFIXES: readonly string[] = [
  '.aider',
  '.env.',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
];

/** Name suffixes: private keys and certificates. */
export const WP_HARD_DENY_SUFFIXES: readonly string[] = ['.pem', '.ppk'];

const DENY_NAMES: ReadonlySet<string> = new Set([...WP_HARD_DENY_DIRS, ...WP_HARD_DENY_FILES]);

/**
 * Left out by default, in gitignore-like syntax, but only while the site does not have them:
 * build output, editor folders and logs made on this computer stay here, while a plugin that
 * really ships a `skills/` or `node_modules/` folder is still pulled and kept in step. A `!` line
 * in an `.agentmateignore` puts any of these back.
 */
export const WP_DEFAULT_IGNORE: readonly string[] = [
  'node_modules/',
  '.vscode/',
  '.idea/',
  '.cache/',
  '.sass-cache/',
  '.phpunit.cache/',
  '*.log',
  '*.swp',
  '*~',
  '*.orig',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.distignore',
  '.nvmrc',
  '.phpunit.result.cache',
  '/skills/',
  '/agents/',
];

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it refuses.
const CONTROL = /[\u0000-\u001f\u007f]/;

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function segmentDenied(segment: string): boolean {
  // NFKC first, so lookalikes a case-insensitive disk may fold together (the long s in `.curſor`)
  // are judged as the name they become.
  const name = segment.normalize('NFKC').toLowerCase();
  if (DENY_NAMES.has(name)) return true;
  if (WP_HARD_DENY_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;
  return WP_HARD_DENY_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** True when any segment of the path is on the hard deny list (case-insensitive). */
export function isWpHardDenied(path: string): boolean {
  return path.split('/').some(segmentDenied);
}

/**
 * Checks a path relative to an item root. In order: empty, tooLong, controlChar, backslash,
 * absolute, driveLetter, colon; then for each segment from the left: emptySegment, traversal,
 * segmentTooLong, trailingDotOrSpace, reservedName; and last, hardDenied.
 */
export function validateWpItemPath(
  path: string,
): { ok: true } | { ok: false; reason: WpPathRejectReason } {
  if (path.length === 0) return { ok: false, reason: 'empty' };
  if (utf8Length(path) > WP_MAX_PATH_BYTES) return { ok: false, reason: 'tooLong' };
  if (CONTROL.test(path)) return { ok: false, reason: 'controlChar' };
  if (path.includes('\\')) return { ok: false, reason: 'backslash' };
  if (path.startsWith('/')) return { ok: false, reason: 'absolute' };
  if (/^[A-Za-z]:/.test(path)) return { ok: false, reason: 'driveLetter' };
  if (path.includes(':')) return { ok: false, reason: 'colon' };
  for (const segment of path.split('/')) {
    if (segment.length === 0) return { ok: false, reason: 'emptySegment' };
    if (segment === '.' || segment === '..') return { ok: false, reason: 'traversal' };
    if (utf8Length(segment) > WP_MAX_SEGMENT_BYTES) return { ok: false, reason: 'segmentTooLong' };
    if (segment.endsWith('.') || segment.endsWith(' ')) {
      return { ok: false, reason: 'trailingDotOrSpace' };
    }
    const base = segment.split('.')[0].toLowerCase();
    if (RESERVED.test(base)) return { ok: false, reason: 'reservedName' };
  }
  if (isWpHardDenied(path)) return { ok: false, reason: 'hardDenied' };
  return { ok: true };
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * A theme, plugin or mu-plugin name: a folder name, or for a single-file plugin or mu-plugin
 * its `.php` file name. Never a path, never on the deny list, never reserved on Windows.
 */
export function isValidWpSlug(slug: string): boolean {
  if (!SLUG.test(slug)) return false;
  return validateWpItemPath(slug).ok;
}

/** A single-file item's slug is its file name, which always ends in `.php`. */
export function isWpFileItemSlug(slug: string): boolean {
  return isValidWpSlug(slug) && slug.toLowerCase().endsWith('.php');
}

const ROOTS: Record<ProjectWordPressItemKind, string> = {
  theme: 'wp-content/themes',
  plugin: 'wp-content/plugins',
  'mu-plugin': 'wp-content/mu-plugins',
};

/** The item's root inside a project folder, `/`-separated: `wp-content/themes/<slug>`. */
export function wpItemRoot(item: WpItemRef): string {
  return `${ROOTS[item.kind]}/${item.slug}`;
}

/**
 * Where a file of an item lives inside the project folder. A single-file item has one path,
 * its slug, which maps to `wp-content/plugins/<slug>`.
 */
export function wpMirrorPath(item: WpItemRef, isFile: boolean, path: string): string {
  if (isFile) {
    if (path !== item.slug) throw new Error('A single-file item has only one path: its own name.');
    return wpItemRoot(item);
  }
  return `${wpItemRoot(item)}/${path}`;
}

/** A stable key for an item: `theme:twentytwentyfive`. */
export function wpItemKey(item: WpItemRef): string {
  return `${item.kind}:${item.slug}`;
}

/** Groups of paths that are the same file on a case-insensitive disk (Windows, macOS). */
export function findWpCaseCollisions(paths: readonly string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const key = path.toLowerCase();
    const group = groups.get(key);
    if (group) group.push(path);
    else groups.set(key, [path]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

/**
 * Turns one gitignore-like line into dockerignore syntax: a pattern with no slash before its end
 * matches at any depth (so `*.log` also catches `logs/debug.log`), a leading slash anchors it to
 * the item root, and a trailing slash is dropped (dockerignore has no folders-only form). Blank lines and
 * comments become blank lines, so line numbers in errors stay the user's.
 */
function toDockerignoreLine(raw: string, negations: boolean): string {
  const line = raw.replace(/\r$/, '').trim();
  if (line === '' || line.startsWith('#')) return '';
  const exception = line.startsWith('!');
  if (exception && !negations) return '';
  let pattern = exception ? line.slice(1).trim() : line;
  const anchored = pattern.startsWith('/');
  if (anchored) pattern = pattern.replace(/^\/+/, '');
  pattern = pattern.replace(/\/+$/, '');
  if (pattern === '') return '';
  if (!anchored && !pattern.includes('/')) pattern = `**/${pattern}`;
  return `${exception ? '!' : ''}${pattern}`;
}

export interface WpIgnoreLayer {
  /** Where the text came from, for error messages: `default`, `.distignore`, `.agentmateignore`. */
  source: string;
  text: string;
  /**
   * Whether `!` lines count. False for a file that can come from the site (an item's
   * `.distignore` is pulled with the theme or plugin), so a site can only leave more out, never
   * put a default-ignored local file back into a deploy. Defaults to true.
   */
  negations?: boolean;
}

export interface WpIgnoreRules {
  /**
   * Left out both ways, whatever the site has: the user's `.distignore` and `.agentmateignore`
   * layers. Paths are relative to the item root.
   */
  excluded(path: string): boolean;
  /**
   * Left out only while neither the site nor the last sync has the file: the default list, with
   * the user's layers able to put things back with `!`.
   */
  excludedUnlessTracked(path: string): boolean;
  /** For a walker: true when nothing inside this folder can be put back by a `!` line. */
  canSkipFolder(path: string): boolean;
}

function compileLayers(
  layers: readonly WpIgnoreLayer[],
):
  | { ok: true; matcher: DockerignoreMatcher }
  | { ok: false; source: string; line: number; reason: string } {
  const lines: string[] = [];
  for (const layer of layers) {
    const negations = layer.negations !== false;
    const converted = layer.text.split('\n').map((line) => toDockerignoreLine(line, negations));
    const parsed = parseDockerignore(converted.join('\n'));
    if (!parsed.ok)
      return { ok: false, source: layer.source, line: parsed.line, reason: parsed.reason };
    lines.push(...converted);
  }
  const parsed = parseDockerignore(lines.join('\n'));
  // Every layer parsed on its own, so the joined text cannot fail; kept as a guard.
  if (!parsed.ok)
    return { ok: false, source: 'combined', line: parsed.line, reason: parsed.reason };
  return { ok: true, matcher: parsed.matcher };
}

/**
 * Builds the ignore rules for one item from its layers, in order: the user's `.distignore` (from
 * the item root), then `.agentmateignore` from the project root, then `.agentmateignore` from the
 * item root. All of them match paths relative to the item root. The last matching line wins.
 */
export function createWpIgnoreRules(
  userLayers: readonly WpIgnoreLayer[],
):
  | { ok: true; rules: WpIgnoreRules }
  | { ok: false; source: string; line: number; reason: string } {
  const user = compileLayers(userLayers);
  if (!user.ok) return user;
  const combined = compileLayers([
    { source: 'default', text: WP_DEFAULT_IGNORE.join('\n') },
    ...userLayers,
  ]);
  if (!combined.ok) return combined;
  const userMatcher = user.matcher;
  const combinedMatcher = combined.matcher;
  return {
    ok: true,
    rules: {
      excluded: (path) => userMatcher.excludes(path),
      excludedUnlessTracked: (path) => combinedMatcher.excludes(path),
      canSkipFolder: (path) =>
        combinedMatcher.excludes(path) && combinedMatcher.canSkipFolder(path),
    },
  };
}
