/** Display helpers for the API Client: method and status colours, sizes, times, body languages. */

const METHOD_TONES: Record<string, string> = {
  GET: 'text-emerald-600 dark:text-emerald-400',
  POST: 'text-amber-600 dark:text-amber-400',
  PUT: 'text-sky-600 dark:text-sky-400',
  PATCH: 'text-violet-600 dark:text-violet-400',
  DELETE: 'text-red-600 dark:text-red-400',
};
const OTHER_METHOD_TONE = 'text-pink-600 dark:text-pink-400';

export function methodTone(method: string): string {
  return METHOD_TONES[method.toUpperCase()] ?? OTHER_METHOD_TONE;
}

/** Three or four letters, so methods line up in the sidebar the way they do in Postman. */
export function methodLabel(method: string): string {
  const upper = method.toUpperCase();
  if (upper === 'DELETE') return 'DEL';
  if (upper === 'OPTIONS') return 'OPT';
  return upper.length > 5 ? upper.slice(0, 4) : upper;
}

export type StatusTone = 'success' | 'info' | 'warning' | 'danger';

export function statusTone(status: number): StatusTone {
  if (status >= 500) return 'danger';
  if (status >= 400) return 'warning';
  if (status >= 200 && status < 300) return 'success';
  return 'info';
}

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-emerald-500/25',
  info: 'bg-sky-500/12 text-sky-700 dark:text-sky-400 ring-sky-500/25',
  warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/25',
  danger: 'bg-red-500/12 text-red-700 dark:text-red-400 ring-red-500/25',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${Number(value.toFixed(value >= 100 ? 0 : 2))} ${units[unit]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${Number((ms / 1000).toFixed(2))} s`;
}

/** The Monaco language for a response body, from its media type. */
export function bodyLanguage(mime: string): string {
  const subtype = mime.split('/')[1] ?? '';
  if (/json/.test(subtype)) return 'json';
  if (/html/.test(subtype)) return 'html';
  if (/xml/.test(subtype)) return 'xml';
  if (/javascript|ecmascript/.test(subtype)) return 'javascript';
  if (subtype === 'css') return 'css';
  if (/yaml/.test(subtype)) return 'yaml';
  return 'plaintext';
}

/** Past this, formatting would stall the window for longer than it is worth. */
const MAX_PRETTY_CHARS = 2_000_000;

export function prettyBody(body: string, language: string): string {
  if (language !== 'json' || body.length > MAX_PRETTY_CHARS) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/** Postman's Preview tab, for the responses where a rendered view means something. */
export function canPreview(mime: string): boolean {
  return /html/.test(mime) || mime === 'image/svg+xml';
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * The HTML to render in the preview frame. A base tag makes relative links and anchors point at
 * the server the page came from, the way they would in a browser.
 */
export function previewDocument(html: string, baseUrl: string | null): string {
  if (!baseUrl) return html;
  const base = `<base href="${escapeAttribute(baseUrl)}">`;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (!head) return `${base}${html}`;
  const at = head.index + head[0].length;
  return `${html.slice(0, at)}${base}${html.slice(at)}`;
}
