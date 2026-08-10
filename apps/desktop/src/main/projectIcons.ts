import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { FaviconResult } from '../shared/apiTypes';

/** Icons live inside projects.json, so anything bigger than this is refused rather than inlined. */
const MAX_ICON_BYTES = 1024 * 1024;
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

export const ICON_FILE_EXTENSIONS = Object.keys(MIME_BY_EXTENSION).map((ext) => ext.slice(1));

function mimeForPath(pathOrUrl: string): string | null {
  return MIME_BY_EXTENSION[extname(pathOrUrl.split('?')[0]).toLowerCase()] ?? null;
}

function toDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
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

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ICON_BYTES) return null;
  return toDataUrl(mime, bytes);
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

/** Reads a picked image off disk into the same inline data URL form as a fetched favicon. */
export async function readIconFile(filePath: string): Promise<string> {
  const mime = mimeForPath(filePath);
  if (!mime) throw new Error('That file type is not a supported image.');
  const bytes = await readFile(filePath);
  if (bytes.byteLength > MAX_ICON_BYTES) {
    throw new Error('Image is larger than 1 MB. Pick a smaller one.');
  }
  return toDataUrl(mime, bytes);
}
