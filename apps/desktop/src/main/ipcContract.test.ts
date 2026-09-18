import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IPC } from '../shared/ipcChannels';

/**
 * The preload and the main process meet only at a channel string. Nothing type
 * checks that pairing: a preload that invokes a channel main never registered
 * fails at runtime, as a rejected promise inside a feature nobody clicked
 * during review.
 *
 * So this test reads the source text of src/preload/index.ts and every file
 * under src/main, pulls the `IPC.group.member` references out of the
 * `ipcRenderer.invoke/send` and `ipcMain.handle/on` call sites, and compares
 * the two sets. It is deliberately textual: importing the modules would boot
 * the whole main process.
 */

const srcDir = fileURLToPath(new URL('..', import.meta.url));
const mainDir = join(srcDir, 'main');
const preloadFile = join(srcDir, 'preload', 'index.ts');

/**
 * Channels that legitimately appear in neither list. Each one needs a reason,
 * because the usual cause of an entry here is a half-wired feature.
 */
const ALLOWLIST = new Set<string>([
  // (empty: every channel in IPC is currently handled in main or subscribed to
  // in the preload. Add "group.member" here with a comment when a channel is
  // genuinely used some other way.)
]);

interface Leaf {
  /** Dotted reference the source writes, e.g. "git.status" for IPC.git.status. */
  path: string;
  channel: string;
}

function leavesOf(tree: Record<string, Record<string, string>>): Leaf[] {
  const leaves: Leaf[] = [];
  for (const [group, members] of Object.entries(tree)) {
    for (const [member, channel] of Object.entries(members)) {
      leaves.push({ path: `${group}.${member}`, channel });
    }
  }
  return leaves;
}

const leaves = leavesOf(IPC as unknown as Record<string, Record<string, string>>);
const channelByPath = new Map(leaves.map((leaf) => [leaf.path, leaf.channel]));

function tsFilesUnder(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...tsFilesUnder(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(full);
  }
  return files;
}

/**
 * Collects the `IPC.group.member` arguments matched by `pattern`.
 *
 * Every pattern below allows whitespace (including newlines) between the open
 * paren and the channel, because Biome wraps the long registrations in
 * src/main/ipc/* onto their own lines.
 */
function referencesIn(text: string, pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(pattern)) found.add(match[1]);
  return found;
}

/**
 * Registrations in main. `ipcMain.` is optional because src/main/ipc/vault.ts
 * wraps an injected `ipc.handle` in a local `handle()` that adds the
 * window guard and the vault error encoding, so its call sites read
 * `handle(IPC.vault.x, ...)`.
 */
const HANDLE =
  /(?:^|[^\w.])(?:ipcMain\.)?(?:handle|handleOnce|on|once)\(\s*IPC\.([A-Za-z0-9_]+\.[A-Za-z0-9_]+)/g;
/** Renderer -> main calls in the preload. */
const INVOKE = /ipcRenderer\.(?:invoke|send)\(\s*IPC\.([A-Za-z0-9_]+\.[A-Za-z0-9_]+)/g;
/**
 * Main -> renderer subscriptions in the preload. `subscribe(...)` is the local
 * helper most `onX` wrappers in src/preload/index.ts go through.
 */
const SUBSCRIBE = /(?:ipcRenderer\.(?:on|once)|subscribe)\(\s*IPC\.([A-Za-z0-9_]+\.[A-Za-z0-9_]+)/g;

const mainFiles = tsFilesUnder(mainDir);
const preloadText = readFileSync(preloadFile, 'utf-8');

const handled = new Set<string>();
for (const file of mainFiles) {
  for (const path of referencesIn(readFileSync(file, 'utf-8'), HANDLE)) handled.add(path);
}
const invoked = referencesIn(preloadText, INVOKE);
const subscribed = referencesIn(preloadText, SUBSCRIBE);

describe('IPC contract between the preload and main', () => {
  it('found sources to scan', () => {
    expect(mainFiles.length).toBeGreaterThan(50);
    expect(preloadText.length).toBeGreaterThan(10_000);
  });

  it('discovered channels on both sides, so a formatting change cannot pass empty', () => {
    // Without this floor, a rename or a reformat that stops the regexes from
    // matching would turn every assertion below into a comparison of two empty
    // sets and the suite would go green while the contract went unchecked.
    expect(invoked.size).toBeGreaterThan(150);
    expect(handled.size).toBeGreaterThan(150);
    expect(subscribed.size).toBeGreaterThan(20);
  });

  it('only matched references that exist in the IPC map', () => {
    // Catches the other failure mode of a textual scan: a regex that matches
    // something which is not a channel, or an IPC object reshaped so the
    // two-level `group.member` assumption no longer holds.
    const unknown = [...handled, ...invoked, ...subscribed].filter(
      (path) => !channelByPath.has(path),
    );
    expect(unknown.sort()).toEqual([]);
  });

  it('has a handler in main for every channel the preload invokes', () => {
    // The failure this catches is a renderer call that rejects with
    // "No handler registered for ..." the first time a user opens the feature.
    const missing = [...invoked]
      .filter((path) => !handled.has(path))
      .map((path) => `IPC.${path} ('${channelByPath.get(path)}') is invoked but never handled`);
    expect(missing.sort()).toEqual([]);
  });

  it('uses every channel in the IPC map', () => {
    // A leaf that is neither handled in main nor subscribed to in the preload
    // is dead weight at best, and at worst half of a feature whose other half
    // was never wired up.
    const unused = leaves
      .filter(
        (leaf) =>
          !handled.has(leaf.path) && !subscribed.has(leaf.path) && !ALLOWLIST.has(leaf.path),
      )
      .map((leaf) => `IPC.${leaf.path} ('${leaf.channel}') is declared but never wired up`);
    expect(unused.sort()).toEqual([]);
  });

  it('keeps the allowlist honest', () => {
    // An allowlist entry that is now handled or subscribed to should be
    // removed, otherwise it hides the next real break in that channel.
    const stale = [...ALLOWLIST].filter(
      (path) => !channelByPath.has(path) || handled.has(path) || subscribed.has(path),
    );
    expect(stale.sort()).toEqual([]);
  });

  it('does not register a handler for a main-to-renderer event channel', () => {
    // An `onX` channel is something main sends; registering a handler for it as
    // well would mean two different meanings for one string.
    const both = [...handled].filter((path) => subscribed.has(path));
    expect(both.sort()).toEqual([]);
  });
});
