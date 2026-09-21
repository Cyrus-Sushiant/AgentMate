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
  const api = /^android-(\d+)$/.exec(parts[1]);
  return {
    api: api ? Number(api[1]) : null,
    tag: parts[2],
    abi: parts[3],
    playStore: parts[2].includes('playstore'),
  };
}

function tagLabel(tag: string): string {
  if (tag.includes('playstore')) return 'Google Play';
  if (tag === 'google_apis') return 'Google APIs';
  if (tag === 'default') return 'AOSP';
  if (tag === 'android-tv') return 'Android TV';
  if (tag === 'android-wear') return 'Wear OS';
  if (tag === 'android-automotive') return 'Automotive';
  return tag;
}

export function describeSystemImage(image: SystemImage): string {
  const version = androidVersionForApi(image.api);
  const head =
    image.api === null
      ? 'Preview'
      : version
        ? `Android ${version} (API ${image.api})`
        : `API ${image.api}`;
  return `${head} · ${tagLabel(image.tag)} · ${image.abi}`;
}

/** Newest API first, then Play Store images ahead of plain ones, then by abi for a stable order. */
export function sortSystemImages(images: SystemImage[]): SystemImage[] {
  return [...images].sort((a, b) => {
    if (a.api !== b.api)
      return (b.api ?? Number.MAX_SAFE_INTEGER) - (a.api ?? Number.MAX_SAFE_INTEGER);
    if (a.playStore !== b.playStore) return a.playStore ? -1 : 1;
    return a.abi.localeCompare(b.abi);
  });
}

function rowToImage(line: string): SystemImage | null {
  // "  id | version | description | location", with the location column absent in the available
  // section. A rule row is all dashes and pipes.
  if (!line.includes('|')) return null;
  const cells = line.split('|').map((cell) => cell.trim());
  const id = cells[0];
  if (!id || /^-+$/.test(id)) return null;
  const parsed = parseSystemImageId(id);
  if (!parsed) return null;
  return {
    id,
    api: parsed.api,
    tag: parsed.tag,
    abi: parsed.abi,
    playStore: parsed.playStore,
    version: cells[1] ?? '',
    description: cells[2] ?? '',
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
    const line = raw.trim();
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
