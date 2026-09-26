/**
 * Turning what the user typed in the browser tab's address bar into a URL to load.
 */

const SEARCH_URL = 'https://duckduckgo.com/?q=';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const SCHEME = /^[a-z][a-z\d+.-]*:/i;
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|[\w-]+\.localhost)$/i;
const PRIVATE_IP = /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+(\.\d+)?$/;

/** The host part of `host[:port][/path]`, which is what a scheme-less address starts with. */
function hostOf(address: string): string {
  const end = address.search(/[/?#]/);
  const authority = end === -1 ? address : address.slice(0, end);
  if (authority.startsWith('[')) return authority.slice(0, authority.indexOf(']') + 1);
  return authority.split(':')[0] ?? '';
}

/**
 * The URL for an address bar entry, or null when there is nothing to load or the scheme isn't
 * one a page may be loaded from. Local addresses go over http, other hosts over https, and
 * anything that doesn't look like a host becomes a search.
 */
export function normalizeAddress(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (text === 'about:blank') return text;

  // `localhost:3000` also matches the scheme pattern, so a scheme only counts with `//` after it.
  if (SCHEME.test(text) && /^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return ALLOWED_PROTOCOLS.has(url.protocol) ? localize(url).href : null;
    } catch {
      return null;
    }
  }
  if (SCHEME.test(text) && !/^[\w.-]+:\d/.test(text) && !text.startsWith('[')) return null;

  if (/\s/.test(text)) return SEARCH_URL + encodeURIComponent(text);
  const host = hostOf(text);
  const local = LOCAL_HOST.test(host) || PRIVATE_IP.test(host);
  if (!local && !host.includes('.')) return SEARCH_URL + encodeURIComponent(text);

  try {
    return localize(new URL(`${local ? 'http' : 'https'}://${text}`)).href;
  } catch {
    return SEARCH_URL + encodeURIComponent(text);
  }
}

/** 0.0.0.0 is what dev servers bind to, but it isn't an address a browser should load. */
function localize(url: URL): URL {
  if (url.hostname === '0.0.0.0') url.hostname = 'localhost';
  return url;
}

/** Whether a URL points at this machine, which is where dev servers live. */
export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** A URL as the address bar shows it when not being edited: no scheme, no lone trailing slash. */
export function displayUrl(url: string): string {
  const match = /^https?:\/\/(.*)$/i.exec(url);
  if (!match) return url;
  const rest = match[1] ?? '';
  return /^[^/]+\/$/.test(rest) ? rest.slice(0, -1) : rest;
}
