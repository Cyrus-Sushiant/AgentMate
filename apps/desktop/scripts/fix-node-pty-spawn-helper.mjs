// node-pty starts every terminal on macOS through a small program, spawn-helper. Version 1.1.0
// publishes it without the execute bit, so every shell and agent tab failed with "posix_spawnp
// failed". This runs after install and sets the bit again. The packaged app keeps it, since
// electron-builder copies file modes.
//
// Usage: node scripts/fix-node-pty-spawn-helper.mjs [node-pty folder]
// Without a folder it fixes the node-pty this package resolves.

import { chmodSync, copyFileSync, existsSync, readdirSync, renameSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const EXECUTABLE = 0o111;

/** Makes each prebuilt spawn-helper under `nodePtyDir` executable. Returns the ones it changed. */
function makeSpawnHelpersExecutable(nodePtyDir) {
  const prebuilds = join(nodePtyDir, 'prebuilds');
  if (!existsSync(prebuilds)) return [];
  const fixed = [];
  for (const platform of readdirSync(prebuilds)) {
    const helper = join(prebuilds, platform, 'spawn-helper');
    if (!existsSync(helper)) continue;
    if ((statSync(helper).mode & EXECUTABLE) === EXECUTABLE) continue;
    // A fresh copy rather than a chmod in place: pnpm hard links package files to its shared
    // store, and the store's copy is not this install's to change.
    const copy = `${helper}.tmp`;
    copyFileSync(helper, copy);
    chmodSync(copy, 0o755);
    renameSync(copy, helper);
    fixed.push(helper);
  }
  return fixed;
}

// Windows has no execute bit, and node-pty starts its terminals another way there.
if (process.platform !== 'win32') {
  const target =
    process.argv[2] ?? dirname(createRequire(import.meta.url).resolve('node-pty/package.json'));
  for (const helper of makeSpawnHelpersExecutable(target)) {
    process.stdout.write(`Made ${helper} executable\n`);
  }
}
