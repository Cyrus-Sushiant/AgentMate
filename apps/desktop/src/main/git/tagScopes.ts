import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { TagScope } from '../../shared/apiTypes';
import { gitOrNull, isGitRepo } from './plumbing';
import { splitTagPrefix } from './versioning';

/** Enough parts for a big monorepo without turning the picker into a wall of buttons. */
const MAX_SCOPES = 16;
/** Folder globs to try when the repo declares no workspace of its own. */
const FALLBACK_GLOBS = ['apps/*', 'packages/*', 'services/*'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'vendor']);

/** A file whose presence means the folder is a package with a version of its own. */
const PART_MANIFESTS = [
  'package.json',
  'Cargo.toml',
  'pyproject.toml',
  'composer.json',
  'app.json',
  'build.gradle',
  'build.gradle.kts',
  'pubspec.yaml',
  'setup.py',
];

interface WorkspacePart {
  /** Repo-relative folder, with forward slashes. */
  path: string;
  /** Short name for the picker, e.g. "web". */
  name: string;
}

function readTextFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function listDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

/**
 * The `packages:` list out of pnpm-workspace.yaml, read line by line rather than with a
 * YAML parser: the file is a list of quoted globs and nothing else in every repo that has one.
 */
function readPnpmGlobs(cwd: string): string[] {
  const text =
    readTextFile(join(cwd, 'pnpm-workspace.yaml')) ?? readTextFile(join(cwd, 'pnpm-workspace.yml'));
  if (!text) return [];

  const globs: string[] = [];
  let inPackages = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trimEnd();
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = line.match(/^\s+-\s*['"]?([^'"]+?)['"]?\s*$/);
    if (item) {
      globs.push(item[1]);
      continue;
    }
    // A new top-level key ends the list; blank lines inside it are fine.
    if (line.trim() && !/^\s/.test(line)) break;
  }
  return globs;
}

function readNpmGlobs(cwd: string): string[] {
  const text = readTextFile(join(cwd, 'package.json'));
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as { workspaces?: string[] | { packages?: string[] } };
    const workspaces = parsed.workspaces;
    if (Array.isArray(workspaces)) return workspaces;
    if (workspaces && Array.isArray(workspaces.packages)) return workspaces.packages;
  } catch {
    // A package.json we cannot parse just means no workspaces to read.
  }
  return [];
}

/** `members = [...]` from a Cargo workspace, matched loosely enough to survive formatting. */
function readCargoGlobs(cwd: string): string[] {
  const text = readTextFile(join(cwd, 'Cargo.toml'));
  if (!text || !/^\s*\[workspace]/m.test(text)) return [];
  const list = text.match(/members\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  return [...list.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

/**
 * Folders a glob points at. Only the `*` and `**` forms workspaces actually use are
 * supported, and `**` is walked a couple of levels deep rather than to the bottom of the tree.
 */
function expandGlob(cwd: string, glob: string): string[] {
  const segments = glob.replace(/\\/g, '/').replace(/^\.\//, '').split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('!'))) return [];

  let matches = [''];
  for (const segment of segments) {
    const next: string[] = [];
    for (const base of matches) {
      const absolute = base ? join(cwd, base) : cwd;
      if (!isDirectory(absolute)) continue;

      if (segment !== '*' && segment !== '**') {
        const candidate = base ? `${base}/${segment}` : segment;
        if (isDirectory(join(cwd, candidate))) next.push(candidate);
        continue;
      }

      for (const child of listDir(absolute)) {
        if (child.startsWith('.') || SKIPPED_DIRS.has(child)) continue;
        const candidate = base ? `${base}/${child}` : child;
        if (!isDirectory(join(cwd, candidate))) continue;
        next.push(candidate);
        // `**` also matches one level further down, which covers the usual "packages/**".
        if (segment === '**') next.push(...expandGlob(cwd, `${candidate}/*`));
      }
    }
    matches = next;
    if (matches.length === 0) break;
  }
  return matches.filter(Boolean);
}

function readPartName(cwd: string, path: string): string {
  const basename = path.split('/').pop() ?? path;
  const text = readTextFile(join(cwd, path, 'package.json'));
  if (!text) return basename;
  try {
    const name = (JSON.parse(text) as { name?: string }).name;
    if (!name) return basename;
    // A scoped package reads better as "web" than "@acme/web" in a picker.
    return name.includes('/') ? (name.split('/').pop() ?? basename) : name;
  } catch {
    return basename;
  }
}

/** Workspace packages of a monorepo, or an empty list for a plain single-package repo. */
export function detectWorkspaceParts(cwd: string): WorkspacePart[] {
  const declared = [...readPnpmGlobs(cwd), ...readNpmGlobs(cwd), ...readCargoGlobs(cwd)];
  const globs = declared.length > 0 ? declared : FALLBACK_GLOBS;

  const paths = new Set<string>();
  for (const glob of globs) {
    for (const path of expandGlob(cwd, glob)) {
      if (PART_MANIFESTS.some((manifest) => existsSync(join(cwd, path, manifest)))) paths.add(path);
      else if (listDir(join(cwd, path)).some((file) => file.endsWith('.csproj'))) paths.add(path);
    }
  }

  return [...paths]
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({ path, name: readPartName(cwd, path) }));
}

/** Turns a part name into something git will take in front of a version, e.g. "web-v". */
function suggestPrefix(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${slug}-v` : 'v';
}

interface TagGroup {
  prefix: string;
  latestTag: string;
  count: number;
}

/** Existing tags grouped by what comes before the version, newest tag first in each group. */
function groupTagsByPrefix(tags: string[]): Map<string, TagGroup> {
  const groups = new Map<string, TagGroup>();
  for (const tag of tags) {
    const split = splitTagPrefix(tag);
    if (!split) continue;
    const existing = groups.get(split.prefix);
    if (existing) existing.count += 1;
    else groups.set(split.prefix, { prefix: split.prefix, latestTag: tag, count: 1 });
  }
  return groups;
}

/**
 * The tag group belonging to a part, when the repo already tags it. Matching is on the
 * part's name appearing in the prefix, which covers `web-v`, `web/v`, `@acme/web@` and `web@`.
 */
function findGroupForPart(groups: Map<string, TagGroup>, name: string): TagGroup | null {
  const needle = name.toLowerCase();
  for (const group of groups.values()) {
    const prefix = group.prefix.toLowerCase();
    if (prefix && new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(prefix)) {
      return group;
    }
  }
  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The folder a lone tag prefix like `web-v` probably belongs to, or empty if there is none. */
function guessPathForPrefix(cwd: string, prefix: string): string {
  const word = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .pop();
  if (!word || word === 'v') return '';
  for (const parent of ['apps', 'packages', 'services', '']) {
    const candidate = parent ? `${parent}/${word}` : word;
    if (isDirectory(join(cwd, candidate))) return candidate;
  }
  return '';
}

/**
 * The taggable parts of a repository: the repo as a whole, plus one scope per workspace
 * package and per tag prefix already in use. Each scope carries the prefix its tags use,
 * so tagging the web app cuts `web-v1.4.0` and only ever touches the web app's files.
 */
export async function readTagScopes(cwd: string): Promise<TagScope[]> {
  if (!(await isGitRepo(cwd))) {
    return [
      {
        id: 'repo',
        label: 'Whole repository',
        prefix: 'v',
        path: '',
        latestTag: null,
        tagCount: 0,
      },
    ];
  }

  const tags = ((await gitOrNull(cwd, ['tag', '--sort=-creatordate'])) ?? '')
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const groups = groupTagsByPrefix(tags);

  // The repo-wide scope keeps whatever plain style this repo already uses: "v1.2.3" for
  // most, bare "1.2.3" for the repos that tag that way.
  const bare = groups.get('');
  const vStyle = groups.get('v');
  const rootGroup =
    vStyle && bare ? (vStyle.count >= bare.count ? vStyle : bare) : (vStyle ?? bare);
  const rootScope: TagScope = {
    id: 'repo',
    label: 'Whole repository',
    prefix: rootGroup?.prefix ?? 'v',
    path: '',
    latestTag: rootGroup?.latestTag ?? null,
    tagCount: rootGroup?.count ?? 0,
  };

  const scopes: TagScope[] = [rootScope];
  const usedPrefixes = new Set([rootScope.prefix]);

  for (const part of detectWorkspaceParts(cwd)) {
    const group = findGroupForPart(groups, part.name);
    const prefix = group?.prefix ?? suggestPrefix(part.name);
    if (usedPrefixes.has(prefix)) continue;
    usedPrefixes.add(prefix);
    scopes.push({
      id: `part:${part.path}`,
      label: part.name,
      prefix,
      path: part.path,
      latestTag: group?.latestTag ?? null,
      tagCount: group?.count ?? 0,
    });
  }

  // Prefixes the repo tags with but that match no folder we found. They stay offered, since
  // the user clearly releases something under them.
  for (const group of groups.values()) {
    if (usedPrefixes.has(group.prefix) || !group.prefix) continue;
    usedPrefixes.add(group.prefix);
    scopes.push({
      id: `prefix:${group.prefix}`,
      label: group.prefix.replace(/[-_/@]*v?$/i, '') || group.prefix,
      prefix: group.prefix,
      path: guessPathForPrefix(cwd, group.prefix),
      latestTag: group.latestTag,
      tagCount: group.count,
    });
  }

  // Parts nobody has tagged sit below the ones that carry real releases.
  const ranked = [
    scopes[0],
    ...scopes.slice(1).sort((a, b) => b.tagCount - a.tagCount || a.label.localeCompare(b.label)),
  ];
  return ranked.slice(0, MAX_SCOPES);
}
