/** How a screenshot the AI looked at relates to the remote desktop it was taken from. */
export interface FrameMapping {
  frameWidth: number;
  frameHeight: number;
  desktopWidth: number;
  desktopHeight: number;
}

/**
 * The screenshot size for a desktop: at most `maxWidth` wide, same aspect. Vision models charge by
 * the pixel and read a 1280-wide screen fine, but scaling a small desktop up would only blur it.
 * `scale` is screenshot pixels per desktop pixel.
 */
export function frameSizeFor(
  desktopWidth: number,
  desktopHeight: number,
  maxWidth = 1280,
): { width: number; height: number; scale: number } {
  if (desktopWidth <= maxWidth) {
    return { width: Math.round(desktopWidth), height: Math.round(desktopHeight), scale: 1 };
  }
  const scale = maxWidth / desktopWidth;
  return {
    width: Math.round(maxWidth),
    height: Math.max(1, Math.round(desktopHeight * scale)),
    scale,
  };
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

/**
 * A point on the screenshot, in desktop pixels. A point off the screenshot is pulled back to the
 * nearest edge rather than sent as is, and `clamped` says so, since a click there is likely not
 * what the AI meant.
 */
export function toDesktop(
  m: FrameMapping,
  x: number,
  y: number,
): { x: number; y: number; clamped: boolean } {
  const scaledX = Math.round((x * m.desktopWidth) / m.frameWidth);
  const scaledY = Math.round((y * m.desktopHeight) / m.frameHeight);
  const outX = clamp(scaledX, m.desktopWidth - 1);
  const outY = clamp(scaledY, m.desktopHeight - 1);
  return { x: outX, y: outY, clamped: outX !== scaledX || outY !== scaledY };
}
