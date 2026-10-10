'use strict';

/*
 * electron-builder afterPack hook (wired in electron-builder.yml): the staged app's node-pty
 * spawn-helper must be executable, or every terminal on macOS fails at runtime with the
 * cryptic "posix_spawnp failed" (node-pty 1.1.0 ships it without the bit; the postinstall fix
 * covers development, this covers what actually ships).
 *
 * For each staged copy of node-pty it re-runs the tested postinstall repair, then asserts the
 * macOS helpers are executable. A helper that is still not executable fails the packaging, so
 * a broken bit can never ship again. On a Windows build machine there are no mode bits to
 * check, so it only verifies the helpers are staged.
 *
 * The pure pieces are exported for tests (see src/afterPackSpawnHelper.test.ts).
 */

const { execFileSync } = require('node:child_process');
const { accessSync, constants, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

function defaultDeps() {
  return {
    platform: process.platform,
    exists: (path) => {
      try {
        statSync(path);
        return true;
      } catch {
        return false;
      }
    },
    isExecutable: (path) => {
      try {
        accessSync(path, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    },
    repair: (nodePtyDir) => {
      execFileSync(
        process.execPath,
        [join(__dirname, 'fix-node-pty-spawn-helper.mjs'), nodePtyDir],
        {
          stdio: 'pipe',
        },
      );
    },
  };
}

/**
 * Every staged copy of node-pty under the packed app: the unpacked files node-pty loads its
 * native binding (and the helper beside it) from at runtime.
 */
function findStagedNodePtyDirs(appOutDir, exists = defaultDeps().exists) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.name === 'node-pty' && full.includes('app.asar.unpacked')) {
        found.push(full);
        continue;
      }
      walk(full, depth + 1);
    }
  };
  walk(appOutDir, 0);
  if (found.length === 0 && exists(join(appOutDir, 'node-pty', 'package.json'))) {
    found.push(join(appOutDir, 'node-pty'));
  }
  return found;
}

/** The macOS helpers a staged node-pty would spawn through, when they are staged. */
function stagedMacHelpers(nodePtyDir, exists = defaultDeps().exists) {
  let platforms;
  try {
    platforms = readdirSync(join(nodePtyDir, 'prebuilds'));
  } catch {
    platforms = [];
  }
  const helpers = platforms
    .filter((platform) => platform.startsWith('darwin-'))
    .map((platform) => join(nodePtyDir, 'prebuilds', platform, 'spawn-helper'))
    .filter((helper) => exists(helper));
  for (const build of ['Release', 'Debug']) {
    const helper = join(nodePtyDir, 'build', build, 'spawn-helper');
    if (exists(helper)) helpers.push(helper);
  }
  return helpers;
}

/**
 * Repairs then asserts one staged copy. Returns the staged macOS helpers: verified everywhere
 * except on a Windows build machine, where mode bits cannot be checked. Throws when a helper
 * is still not executable afterwards, which fails the packaging.
 */
function verifyStagedNodePtyDir(nodePtyDir, deps = defaultDeps()) {
  deps.repair(nodePtyDir);
  const helpers = stagedMacHelpers(nodePtyDir, deps.exists);
  if (deps.platform === 'win32') return helpers;
  const broken = helpers.filter((helper) => !deps.isExecutable(helper));
  if (broken.length > 0) {
    throw new Error(
      `staged node-pty spawn-helper is not executable: ${broken.join(', ')}. ` +
        `Every macOS terminal would fail with "posix_spawnp failed".`,
    );
  }
  return helpers;
}

async function afterPackSpawnHelper(context) {
  const staged = findStagedNodePtyDirs(context.appOutDir);
  if (staged.length === 0) {
    // biome-ignore lint/suspicious/noConsole: packaging progress, like electron-builder's own
    console.warn('[after-pack] no staged node-pty found, skipping the spawn-helper check');
    return;
  }
  for (const dir of staged) {
    const helpers = verifyStagedNodePtyDir(dir);
    // biome-ignore lint/suspicious/noConsole: packaging progress, like electron-builder's own
    console.log(`[after-pack] spawn-helper OK (${helpers.length} macOS helpers in ${dir})`);
  }
}

// Assigned rather than an object literal so every loader gets the hook: require() returns the
// function, dynamic import() sees it as default, and the pieces stay importable for tests.
module.exports = afterPackSpawnHelper;
module.exports.default = afterPackSpawnHelper;
module.exports.findStagedNodePtyDirs = findStagedNodePtyDirs;
module.exports.stagedMacHelpers = stagedMacHelpers;
module.exports.verifyStagedNodePtyDir = verifyStagedNodePtyDir;
