import { ipcMain, type NativeImage, type WebContents, webContents } from 'electron';
import type { BrowserElementShot } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { savePastedImage } from '../pastedImages';

/**
 * Screenshots of page elements picked in the workspace browser. The crop is saved next to pasted
 * images, so the prompt sent to the agent can name its path and the CLI attaches it.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** CSS pixels of context kept around the element, so the crop shows where it sits. */
const PADDING = 8;
/** Agent CLIs choke on huge images, and an element crop never needs to be one. */
const MAX_SHOT_BYTES = 2 * 1024 * 1024;
const THUMB_MAX_SIDE = 240;

function isRect(value: unknown): value is Rect {
  if (!value || typeof value !== 'object') return false;
  const rect = value as Record<string, unknown>;
  return ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]));
}

/**
 * Where the element sits in the captured bitmap. The rect comes from the page in CSS pixels; the
 * bitmap is in device pixels, which differ by the screen's scale and the page's zoom, so the
 * ratio of the two widths converts one to the other. Null when nothing of it is on screen.
 */
export function cropRect(
  rect: Rect,
  bitmap: { width: number; height: number },
  viewport: { width: number; height: number },
): Rect | null {
  if (viewport.width <= 0 || viewport.height <= 0) return null;
  const scaleX = bitmap.width / viewport.width;
  const scaleY = bitmap.height / viewport.height;
  const left = Math.max(0, (rect.x - PADDING) * scaleX);
  const top = Math.max(0, (rect.y - PADDING) * scaleY);
  const right = Math.min(bitmap.width, (rect.x + rect.width + PADDING) * scaleX);
  const bottom = Math.min(bitmap.height, (rect.y + rect.height + PADDING) * scaleY);
  if (right - left < 1 || bottom - top < 1) return null;
  const x = Math.round(left);
  const y = Math.round(top);
  return { x, y, width: Math.round(right) - x, height: Math.round(bottom) - y };
}

/** A webview guest that the asking window hosts; any other page is off limits. */
function hostedGuest(sender: WebContents, id: unknown): WebContents | null {
  if (typeof id !== 'number') return null;
  const guest = webContents.fromId(id);
  if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') return null;
  return guest.hostWebContents?.id === sender.id ? guest : null;
}

function scaled(image: NativeImage, factor: number): NativeImage {
  const { width, height } = image.getSize();
  return image.resize({
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    quality: 'good',
  });
}

function pngUnderLimit(image: NativeImage): Buffer {
  let current = image;
  let png = current.toPNG();
  for (let tries = 0; png.length > MAX_SHOT_BYTES && tries < 6; tries++) {
    current = scaled(current, Math.max(0.3, Math.sqrt(MAX_SHOT_BYTES / png.length) * 0.9));
    png = current.toPNG();
  }
  return png;
}

export function registerBrowserHandlers(): void {
  ipcMain.handle(
    IPC.browser.captureElement,
    async (
      event,
      id: unknown,
      rect: unknown,
      viewport: unknown,
    ): Promise<BrowserElementShot | null> => {
      const guest = hostedGuest(event.sender, id);
      if (!guest) throw new Error('That browser tab is gone.');
      if (!isRect(rect) || !viewport || typeof viewport !== 'object') {
        throw new Error('Nothing to capture.');
      }
      const page = await guest.capturePage();
      const size = page.getSize();
      const crop = cropRect(rect, size, viewport as { width: number; height: number });
      if (!crop || page.isEmpty()) return null;
      const shot = page.crop(crop);
      const path = await savePastedImage(pngUnderLimit(shot), 'png', 'element');
      const side = Math.max(crop.width, crop.height);
      const thumb = side > THUMB_MAX_SIDE ? scaled(shot, THUMB_MAX_SIDE / side) : shot;
      return { path, thumbDataUrl: thumb.toDataURL() };
    },
  );
}
