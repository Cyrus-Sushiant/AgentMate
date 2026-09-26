/**
 * Spotting dev server addresses (`http://localhost:5173/`) in terminal output, so a new browser
 * tab can offer the servers running in the workspace.
 */

// OSC sequences (window titles, OSC 8 hyperlinks) first, since their payload may hold a URL
// that is also printed as the visible text. Then CSI sequences such as colors.
// biome-ignore lint/suspicious/noControlCharactersInRegex: OSC sequences are delimited by BEL/ESC
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: ESC starts every ANSI escape sequence, matching it is the point
const CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const LOCAL_URL =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w-]+\.localhost):(\d{2,5})(?:\/[^\s'"<>`│|)\]]*)?/gi;

export function stripAnsi(text: string): string {
  return text.replace(OSC, '').replace(CSI, '');
}

/** The local URLs in a chunk of terminal output, normalized and listed once each, in order. */
export function extractLocalUrls(chunk: string): string[] {
  const urls: string[] = [];
  for (const match of stripAnsi(chunk).matchAll(LOCAL_URL)) {
    if (Number(match[1]) > 65_535) continue;
    const raw = match[0].replace(/[.,;:!?]+$/, '');
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.hostname === '0.0.0.0') url.hostname = 'localhost';
    const href =
      url.pathname === '/' ? `${url.origin}/` : `${url.origin}${url.pathname.replace(/\/$/, '')}`;
    if (!urls.includes(href)) urls.push(href);
  }
  return urls;
}
