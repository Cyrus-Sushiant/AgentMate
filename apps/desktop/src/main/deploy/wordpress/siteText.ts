/**
 * Strings that come from a WordPress site (its name, labels, error messages, item names) are
 * untrusted. Before they reach the store, an error message or the renderer they are cut to a
 * length and stripped of control and bidirectional formatting characters, so nothing a site
 * says can break a line, hide text or reorder what the user reads. The renderer still shows
 * them as text, never as markup.
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

export function cleanSiteText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
  const chars = [...text];
  if (chars.length <= max) return text;
  return `${chars
    .slice(0, Math.max(0, max - 3))
    .join('')
    .trimEnd()}...`;
}

/** A site-given URL shown to the user: just its origin, or empty when it is not http(s). */
export function cleanSiteOrigin(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return cleanSiteText(url.origin, 200);
  } catch {
    return '';
  }
}
