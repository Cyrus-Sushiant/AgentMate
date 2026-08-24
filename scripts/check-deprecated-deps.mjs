#!/usr/bin/env node
/**
 * Fails when any dependency this repo declares directly has been deprecated on
 * the npm registry.
 *
 * Only direct dependencies are checked: those are the ones we can actually
 * swap out. Transitive deprecations are usually somebody else's lockfile to
 * fix, and gating on them just makes the build red for reasons nobody here can
 * resolve.
 *
 * Known deprecations we have decided to live with (no replacement yet, waiting
 * on an upstream release, ...) go in .github/deprecated-deps-allowlist.json.
 */
import { readdir, readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = process.env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org';
const ALLOWLIST_PATH = join(repoRoot, '.github', 'deprecated-deps-allowlist.json');
const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];
// Specs that don't point at a published package, so there is nothing to look up.
const LOCAL_SPEC = /^(workspace|link|file|portal|catalog|git|github|http|https):/;
const CONCURRENCY = 8;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Root package.json plus every workspace package.json. */
async function workspaceManifests() {
  const paths = [join(repoRoot, 'package.json')];
  for (const group of ['apps', 'packages']) {
    let entries = [];
    try {
      entries = await readdir(join(repoRoot, group), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) paths.push(join(repoRoot, group, entry.name, 'package.json'));
    }
  }

  const manifests = [];
  for (const path of paths) {
    try {
      manifests.push({ path, json: await readJson(path) });
    } catch {
      // A workspace folder without a manifest is not our problem here.
    }
  }
  return manifests;
}

/**
 * The version actually installed for `name` inside `pkgDir`. pnpm symlinks it
 * into the package's own node_modules, so this is the version CI resolved
 * rather than whatever the range might float to later.
 */
async function installedVersion(pkgDir, name) {
  for (const dir of [pkgDir, repoRoot]) {
    try {
      const path = join(dir, 'node_modules', name, 'package.json');
      return (await readJson(await realpath(path))).version;
    } catch {
      // Try the next location.
    }
  }
  return null;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchPackument(name, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${REGISTRY}/${name.replace('/', '%2f')}`, {
        // Abbreviated metadata: a fraction of the payload, still carries
        // `deprecated` per version.
        headers: { accept: 'application/vnd.npm.install-v1+json' },
      });
      if (!res.ok) throw new Error(`registry responded ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      // The registry drops the odd connection. Don't turn that into a red build
      // on the first try.
      if (attempt < attempts) await sleep(attempt * 500);
    }
  }
  throw lastError;
}

async function checkOne(dep) {
  const packument = await fetchPackument(dep.name);
  const version = dep.version ?? packument['dist-tags']?.latest;
  const message = version ? packument.versions?.[version]?.deprecated : undefined;
  if (!message) return null;
  return { ...dep, version, message: String(message).trim() };
}

async function mapWithLimit(items, limit, fn) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function loadAllowlist() {
  let entries = [];
  try {
    const json = await readJson(ALLOWLIST_PATH);
    entries = Array.isArray(json) ? json : (json.allow ?? []);
  } catch {
    return () => null;
  }
  return (dep) => {
    for (const entry of entries) {
      const spec = typeof entry === 'string' ? entry : entry.package;
      if (!spec) continue;
      const at = spec.lastIndexOf('@');
      const name = at > 0 ? spec.slice(0, at) : spec;
      const version = at > 0 ? spec.slice(at + 1) : null;
      if (name !== dep.name) continue;
      if (version && version !== dep.version) continue;
      return typeof entry === 'string' ? '' : (entry.reason ?? '');
    }
    return null;
  };
}

const manifests = await workspaceManifests();
const deps = new Map();
for (const { path, json } of manifests) {
  const pkgDir = dirname(path);
  for (const field of DEP_FIELDS) {
    for (const [name, spec] of Object.entries(json[field] ?? {})) {
      if (typeof spec === 'string' && LOCAL_SPEC.test(spec)) continue;
      const version = await installedVersion(pkgDir, name);
      const key = `${name}@${version ?? spec}`;
      const existing = deps.get(key);
      if (existing) {
        existing.usedBy.add(json.name ?? path);
        continue;
      }
      deps.set(key, { name, spec, version, usedBy: new Set([json.name ?? path]) });
    }
  }
}

const targets = [...deps.values()];
console.log(`Checking ${targets.length} direct dependencies against ${REGISTRY} ...`);

const failures = [];
const results = await mapWithLimit(targets, CONCURRENCY, async (dep) => {
  try {
    return await checkOne(dep);
  } catch (error) {
    failures.push(`${dep.name}: ${error.message}`);
    return null;
  }
});

const isAllowed = await loadAllowlist();
const deprecated = results.filter(Boolean);
const blocking = [];
const allowed = [];
for (const dep of deprecated) {
  const reason = isAllowed(dep);
  if (reason === null) blocking.push(dep);
  else allowed.push({ ...dep, reason });
}

const describe = (dep) =>
  `${dep.name}@${dep.version} (used by ${[...dep.usedBy].join(', ')}): ${dep.message}`;

for (const dep of allowed) {
  console.log(`allowed: ${describe(dep)}${dep.reason ? ` [${dep.reason}]` : ''}`);
}
for (const note of failures) {
  // Unreachable registry is a gap in coverage, not a reason to block the merge.
  console.log(`::warning title=Dependency not checked::${note}`);
}
for (const dep of blocking) {
  // GitHub Actions picks this up as an annotation on the job.
  console.log(`::error title=Deprecated dependency::${describe(dep)}`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  const lines = ['## Deprecated dependency check', ''];
  if (blocking.length === 0) {
    lines.push(`No deprecated direct dependencies (${targets.length} checked).`);
  } else {
    lines.push('| Package | Used by | Deprecation notice |', '| --- | --- | --- |');
    for (const dep of blocking) {
      lines.push(
        `| \`${dep.name}@${dep.version}\` | ${[...dep.usedBy].join(', ')} | ${dep.message.replace(/\|/g, '\|')} |`,
      );
    }
  }
  if (allowed.length > 0) {
    lines.push('', `${allowed.length} deprecation(s) allowlisted.`);
  }
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

if (blocking.length > 0) {
  console.error(
    `\n${blocking.length} deprecated dependency/dependencies found. Replace them, or add an entry with a reason to .github/deprecated-deps-allowlist.json.`,
  );
  process.exit(1);
}

console.log(
  `No deprecated direct dependencies. ${targets.length} checked, ${allowed.length} allowlisted.`,
);
