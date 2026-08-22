import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { nativeImage } from 'electron';
import type { FaviconResult } from '../shared/apiTypes';

/**
 * Icons are saved as their own files next to the app data, so the limits here
 * are about keeping a logo a logo rather than about what fits in a JSON file.
 * Anything bigger gets downscaled instead of refused.
 */
const MAX_ICON_DIMENSION = 512;
const MAX_STORED_ICON_BYTES = 512 * 1024;
/** A ceiling on what is worth decoding at all. Past this it isn't a logo, it's a photo library. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

/** Browsers send one, and a fair number of sites serve a bare 403 to anything that doesn't. */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
};

/** First extension wins, so image/jpeg lands on .jpg rather than .jpeg. */
const EXTENSION_BY_MIME: Record<string, string> = {};
for (const [ext, mime] of Object.entries(MIME_BY_EXTENSION)) {
  if (!EXTENSION_BY_MIME[mime]) EXTENSION_BY_MIME[mime] = ext;
}

export const ICON_FILE_EXTENSIONS = Object.keys(MIME_BY_EXTENSION).map((ext) => ext.slice(1));

function mimeForPath(pathOrUrl: string): string | null {
  return MIME_BY_EXTENSION[extname(pathOrUrl.split('?')[0]).toLowerCase()] ?? null;
}

/** Extension an icon of this type gets on disk, `.png` when the type is unfamiliar. */
export function iconExtensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[mime.toLowerCase()] ?? '.png';
}

/** Type to hand back to the renderer for an icon file the app wrote earlier. */
export function iconMimeForFileName(fileName: string): string {
  return mimeForPath(fileName) ?? 'image/png';
}

function toDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

export interface IconImage {
  mime: string;
  bytes: Buffer;
}

/** Splits a `data:image/png;base64,...` URL back into its parts; null for anything else. */
export function parseIconDataUrl(dataUrl: string): IconImage | null {
  const match = /^data:([^,]*),([\s\S]*)$/.exec(dataUrl.trim());
  if (!match) return null;
  // The header can carry parameters of its own, e.g. "image/svg+xml;charset=utf-8;base64".
  const [type, ...params] = match[1].split(';').map((part) => part.trim().toLowerCase());
  if (!type.startsWith('image/')) return null;
  let bytes: Buffer;
  try {
    bytes = params.includes('base64')
      ? Buffer.from(match[2], 'base64')
      : Buffer.from(decodeURIComponent(match[2]), 'utf-8');
  } catch {
    // Percent-escapes that don't decode: not something to throw over.
    return null;
  }
  if (bytes.byteLength === 0) return null;
  return { mime: type, bytes };
}

export function iconImageToDataUrl(image: IconImage): string {
  return toDataUrl(image.mime, image.bytes);
}

/**
 * Brings an image down to icon size. A 4000px shot of a logo is a perfectly
 * reasonable thing to pick, so it gets resized rather than rejected, and the
 * result comes back as PNG because that is what nativeImage re-encodes to.
 *
 * Images that already fit are returned untouched, which is what keeps a small
 * animated GIF animated (decoding one would flatten it to its first frame).
 */
export function prepareIconImage(source: IconImage): IconImage {
  const { mime, bytes } = source;
  // SVG is text and scales on its own, so there is nothing to resize.
  if (mime === 'image/svg+xml') {
    if (bytes.byteLength > MAX_STORED_ICON_BYTES * 2) {
      throw new Error('That SVG is too large to use as an icon.');
    }
    return source;
  }

  const image = nativeImage.createFromBuffer(bytes);
  // Some .ico and .avif files decode nowhere but in a browser. Keeping the
  // original bytes lets the renderer still show them; only the huge ones are
  // worth refusing.
  if (image.isEmpty()) {
    if (bytes.byteLength > MAX_STORED_ICON_BYTES * 4) {
      throw new Error('Could not read that image.');
    }
    return source;
  }

  const { width, height } = image.getSize();
  const fitsBox = width <= MAX_ICON_DIMENSION && height <= MAX_ICON_DIMENSION;
  if (fitsBox && bytes.byteLength <= MAX_STORED_ICON_BYTES) return source;

  let smallest: Buffer | null = null;
  for (const box of [MAX_ICON_DIMENSION, 256, 128]) {
    const scale = Math.min(1, box / Math.max(width, height));
    const resized =
      scale < 1
        ? image.resize({
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
            quality: 'best',
          })
        : image;
    const png = resized.toPNG();
    if (png.byteLength <= MAX_STORED_ICON_BYTES) return { mime: 'image/png', bytes: png };
    smallest = png;
  }
  // Even 128px came out over budget (a photo, most likely). It is still small
  // enough to keep, so take it rather than sending the user off to find another file.
  return { mime: 'image/png', bytes: smallest ?? bytes };
}

/**
 * Normalizes an icon that arrived as a data URL, which is how a drag and drop or
 * a paste reaches the main process. Throws something worth showing when the
 * payload isn't an image at all.
 */
export function normalizeIconDataUrl(dataUrl: string): string {
  const parsed = parseIconDataUrl(dataUrl);
  if (!parsed) throw new Error('That does not look like an image.');
  if (parsed.bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error('That image is too large to read.');
  }
  return iconImageToDataUrl(prepareIconImage(parsed));
}

/**
 * Users type "example.com" more often than a full URL, so a missing scheme is
 * filled in rather than rejected. Anything that isn't http(s) is refused: a
 * file:// or data: "site" would just be a way to read local files through the
 * favicon fetch.
 */
export function normalizeSiteUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

interface IconCandidate {
  url: string;
  /** Bigger wins: the largest declared side, or a guess when the tag omits `sizes`. */
  score: number;
}

/** `sizes="16x16 32x32"` (and the literal "any", used by SVG icons) both show up in the wild. */
function scoreFromSizes(sizes: string | null): number | null {
  if (!sizes) return null;
  if (/\bany\b/i.test(sizes)) return 512;
  const dimensions = [...sizes.matchAll(/(\d+)\s*[x×]\s*(\d+)/gi)].map((m) => Number(m[1]));
  if (dimensions.length === 0) return null;
  return Math.max(...dimensions);
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!match) return null;
  return (match[2] ?? match[3] ?? match[4] ?? '').trim();
}

/**
 * Pulls every <link rel="...icon..."> out of the page and ranks them largest
 * first. Regex rather than a DOM parse: the main process has no document, and
 * the shapes we care about are all single self-contained tags.
 */
function parseIconLinks(html: string, pageUrl: URL): IconCandidate[] {
  const candidates: IconCandidate[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attribute(tag, 'rel')?.toLowerCase();
    if (!rel || !/\b(icon|shortcut icon|apple-touch-icon(-precomposed)?|mask-icon)\b/.test(rel)) {
      continue;
    }
    const href = attribute(tag, 'href');
    if (!href || href.startsWith('data:')) continue;
    let resolved: URL;
    try {
      resolved = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    // Apple touch icons are reliably 180px even when the tag says nothing, and a
    // plain <link rel="icon"> with no sizes is usually the small 32px default.
    const declared = scoreFromSizes(attribute(tag, 'sizes'));
    const fallbackScore = rel.includes('apple-touch-icon') ? 180 : 32;
    candidates.push({ url: resolved.toString(), score: declared ?? fallbackScore });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'user-agent': BROWSER_UA, accept: 'image/*,*/*' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
  // Plenty of servers hand back application/octet-stream (or text/plain) for
  // .ico files, so the extension gets the final say when the header is useless.
  const mime = contentType.startsWith('image/') ? contentType : mimeForPath(url);
  if (!mime) return null;

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOURCE_BYTES) return null;
  try {
    // A site serving a 1024px apple-touch-icon is normal, so shrink it like any
    // other oversized pick instead of walking on to a worse candidate.
    return iconImageToDataUrl(prepareIconImage({ mime, bytes }));
  } catch {
    return null;
  }
}

/**
 * Downloads the best icon a site offers: the largest declared <link rel="icon">,
 * falling back to the well-known /favicon.ico and /apple-touch-icon.png paths
 * that plenty of sites serve without ever declaring them.
 *
 * Returns null when the site is unreachable or simply has no icon; that's an
 * ordinary outcome here, not an error worth throwing over.
 */
export async function fetchSiteFavicon(rawUrl: string): Promise<FaviconResult | null> {
  const siteUrl = normalizeSiteUrl(rawUrl);
  if (!siteUrl) return null;

  let candidates: IconCandidate[] = [];
  let pageUrl = siteUrl;
  try {
    const response = await fetch(siteUrl.toString(), {
      headers: { 'user-agent': BROWSER_UA, accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) {
      // Redirects move the base the hrefs resolve against (example.com -> www.example.com).
      pageUrl = new URL(response.url || siteUrl.toString());
      candidates = parseIconLinks(await response.text(), pageUrl);
    }
  } catch {
    // Unreachable page: the well-known paths below are still worth a try.
  }

  const wellKnown = ['/favicon.ico', '/apple-touch-icon.png'].map((path) =>
    new URL(path, pageUrl.origin).toString(),
  );
  const seen = new Set<string>();
  const ordered = [...candidates.map((c) => c.url), ...wellKnown].filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  for (const url of ordered) {
    const dataUrl = await fetchImageAsDataUrl(url);
    if (dataUrl) return { dataUrl, sourceUrl: url, siteUrl: siteUrl.toString() };
  }
  return null;
}

/**
 * Reads a picked image off disk, shrinking it when it is bigger than an icon
 * needs to be, and hands it back in the data URL form the form works with.
 */
export async function readIconFile(filePath: string): Promise<string> {
  const mime = mimeForPath(filePath);
  if (!mime) throw new Error('That file type is not a supported image.');
  const bytes = await readFile(filePath);
  if (bytes.byteLength === 0) throw new Error('That file is empty.');
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error('That image is too large to read.');
  return iconImageToDataUrl(prepareIconImage({ mime, bytes }));
}
