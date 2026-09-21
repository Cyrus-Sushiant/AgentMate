/**
 * Two ways to list AVDs, and both are needed.
 *
 * `emulator -list-avds` is fast and always present, but gives nothing but ids. `avdmanager list
 * avd` gives the detail the cards want, but needs the command-line tools and a Java runtime, and
 * prints a loosely indented block format rather than anything machine readable.
 */

export interface AvdListEntry {
  name: string;
  device: string | null;
  path: string | null;
  target: string | null;
  /** From the `Based on: Android 14.0 (...)` continuation line. */
  androidVersion: string | null;
  tag: string | null;
  abi: string | null;
  playStore: boolean;
  skin: string | null;
  sdcard: string | null;
}

export interface BrokenAvd {
  name: string;
  path: string | null;
  error: string;
}

/** Progress and crash-handler chatter the emulator prints on stdout before the list itself. */
const EMULATOR_NOISE = /^(INFO|WARNING|ERROR|DEBUG)\s*\|/;

export function parseEmulatorListAvds(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !EMULATOR_NOISE.test(line));
}

function emptyEntry(name: string): AvdListEntry {
  return {
    name,
    device: null,
    path: null,
    target: null,
    androidVersion: null,
    tag: null,
    abi: null,
    playStore: false,
    skin: null,
    sdcard: null,
  };
}

/** `pixel_7 (Google)` is the shape avdmanager prints; only the id is useful. */
function deviceId(value: string): string {
  return value.replace(/\s*\(.*\)\s*$/, '').trim();
}

export function parseAvdManagerList(stdout: string): {
  avds: AvdListEntry[];
  broken: BrokenAvd[];
} {
  const avds: AvdListEntry[] = [];
  const broken: BrokenAvd[] = [];

  // avdmanager prints the good AVDs first, then an optional "could not be loaded" section. The
  // two sections share the Name/Path keys, so which list an entry lands in depends on this flag.
  let inBrokenSection = false;
  let current: AvdListEntry | null = null;
  let currentBroken: BrokenAvd | null = null;

  const flush = (): void => {
    if (current) avds.push(current);
    if (currentBroken) broken.push(currentBroken);
    current = null;
    currentBroken = null;
  };

  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || /^-{3,}$/.test(line)) {
      // A separator ends the current entry but never starts one.
      if (/^-{3,}$/.test(line)) flush();
      continue;
    }
    if (/could not be loaded/i.test(line)) {
      flush();
      inBrokenSection = true;
      continue;
    }
    if (/^Available Android Virtual Devices:/i.test(line)) continue;

    const match = /^([A-Za-z ]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (key === 'name') {
      flush();
      if (inBrokenSection) currentBroken = { name: value, path: null, error: '' };
      else current = emptyEntry(value);
      continue;
    }

    if (currentBroken) {
      if (key === 'path') currentBroken.path = value;
      else if (key === 'error') currentBroken.error = value;
      continue;
    }
    if (!current) continue;

    switch (key) {
      case 'device':
        current.device = deviceId(value);
        break;
      case 'path':
        current.path = value;
        break;
      case 'target':
        current.target = value;
        break;
      case 'skin':
        current.skin = value;
        break;
      case 'sdcard':
        current.sdcard = value;
        break;
      case 'based on': {
        // "Android 14.0 ("UpsideDownCake") Tag/ABI: google_apis/x86_64"
        current.androidVersion = /Android\s+([\d.]+)/.exec(value)?.[1] ?? null;
        const tagAbi = /Tag\/ABI:\s*([^/\s]+)\/(\S+)/.exec(value);
        if (tagAbi) {
          current.tag = tagAbi[1];
          current.abi = tagAbi[2];
          current.playStore = tagAbi[1].includes('playstore');
        }
        break;
      }
      default:
        break;
    }
  }

  flush();
  return { avds, broken };
}
