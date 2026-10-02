import type { RdpAgentFrame } from '@shared/apiTypes';

const PNG_PREFIX = /^data:image\/png;base64,/;

/**
 * Size of the screenshot sent to the AI: the desktop scaled down to `maxWidth`, never up. The
 * rounding matches frameSizeFor in main/agents/rdpCoords.ts, which maps the AI's coordinates
 * back to the desktop from the size reported here.
 */
function frameSize(
  desktop: { width: number; height: number },
  maxWidth: number,
): { width: number; height: number } {
  if (desktop.width <= maxWidth) {
    return { width: Math.round(desktop.width), height: Math.round(desktop.height) };
  }
  const scale = maxWidth / desktop.width;
  return { width: Math.round(maxWidth), height: Math.max(1, Math.round(desktop.height * scale)) };
}

/**
 * Takes a screenshot of the remote desktop from the canvas the session draws on, scaled down
 * for the AI and encoded as a base64 PNG.
 */
export function captureFrame(
  canvas: HTMLCanvasElement,
  desktop: { width: number; height: number },
  maxWidth = 1280,
): RdpAgentFrame {
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("The Remote Desktop session hasn't drawn the remote screen yet.");
  }
  const size = frameSize(desktop, maxWidth);
  const offscreen = document.createElement('canvas');
  offscreen.width = size.width;
  offscreen.height = size.height;
  const context = offscreen.getContext('2d');
  if (!context) {
    throw new Error("Couldn't take a screenshot of the remote desktop: no 2D canvas available.");
  }
  context.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, size.width, size.height);
  return {
    png: offscreen.toDataURL('image/png').replace(PNG_PREFIX, ''),
    width: size.width,
    height: size.height,
    desktopWidth: desktop.width,
    desktopHeight: desktop.height,
  };
}
