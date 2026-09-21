/**
 * `sdkmanager --list` is the only way to know which system images are installed, and it prints a
 * pipe-separated table under two headings. Only the `system-images;*` rows matter here: build
 * tools and platforms are the SDK's business, not the device manager's.
 */

export interface SystemImage {
  /** The package id, which is also what `avdmanager create avd -k` takes. */
  id: string;
  /** Null for a preview release whose API level is a codename rather than a number. */
  api: number | null;
  tag: string;
  abi: string;
  playStore: boolean;
  version: string;
  description: string;
}

export interface SystemImageId {
  api: number | null;
  tag: string;
  abi: string;
  playStore: boolean;
}

/** Android marketing versions, so a card can say "Android 14" rather than only "API 34". */
const ANDROID_VERSION_BY_API: Record<number, string> = {
  21: '5.0',
  22: '5.1',
  23: '6.0',
  24: '7.0',
  25: '7.1',
  26: '8.0',
  27: '8.1',
  28: '9',
  29: '10',
  30: '11',
  31: '12',
  32: '12L',
  33: '13',
  34: '14',
  35: '15',
  36: '16',
};

export function androidVersionForApi(api: number | null): string | null {
  return api === null ? null : (ANDROID_VERSION_BY_API[api] ?? null);
}

export function parseSystemImageId(id: string): SystemImageId | null {
  const parts = id.split(';');
  if (parts.length < 4 || parts[0] !== 'system-images') return null;
  // `android-34` from the classic tools, `android-37.0` from the newer ones. A preview channel
  // is `android-canary-20260909`, which has no API number at all rather than a guessable one.
  const api = /^android-(\d+)(?:\.\d+)?$/.exec(parts[1]);
  return {
    api: api ? Number(api[1]) : null,
    tag: parts[2],
    abi: parts[3],
    playStore: parts[2].includes('playstore'),
  };
}

/**
 * A readable name for a system image tag.
 *
 * The vocabulary keeps growing (16 KB page sizes, tablet variants, XR), and two rows that read
 * the same are two rows nobody can choose between. So this names what it knows exactly and falls
 * back to the raw tag, which is unique, rather than collapsing an unknown into a near-match.
 */
function tagLabel(tag: string): string {
  const known: Record<string, string> = {
    default: 'AOSP',
    google_apis: 'Google APIs',
    google_apis_playstore: 'Google Play',
    google_apis_ps16k: 'Google APIs, 16 KB pages',
    google_apis_playstore_ps16k: 'Google Play, 16 KB pages',
    google_apis_tablet: 'Google APIs, tablet',
    google_apis_playstore_tablet: 'Google Play, tablet',
    aosp_atd: 'AOSP ATD',
    google_atd: 'Google ATD',
    'android-tv': 'Android TV',
    'google-tv': 'Google TV',
    'google-tv-ps16k': 'Google TV, 16 KB pages',
    'android-wear': 'Wear OS',
    'android-wear-cn': 'Wear OS, China',
    'android-wear-signed': 'Wear OS, signed',
    'android-desktop': 'Android Desktop',
    'android-automotive': 'Automotive',
    'android-automotive-playstore': 'Automotive, Play',
    'android-automotive-distant-display-playstore': 'Automotive distant display, Play',
    'google-xr': 'Android XR',
    'android-xr-preview-playstore': 'Android XR preview, Play',
  };
  return known[tag] ?? tag;
}

/** The API segment as written, so `37.0` and `37.1` do not both read as 37. */
function apiLabel(id: string, api: number | null): string | null {
  const segment = id.split(';')[1]?.replace(/^android-/, '');
  if (!segment) return api === null ? null : String(api);
  return segment;
}

export function describeSystemImage(image: SystemImage): string {
  const version = androidVersionForApi(image.api);
  const label = apiLabel(image.id, image.api);
  const head =
    image.api === null
      ? // Hundreds of preview builds all reading "Preview" is a list nobody can pick from, so
        // the channel that distinguishes them goes in the label.
        label
        ? `Preview ${label}`
        : 'Preview'
      : // The marketing name only fits a plain API level; `37.0` keeps its minor instead, since
        // 37.0 and 37.1 are genuinely different images.
        version && label === String(image.api)
        ? `Android ${version} (API ${image.api})`
        : `API ${label}`;
  return `${head} · ${tagLabel(image.tag)} · ${image.abi}`;
}

/**
 * Newest API first, then Play Store images ahead of plain ones, then by abi for a stable order.
 *
 * Previews have no API number and sort last. They outnumber the stable releases several times
 * over, so putting them first buries everything anyone actually wants.
 */
export function sortSystemImages(images: SystemImage[]): SystemImage[] {
  return [...images].sort((a, b) => {
    if (a.api !== b.api) return (b.api ?? -1) - (a.api ?? -1);
    if (a.playStore !== b.playStore) return a.playStore ? -1 : 1;
    if (a.abi !== b.abi) return a.abi.localeCompare(b.abi);
    // Two previews differ only by channel, which is part of the id.
    return a.id.localeCompare(b.id);
  });
}

/** Colour codes, which the newer tools wrap every row in. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: an ANSI escape is a control character.
const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * Splits one table row into cells.
 *
 * The classic tools separate columns with pipes. The newer ones deprecate `sdkmanager`, hand off
 * to the Android CLI, and print the same table aligned with runs of spaces instead, so both are
 * read here rather than guessing which tool is installed.
 */
function cellsOf(line: string): string[] {
  if (line.includes('|')) return line.split('|').map((cell) => cell.trim());
  return line.split(/\s{2,}/).map((cell) => cell.trim());
}

function rowToImage(line: string): SystemImage | null {
  const clean = line.replace(ANSI, '').trim();
  if (!clean) return null;

  const cells = cellsOf(clean).filter((cell) => cell !== '');
  const path = cells[0];
  // A rule row under the header is all dashes.
  if (!path || /^-+$/.test(path)) return null;

  // The Android CLI writes `system-images/android-34/google_apis/x86_64`, but every command that
  // takes a package wants the semicolon form, so that is what callers get.
  const id = path.startsWith('system-images/') ? path.replace(/\//g, ';') : path;
  const parsed = parseSystemImageId(id);
  if (!parsed) return null;

  // An upgradable row reads "4.0.0 -> 7.0.0 <description>". The installed version is the one
  // before the arrow; reading the arrow itself as the version would be worse than useless.
  const rest = cells.slice(1).filter((cell) => cell !== '->');
  return {
    id,
    api: parsed.api,
    tag: parsed.tag,
    abi: parsed.abi,
    playStore: parsed.playStore,
    version: rest[0] ?? '',
    description: rest.at(-1) ?? '',
  };
}

export function parseSdkManagerList(stdout: string): {
  installed: SystemImage[];
  available: SystemImage[];
} {
  const installed: SystemImage[] = [];
  const available: SystemImage[] = [];
  let target: SystemImage[] | null = null;

  for (const raw of stdout.split(/\r?\n/)) {
    // Headers get the colour treatment too on the newer tools.
    const line = raw.replace(ANSI, '').trim();
    if (/^installed packages:/i.test(line)) {
      target = installed;
      continue;
    }
    if (/^available (packages|updates):/i.test(line)) {
      target = /updates/i.test(line) ? null : available;
      continue;
    }
    if (!target) continue;
    const image = rowToImage(line);
    if (image) target.push(image);
  }

  return { installed, available };
}

/** One repainted progress line from sdkmanager: `[=====     ] 42% Downloading ...`. */
export interface SdkManagerProgress {
  percent: number;
  label: string;
}

const PROGRESS_LINE = /^\[[=\s]*\]\s*(\d{1,3})%\s*(.*)$/;

export function parseSdkManagerProgress(line: string): SdkManagerProgress | null {
  const match = PROGRESS_LINE.exec(line.trim());
  if (!match) return null;
  const percent = Number(match[1]);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return { percent, label: match[2].trim() };
}

/**
 * sdkmanager stops and waits on stdin at a licence question. Recognising it is what keeps an
 * install from looking like a hang, and what tells the caller when to send the answer.
 */
export function isLicensePrompt(line: string): boolean {
  return /\(y\/N\)\s*[?:]/i.test(line.trim());
}
