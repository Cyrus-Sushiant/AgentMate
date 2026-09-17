const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Adds `https://` when someone types a bare host like `github.com/login`. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** The host name without `www.`, lowercased, or '' when the text is not a usable URL. */
export function hostOf(input: string): string {
  const url = normalizeUrl(input);
  if (!url || /\s/.test(url)) return '';
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** A stable hue (0-359) for the letter avatar, so the same site always gets the same color. */
export function avatarHue(key: string): number {
  // FNV-1a keeps it cheap and spreads short strings well enough for a color.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 360;
}

export function avatarLetter(title: string): string {
  const match = title.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : '?';
}
