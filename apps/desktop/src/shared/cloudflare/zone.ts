import type { CloudflareSslMode } from '../cloudflareTypes';

/**
 * Zone-wide helpers the settings card and the "point domain" dialog share: which SSL/TLS mode a
 * proxied domain should use, and the URL list for a cache purge.
 */

/** How many files Cloudflare purges in one request on most plans. */
export const PURGE_URL_LIMIT = 30;
const MAX_URL = 2048;

export interface SslAdvice {
  level: 'ok' | 'improve' | 'warning';
  recommended: CloudflareSslMode;
  message: string;
}

const STRICT_NEEDS =
  "Full (strict) needs a trusted certificate on the server, such as one from Let's Encrypt.";

/**
 * What a proxied domain's SSL/TLS mode means for its visitors, and the mode to move to. The mode
 * is zone wide and only applies to proxied records; DNS-only records reach the server directly.
 */
export function sslAdvice(mode: CloudflareSslMode): SslAdvice {
  switch (mode) {
    case 'strict':
    case 'origin_pull':
      return {
        level: 'ok',
        recommended: mode,
        message:
          "Cloudflare encrypts the connection to your server and checks the server's certificate. This is the safest mode.",
      };
    case 'full':
      return {
        level: 'improve',
        recommended: 'strict',
        message: `The connection to your server is encrypted, but its certificate is not checked, so anyone in between could pose as it. ${STRICT_NEEDS}`,
      };
    case 'flexible':
      return {
        level: 'warning',
        recommended: 'strict',
        message: `Cloudflare reaches your server over plain HTTP, and a server that redirects to HTTPS sends visitors round in a loop. ${STRICT_NEEDS}`,
      };
    default:
      return {
        level: 'warning',
        recommended: 'strict',
        message: `Visitors get no HTTPS at all. ${STRICT_NEEDS}`,
      };
  }
}

export type PurgeUrlsCheck = { ok: true; urls: string[] } | { ok: false; problem: string };

/** The URLs to purge, one per line, as full http or https addresses. */
export function checkPurgeUrls(text: string): PurgeUrlsCheck {
  const lines = [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
  if (lines.length === 0) return { ok: false, problem: 'Enter at least one URL to purge.' };
  if (lines.length > PURGE_URL_LIMIT) {
    return { ok: false, problem: `Cloudflare purges up to ${PURGE_URL_LIMIT} URLs at a time.` };
  }
  for (const line of lines) {
    let url: URL | null = null;
    try {
      url = new URL(line);
    } catch {
      url = null;
    }
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
      return {
        ok: false,
        problem: `${line} is not a full web address. Start it with https://.`,
      };
    }
    if (line.length > MAX_URL) {
      return { ok: false, problem: `Keep each URL under ${MAX_URL} characters.` };
    }
  }
  return { ok: true, urls: lines };
}
