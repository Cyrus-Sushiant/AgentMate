#!/usr/bin/env node
// Merges the two per-arch macOS update manifests (latest-mac-arm64.yml and
// latest-mac-x64.yml, one from each mac runner) into the single latest-mac.yml
// electron-updater reads. The arm64 file supplies everything but the `files:`
// list, which gets the x64 entries appended, so each Mac's updater can pick the
// zip for its own arch.
//
// Usage: node scripts/merge-mac-manifest.mjs <release-dir>

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// The `files:` key and the indented list under it, up to the next top-level key.
const FILES_BLOCK = /^files:\n((?:[ \t].*\n)+)/m;

function mergeManifests(arm64, x64) {
  if (arm64 == null) return x64;
  if (x64 == null) return arm64;
  const x64Files = FILES_BLOCK.exec(x64);
  if (!x64Files || !FILES_BLOCK.test(arm64)) {
    throw new Error('A macOS update manifest has no files: list to merge.');
  }
  return arm64.replace(FILES_BLOCK, (block) => block + x64Files[1]);
}

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/merge-mac-manifest.mjs <release-dir>');
  process.exit(1);
}
const read = (name) => {
  const path = join(dir, name);
  return existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
};
const merged = mergeManifests(read('latest-mac-arm64.yml'), read('latest-mac-x64.yml'));
if (merged == null) {
  console.log('No macOS update manifests found, nothing to merge.');
  process.exit(0);
}
writeFileSync(join(dir, 'latest-mac.yml'), merged);
rmSync(join(dir, 'latest-mac-arm64.yml'), { force: true });
rmSync(join(dir, 'latest-mac-x64.yml'), { force: true });
console.log(merged);
