import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * Images written for an agent CLI to pick up by path: screenshots pasted into a terminal and
 * crops of page elements picked in the workspace browser. Claude Code and Codex attach an image
 * given its path, so a file is all they need. They are only needed for the session they were made
 * in, so the folder is swept of anything older than a week whenever a new one is written.
 */

const KEEP_PASTED_MS = 7 * 24 * 60 * 60 * 1000;

function pastedDir(): string {
  return join(app.getPath('userData'), 'pasted-images');
}

async function pruneOld(dir: string): Promise<void> {
  const cutoff = Date.now() - KEEP_PASTED_MS;
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    const path = join(dir, name);
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs < cutoff) await rm(path, { force: true }).catch(() => undefined);
  }
}

/** Writes image bytes as `<prefix>-<timestamp>-<id>.<extension>` and returns the file's path. */
export async function savePastedImage(
  bytes: Uint8Array,
  extension: string,
  prefix = 'pasted',
): Promise<string> {
  const dir = pastedDir();
  await mkdir(dir, { recursive: true });
  void pruneOld(dir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `${prefix}-${stamp}-${randomUUID().slice(0, 6)}.${extension}`);
  await writeFile(path, bytes);
  return path;
}
