/**
 * Which files the workspace shows as a picture instead of text, and the media type each one
 * needs in a data URL. Only formats Chromium can actually paint are listed, so a .tif stays a
 * plain binary file rather than opening into an empty viewer.
 */
const IMAGE_MIME_TYPES: Record<string, string> = {
  apng: 'image/apng',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

/** The extension of a path, lowercased and without its dot. Empty for a name that has none. */
function extensionOf(path: string): string {
  const name = path.replaceAll('\\', '/').split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** The media type to show this path with, or null when it is not an image the viewer handles. */
export function imageMimeType(path: string): string | null {
  return IMAGE_MIME_TYPES[extensionOf(path)] ?? null;
}

export function isImagePath(path: string): boolean {
  return imageMimeType(path) !== null;
}

/** An image that is really text (SVG), so the viewer can offer to edit the source instead. */
export function isTextImagePath(path: string): boolean {
  return extensionOf(path) === 'svg';
}
